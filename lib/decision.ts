import { CFG, MOCK_SCORES } from './config'

export type Role = 'cfo' | 'treas' | 'acc' | 'ceo' | 'unknown'
export type Status = 'allowed' | 'consultation_only' | 'excluded'
export interface Ctx {
  segment: 'C1' | 'C2'; industry: string; role: Role; canSend: boolean
  structure: 'solo' | 'group' | 'sub'; centralized: boolean | null
  activity: 'high' | 'mid' | 'low' | 'none'; managerPref: boolean
  need: 'confirmed' | 'unknown' | 'none'
  amount: number; termMonths: number; monthsToDue: number | null; stages: number
  cfa: 'confirmed' | 'unknown' | 'no'; bondsBefore: boolean
  refusal: 'none' | 'notnow' | 'tool' | 'solved' | 'unsub'; refusedTool?: string
  requestSent: boolean; contacts30: number; oldestContactDays: number; lastEmailDays: number | null
  backCount: number; compareOpens: number; idleSec: number
}
export interface Inst { id: string; name: string; status: Status; reason: string; ruleId: string; cost: number | null; mockScore: number }
const NAMES: Record<string, string> = { loan: 'Кредит (база сравнения)', bonds: 'Облигации', synd: 'Синдицированный кредит', cfa: 'Денежные ЦФА' }

// условные расходы = сумма × ставка × срок/12 + разовые (млн ₽)
export const cost = (a: number, r: number, t: number, fee = 0) => a * r * t / 12 + fee
const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * 864e5).toISOString().slice(0, 10)

export function getBaseCandidates() { return MOCK_SCORES } // адаптер: позже — выход оптимизатора банка

export function planCommunication(c: Ctx, now: string) {
  let first = 'Карточка в интернет-банке', followUp = '', blocked = '', next = addDays(now, 0)
  if (c.activity === 'high') followUp = 'email на 14-й день (если разрешён)'
  else if (c.activity === 'mid') followUp = 'email на 7-й день; менеджер после интереса'
  else if (c.activity === 'low' && c.managerPref) { first = 'Задача менеджеру'; followUp = 'сообщение после контакта, с учётом лимитов' }
  else if (c.activity === 'none') { first = 'Нейтральный доступный канал'; followUp = 'нет телеметрии ≠ низкая активность' }
  let emailBlocked = ''
  if (c.lastEmailDays != null && c.lastEmailDays < CFG.emailGapDays) { emailBlocked = `email ≤1 за ${CFG.emailGapDays} дн.: следующий с ${addDays(now, CFG.emailGapDays - c.lastEmailDays)}`; followUp = 'email недоступен' }
  if (c.contacts30 >= CFG.maxContacts30) { blocked = `лимит ${CFG.maxContacts30} контактов за 30 дней`; next = addDays(now, 31 - c.oldestContactDays) }
  return { first: blocked ? '—' : first, followUp, emailBlocked, blocked, nextEligibleAt: next, dailyLimit: '1 рекламный канал в день' }
}

function hint(c: Ctx) {
  if (c.backCount >= CFG.backThreshold) return 'Второй возврат назад: неблокирующая подсказка со сравнением и «Обсудить со специалистом» (UX1)'
  if (c.compareOpens >= CFG.compareThreshold) return 'Расчёт сохранён; предложена индивидуальная оценка (UX2)'
  if (c.idleSec >= CFG.idleSec) return 'Закрываемая подсказка после паузы (UX3)'
  return ''
}

export function decide(c: Ctx, now: string) {
  const codes: { ruleId: string; fact: string; text: string }[] = []
  const missing: string[] = []
  const R = (ruleId: string, fact: string, text: string) => codes.push({ ruleId, fact, text })
  const comm = planCommunication(c, now)
  const out = (action: string, extra: Record<string, unknown> = {}) => ({
    rulesVersion: CFG.rulesVersion, source: 'mock', decisionId: `d-${now}-${c.segment}`, action,
    instruments: [] as Inst[], excluded: [] as Inst[], reasonCodes: codes,
    message: null as null | { title: string; sub: string; why: string },
    recipient: '', cta: [] as string[], channelPlan: comm, nextEligibleAt: comm.nextEligibleAt,
    journeyHint: hint(c), missingFields: missing, ...extra,
  })
  if (c.requestSent) { R('S01', 'requestSent', 'Запрос отправлен: реклама по потребности остановлена, доступен статус'); return out('show_request_status') }
  if (c.refusal === 'unsub') { R('R04', 'unsub', 'Отписка: стоп рекламы во всех каналах'); return out('suppress_marketing') }
  if (c.refusal === 'notnow') { R('R02', 'notnow', `«Не сейчас»: пауза ${CFG.notNowDays} дней`); return out('suppress_marketing', { nextEligibleAt: addDays(now, CFG.notNowDays) }) }
  if (c.refusal === 'solved' || c.need === 'none') { R('E01', 'need=none/solved', 'Потребности нет или задача решена: рекламу не показываем'); return out('suppress_marketing') }
  if (c.need === 'unknown' || (c.segment === 'C1' && c.monthsToDue == null)) {
    missing.push(c.need === 'unknown' ? 'need' : 'monthsToDue'); R('E02', 'need unknown', 'Сведения неполные: уточняем задачу, точную рекомендацию не даём'); return out('clarify_need')
  }
  const m = c.monthsToDue ?? 0
  if (c.segment === 'C1') {
    if (m > CFG.refiMax) { R('E04', `${m} мес.`, `До погашения больше ${CFG.refiMax} мес.: кампанию С1 не запускаем`); return out('suppress_marketing') }
    R('E03', `${m} мес.`, `Погашение через ${m} мес. (окно ${CFG.refiMin}–${CFG.refiMax}): рассматриваем рефинансирование`)
  } else R('C2', 'проект подтверждён', 'CAPEX подтверждён заявкой: параметры берём из неё')

  const I: Inst[] = []
  const add = (id: string, status: Status, ruleId: string, reason: string) => I.push({ id, name: NAMES[id], status, reason, ruleId, cost: null, mockScore: MOCK_SCORES[id] })
  add('loan', 'allowed', 'BASE', 'Обычный кредит — база сравнения, может оказаться лучшим решением')
  if (c.segment === 'C1') {
    if (m < CFG.bondPrepMonths) { add('bonds', 'consultation_only', 'E05', `До погашения ${m} мес. < срока подготовки выпуска (${CFG.bondPrepMonths}): только консультация`); R('E05', `${m} мес.`, 'Времени на выпуск не хватает: консультация вместо обещания облигаций') }
    else if (c.amount >= CFG.bondMinAmount && c.termMonths >= CFG.bondMinTerm) { add('bonds', 'allowed', 'E06', `Сумма ≥ ${CFG.bondMinAmount} млн ₽ и срок ≥ ${CFG.bondMinTerm} мес. (порог демо)`); R('E06', `${c.amount} млн, ${c.termMonths} мес.`, 'Добавили оценку облигаций рядом с кредитом') }
    else add('bonds', 'excluded', 'E06', `Не проходит порог демо: от ${CFG.bondMinAmount} млн ₽ и ${CFG.bondMinTerm} мес.`)
    if (c.bondsBefore) R('E07', 'bondsBefore', 'Раньше выпускали облигации: учтено в объяснении')
    add('synd', 'excluded', 'E08', 'Синдикат — для подтверждённых проектов CAPEX')
  } else {
    if (c.amount >= CFG.syndAmount || c.stages >= CFG.syndStages) { add('synd', 'allowed', 'E08', `Сумма ≥ ${CFG.syndAmount} млн ₽ или ≥ ${CFG.syndStages} этапов: выборка траншами`); R('E08', `${c.amount} млн, ${c.stages} этапа`, 'Добавили синдицированный кредит; проверка специалистом') }
    else add('synd', 'excluded', 'E08', 'Масштаб проекта ниже порога демо')
    add('bonds', 'excluded', 'E11', 'Готовность рынка не подтверждена: выпуск не гарантируем')
    if (c.industry === 'constr') R('E11', 'строительство', 'Строительство: применимость по проекту проверяет специалист')
  }
  if (c.cfa === 'confirmed') { add('cfa', 'allowed', 'E10', 'Возможность размещения ЦФА подтверждена'); R('E10', 'cfa=confirmed', 'ЦФА добавлены рядом с кредитом') }
  else add('cfa', 'excluded', 'E10', c.cfa === 'unknown' ? 'Возможность не подтверждена: unknown не разрешает ЦФА' : 'Не подходит')
  I.forEach(i => { if (c.refusal === 'tool' && c.refusedTool === i.id && i.id !== 'loan') { i.status = 'excluded'; i.reason = 'Клиент отказался от этого инструмента'; i.ruleId = 'R03' } })

  const sh = I.filter(i => i.status !== 'excluded')
  const alts = sh.filter(i => i.id !== 'loan').sort((a, b) => b.mockScore - a.mockScore).slice(0, 2)
  const shown = [sh.find(i => i.id === 'loan')!, ...alts]
  if (c.segment === 'C1') for (const i of shown) {
    if (i.id === 'loan') i.cost = cost(c.amount, CFG.rate.loan, c.termMonths)
    else if (i.id === 'bonds' && i.status === 'allowed') i.cost = cost(c.amount, CFG.rate.bonds, c.termMonths, CFG.bondFee)
  }

  const g = c.structure === 'group' && c.centralized === true
  if (c.structure === 'group' && c.centralized == null) { missing.push('centralization'); R('G01', 'centralized=null', 'Централизация неизвестна: не отправляем сведения в головную компанию') }
  const roleName: Record<Role, string> = { cfo: g ? 'Финансовый директор группы' : 'Финансовый директор', treas: 'Казначей', acc: 'Бухгалтер', ceo: 'Руководитель', unknown: 'Пользователь (роль не указана)' }
  let action = 'show_comparison'; let cta: string[]; let recipient = roleName[c.role]
  if (g) R('G02', 'centralized=true', 'Финансы централизованы: адресат — CFO группы')
  if (c.role === 'unknown') { action = 'consult_specialist'; cta = ['Посмотреть варианты', 'Уточнить получателя']; R('U01', 'role=unknown', 'Роль неизвестна: нейтральная версия, без кнопки отправки') }
  else if (!c.canSend) { action = 'route_to_authorized_user'; recipient = c.structure === 'sub' ? 'Уполномоченный представитель группы' : 'Финансовый директор'; cta = [c.structure === 'sub' ? 'Передать расчёт в головную компанию' : 'Передать расчёт финдиректору']; R('P01', 'canSend=false', 'Нет права отправки: готовим расчёт и передаём уполномоченному') }
  else cta = c.role === 'ceo' ? ['Обсудить со специалистом'] : ['Сравнить варианты', 'Обсудить со специалистом']

  const t = c.industry === 'trade' ? ' до сезона закупок' : ''
  const titles: Record<Role, string> = c.segment === 'C1' ? {
    cfo: `Через ${m} мес. погашается кредит ${c.amount} млн ₽: сравните варианты${t}`,
    treas: 'Приближается погашение. Подготовьте график и передайте расчёт финдиректору',
    acc: 'Приближается погашение. Передайте подготовленный расчёт финдиректору',
    ceo: 'Рассмотрите источники финансирования на следующий период', unknown: 'Доступна информация о вариантах финансирования',
  } : {
    cfo: `Проект ${c.amount} млн ₽, ${c.stages} этапа: сравните кредит и синдикацию`, treas: 'Сопоставьте транши с графиком платежей по проекту',
    acc: 'Заявка на проект сохранена — передайте расчёт руководителю', ceo: 'Рассмотрите структуру финансирования инвестпрограммы', unknown: 'По заявке на проект доступны варианты финансирования',
  }
  const message = {
    title: titles[c.role],
    sub: c.segment === 'C1' ? `Остаток ${c.amount} млн ₽ · новый срок ${c.termMonths} мес.` : `Проект ${c.amount} млн ₽ · ${c.stages} этапа · ${c.termMonths} мес.`,
    why: c.segment === 'C1' ? `Почему вы это видите: до погашения кредита ${m} мес.` : 'Почему вы это видите: вы указали проект в заявке',
  }
  return out(action, { instruments: shown, excluded: I.filter(i => !shown.includes(i)), message, recipient, cta })
}
