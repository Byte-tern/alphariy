import { CFG, MOCK_SCORES } from './config'
import { addDays, addMonths, fmt, fmtInt, plural, ruDate, IND_L } from './format'

export type Role = 'cfo' | 'treas' | 'acc' | 'ceo' | 'unknown'
export type Status = 'allowed' | 'consultation_only' | 'excluded'
export type RuleT = 'ok' | 'stop' | 'route'
export type Industry = 'trade' | 'manuf' | 'constr' | 'infra'
export interface Ctx {
  segment: 'C1' | 'C2'; industry: Industry; role: Role; canSend: boolean
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
export interface Reason { t: RuleT; ruleId: string; fact: string; text: string }
export interface CommStep { day: string; text: string; note: string; muted?: boolean; email?: boolean; after?: boolean }
export type Decision = ReturnType<typeof decide>
const NAMES: Record<string, string> = { loan: 'Кредит', refi: 'Оборотный кредит на новых условиях', gov: 'Кредит по льготной ставке (господдержка)', contract: 'Контрактное финансирование', bonds: 'Выпуск облигаций' }
// Пилот: средний бизнес (выручка от 500 млн ₽). В сравнении — кредитные продукты банка из личного кабинета.
// Облигации — только консультация с менеджером для крупных. Синдицированный кредит и ЦФА в цифровое предложение не входят.

// условные расходы = сумма × ставка × срок/12 + разовые (млн ₽)
export const cost = (a: number, r: number, t: number, fee = 0) => a * r * t / 12 + fee

export function getBaseCandidates() { return MOCK_SCORES } // адаптер: позже — выход оптимизатора банка

// План каналов и частоты: по шагам цепочки, с учётом роли, активности и лимитов
export function planCommunication(c: Ctx, now: string) {
  const lpr = c.role === 'cfo' || c.role === 'ceo'
  const ib = c.role === 'unknown' ? 'Карточка в «Требуют внимания», нейтральная версия' : lpr ? 'Карточка в Альфа-Бизнесе и «Требуют внимания»' : 'Карточка в интернет-банке, раздел кредитов'
  let steps: CommStep[]
  if (c.activity === 'high') steps = [
    { day: 'День 0', text: ib, note: 'главный канал — цифровой' },
    { day: 'День 1–3', text: 'Push «Расчёт сохранён», если брошен черновик', note: 'без суммы · один раз' },
    { day: 'День 14', text: 'Email с персональным расчётом, если не было клика', note: '', email: true },
    { day: 'После 2 открытий', text: 'Звонок менеджера, если нет запроса', note: 'один на цепочку' }]
  else if (c.activity === 'mid') steps = [
    { day: 'День 0', text: ib, note: '' },
    { day: 'День 7', text: 'Email с персональным расчётом', note: '', email: true },
    { day: 'День 14', text: 'Звонок менеджера, если нет клика', note: 'один на цепочку' }]
  else if (c.activity === 'low') steps = [
    { day: 'День 0', text: c.managerPref ? 'Задача менеджеру: звонок первым' : 'Звонок менеджера первым', note: 'клиент работает через менеджера' },
    { day: 'День 1', text: 'Email с расчётом по итогам звонка', note: '', email: true },
    { day: 'Фоном', text: ib, note: 'без push', muted: true }]
  else steps = [
    { day: 'День 0', text: ib, note: 'нет телеметрии ≠ низкая активность: цифровой канал не понижаем' },
    { day: 'День 7', text: 'Email с расчётом', note: '', email: true }]
  let emailBlocked = ''
  if (c.lastEmailDays != null && c.lastEmailDays < CFG.emailGapDays) {
    emailBlocked = `Email ≤ 1 раза в ${CFG.emailGapDays} дней: следующий не раньше ${ruDate(addDays(now, CFG.emailGapDays - c.lastEmailDays))}`
    steps = steps.map(s => s.email ? { day: s.day, text: 'Email пропускаем', note: emailBlocked, muted: true } : s)
  }
  if (c.role === 'unknown') steps = steps.map(s => s.email ? { day: s.day, text: 'Email не отправляем: адресат не определён', note: '', muted: true } : s)
  steps = steps.map(s => s.email ? { ...s, note: `email ≤ 1 раза в ${CFG.emailGapDays} дней` } : s)
  if (c.structure === 'sub') steps.push({ day: 'После запроса', text: 'Уведомление финдиректору головной компании', note: '', after: true })
  let blocked = '', next = now
  if (c.contacts30 >= CFG.maxContacts30) { blocked = `Лимит ${CFG.maxContacts30} контактов за 30 дней исчерпан`; next = addDays(now, 31 - c.oldestContactDays) }
  const planned = steps.filter(s => !s.muted && !s.after).length
  return { steps, first: blocked ? '—' : steps[0].text, followUp: steps.slice(1).filter(s => !s.muted).map(s => s.text).join(' → '), emailBlocked, blocked, nextEligibleAt: next, planned, dailyLimit: '1 рекламный канал в день' }
}

// Микро-сигналы сессии → какую подсказку показать в интерфейсе
export function journeyHint(c: Ctx): '' | 'back' | 'compare' | 'idle' {
  if (c.backCount >= CFG.backThreshold) return 'back'
  if (c.compareOpens >= CFG.compareThreshold) return 'compare'
  if (c.idleSec >= CFG.idleSec) return 'idle'
  return ''
}

export function decide(c: Ctx, now: string) {
  const codes: Reason[] = []
  const missing: string[] = []
  const R = (t: RuleT, ruleId: string, fact: string, text: string) => codes.push({ t, ruleId, fact, text })
  const comm = planCommunication(c, now)
  const out = (action: string, extra: Record<string, unknown> = {}) => ({
    rulesVersion: CFG.rulesVersion, source: 'mock', decisionId: `d-${now}-${c.segment}`, action,
    instruments: [] as Inst[], excluded: [] as Inst[], reasonCodes: codes,
    message: null as null | { title: string; sub: string; why: string },
    recipient: '', depth: '', cta: [] as string[], channelPlan: comm, nextEligibleAt: comm.nextEligibleAt,
    journeyHint: journeyHint(c), missingFields: missing, blockedText: '', ...extra,
  })
  if (c.requestSent) { R('stop', 'S01', 'requestSent', 'Запрос отправлен: реклама по этой потребности остановлена, клиент видит статус'); return out('show_request_status') }
  if (c.refusal === 'unsub') { R('stop', 'R04', 'unsub', 'Отписка → стоп рекламы во всех каналах'); return out('suppress_marketing', { blockedText: 'Клиент отписался от предложений. Возвращаемся, только если он сам подпишется снова.' }) }
  if (c.refusal === 'notnow') {
    const d = addDays(now, CFG.notNowDays)
    R('stop', 'R02', 'notnow', `«Не сейчас» → пауза ${CFG.notNowDays} дней во всех каналах`)
    return out('suppress_marketing', { nextEligibleAt: d, blockedText: `Клиент нажал «Не сейчас». Пауза во всех каналах до ${ruDate(d)}, потом вернёмся, только если появится новый сигнал.` })
  }
  if (c.refusal === 'solved' || c.need === 'none') { R('stop', 'E01', 'need=none/solved', 'Потребности нет или задача решена → рекламу не показываем'); return out('suppress_marketing', { blockedText: 'Долг погасят из собственных средств или задача уже решена. Предложение не показываем.' }) }
  if (c.need === 'unknown' || (c.segment === 'C1' && c.monthsToDue == null)) {
    missing.push(c.need === 'unknown' ? 'need' : 'monthsToDue')
    R('route', 'E02', 'need unknown', 'Сведения неполные → сначала уточняем задачу, точную рекомендацию не даём')
    return out('clarify_need')
  }
  R('ok', 'R00', 'refusal=none', 'Отказов и отписок нет')
  const m = c.monthsToDue ?? 0, isC1 = c.segment === 'C1'
  if (isC1) {
    if (m > CFG.refiMax) { R('stop', 'E04', `${m} мес.`, `До погашения больше ${CFG.refiMax} мес. → рано, кампанию С1 не запускаем`); return out('suppress_marketing', { blockedText: `До погашения ${m} мес. Сигнал вернётся в окне ${CFG.refiMin}–${CFG.refiMax} мес.` }) }
    R('ok', 'E03', `${m} мес.`, `Погашение через ${m} мес., окно ${CFG.refiMin}–${CFG.refiMax} → рассматриваем рефинансирование`)
  } else R('ok', 'C2', 'CAPEX', 'CAPEX подтверждён заявкой → параметры берём из неё')

  const grp = c.structure === 'group' && c.centralized === true
  const groupDebt = grp ? c.amount * CFG.groupFactor : c.amount
  const I: Inst[] = []
  const add = (id: string, status: Status, ruleId: string, reason: string, name?: string) => I.push({ id, name: name || NAMES[id], status, reason, ruleId, cost: null, mockScore: MOCK_SCORES[id] })
  add('loan', 'allowed', 'BASE', isC1 ? 'Текущий кредит — база сравнения, может оказаться лучшим решением' : 'Кредит на развитие бизнеса: транши под этапы проекта', isC1 ? 'Продление текущего кредита' : 'Инвестиционный кредит')
  const govOk = c.industry === 'manuf' || c.industry === 'infra'
  if (isC1) {
    add('refi', 'allowed', 'E13', 'Кредит на поддержание оборотов гасит текущий на лучших условиях')
    R('ok', 'E13', `${fmt(c.amount)} млн`, 'Оборотный кредит на новых условиях — в сравнении рядом с продлением')
    if (m < CFG.bondPrepMonths) add('bonds', 'excluded', 'E05', `До погашения ${m} мес. — меньше срока подготовки выпуска (${CFG.bondPrepMonths} мес.)`)
    else if (groupDebt >= CFG.bondMinAmount && c.termMonths >= CFG.bondMinTerm) {
      add('bonds', 'consultation_only', 'E06', `Крупный долг${grp ? ' группы' : ''} (≥ ${CFG.bondMinAmount} млн ₽, срок ≥ ${CFG.bondMinTerm} мес.): выпуск обсуждаем с менеджером`, c.bondsBefore ? 'Повторный выпуск облигаций' : 'Выпуск облигаций')
      R('route', 'E06', `${fmt(groupDebt)} млн, ${c.termMonths} мес.`, grp ? `Долг группы ≥ ${CFG.bondMinAmount} млн ₽ → консультация с менеджером по облигациям` : 'Облигации — консультация с менеджером')
    } else add('bonds', 'excluded', 'E06', `Для крупных: от ${CFG.bondMinAmount} млн ₽ долга и от ${CFG.bondMinTerm} мес. нового срока`)
    if (c.bondsBefore) R('ok', 'E07', 'bondsBefore', 'Уже выпускали облигации → учитываем опыт в объяснении')
  } else {
    if (c.industry === 'constr') { add('contract', 'allowed', 'E15', 'Работы по контрактам: кредит на исполнение контракта под этапы'); R('ok', 'E15', 'строительство', 'Строительство: контрактное финансирование рядом с инвесткредитом') }
    if (c.industry !== 'constr' && c.amount >= CFG.bondProjectConsult) {
      add('bonds', 'consultation_only', 'E11', `Крупный проект (≥ ${CFG.bondProjectConsult} млн ₽): выпуск обсуждаем с менеджером`, 'Выпуск облигаций под проект')
      R('route', 'E11', `${fmt(c.amount)} млн`, `Проект ≥ ${CFG.bondProjectConsult} млн ₽ → консультация с менеджером по облигациям`)
    } else add('bonds', 'excluded', 'E11', c.industry === 'constr' ? 'Строительство: облигации под проект не предлагаем' : `Проект меньше ${CFG.bondProjectConsult} млн ₽`, 'Выпуск облигаций под проект')
  }
  if (govOk) { add('gov', 'allowed', 'E12', 'Приоритетная отрасль: проверяем соответствие госпрограмме'); R('ok', 'E12', IND_L[c.industry], 'Производство и инфраструктура: кредит по льготной ставке в сравнении') }
  if (c.refusal === 'tool') {
    I.forEach(i => { if (c.refusedTool === i.id && i.id !== 'loan') { i.status = 'excluded'; i.reason = 'Клиент отказался от этого инструмента'; i.ruleId = 'R03' } })
    R('stop', 'R03', `tool=${c.refusedTool}`, c.refusedTool === 'bonds' ? 'Отказ от облигаций → убираем только их, остальное показываем' : 'Отказ от инструмента → убираем только его, остальное показываем')
  }

  const sh = I.filter(i => i.status !== 'excluded')
  const alts = sh.filter(i => i.id !== 'loan').sort((a, b) => b.mockScore - a.mockScore).slice(0, 2)
  const shown = [sh.find(i => i.id === 'loan')!, ...alts]
  if (isC1) for (const i of shown) {
    if (i.id === 'loan') i.cost = cost(c.amount, CFG.rate.loan, c.termMonths)
    else if (i.id === 'refi') i.cost = cost(c.amount, CFG.rate.refi, c.termMonths, CFG.refiFee)
  }

  if (c.structure === 'group' && c.centralized == null) { missing.push('centralization'); R('route', 'G01', 'centralized=null', 'Централизация неизвестна → не отправляем сведения в головную компанию') }
  if (grp) R('ok', 'G02', 'centralized=true', c.role === 'cfo' ? 'Финансы централизованы → адресат — финдиректор группы, расчёт по всей группе' : 'Финансы централизованы → расчёт по группе, копия финдиректору группы')
  const roleName: Record<Role, string> = { cfo: grp ? 'Финдиректор группы' : 'Финдиректор', treas: 'Казначей', acc: 'Бухгалтер', ceo: 'Гендиректор / собственник', unknown: 'Пользователь с правом входа, роль не указана' }
  const depthMap: Record<Role, string> = { cfo: 'Полный расчёт: стоимость, срок, риски', treas: 'График погашений, ликвидность, транши', acc: 'Документы и сроки', ceo: 'Суть: влияние на инвестпрограмму', unknown: 'Нейтральная информация, роль не угадываем' }
  let action = 'show_comparison', cta: string[], recipient = roleName[c.role]
  if (c.role === 'unknown') { action = 'consult_specialist'; cta = ['Посмотреть варианты', 'Уточнить получателя']; R('route', 'U01', 'role=unknown', 'Роль не заполнена → нейтральная версия без кнопки отправки') }
  else if (!c.canSend) {
    action = 'route_to_authorized_user'; recipient = c.structure === 'sub' ? 'Финдиректор головной компании' : 'Финдиректор'
    cta = [c.structure === 'sub' ? 'Передать расчёт в головную компанию' : 'Передать расчёт финдиректору', 'Посмотреть варианты']
    R('route', 'P01', 'canSend=false', 'Нет права отправки → готовим расчёт и передаём уполномоченному')
  } else cta = c.role === 'ceo' ? ['Обсудить со специалистом', 'Посмотреть варианты'] : ['Сравнить варианты', 'Обсудить со специалистом']
  if (c.structure === 'sub') R('route', 'G03', 'sub', 'Дочка без полномочий → запрос уходит в головную компанию')

  const due = ruDate(addMonths(now, m)), ind = c.industry
  const H: Record<Role, string> = isC1 ? {
    cfo: { trade: 'Погашение до сезона закупок: сравните варианты', manuf: `Кредит гасится через ${m} мес. Есть вариант дешевле?`, constr: `Кредит гасится через ${m} мес. — не тормозите стройку`, infra: 'Длинный проект — длинные деньги: варианты рефинансирования' }[ind],
    treas: `Кредит гасится ${due}. Расчёт для руководителя готов`, acc: `Кредит гасится ${due}. Передайте расчёт финдиректору`,
    ceo: `Кредит гасится через ${m} мес. Специалист покажет варианты на одной встрече`, unknown: 'Скоро погашение кредита — посмотрите варианты',
  } : {
    cfo: { trade: `Проект на ${fmt(c.amount)} млн ₽: только кредит?`, manuf: `Модернизация на ${fmt(c.amount)} млн ₽: чем финансировать?`, constr: 'Финансирование на любом этапе стройки', infra: `Проект на ${fmt(c.amount)} млн ₽: не только кредит` }[ind],
    treas: 'Транши под график проекта — расчёт для финдиректора', acc: 'Заявка на проект сохранена — передайте финдиректору', ceo: 'Финансирование проекта под сроки и этапы', unknown: 'По заявке на проект есть несколько способов финансирования',
  }
  const message = {
    title: H[c.role],
    sub: isC1
      ? `Остаток ${fmt(c.amount)} млн ₽ · погашение ${due}${grp ? ` · долг группы ${fmt(groupDebt)} млн ₽` : ''} · новый срок ${c.termMonths} мес.`
      : `Проект ${fmt(c.amount)} млн ₽ · ${c.stages} ${plural(c.stages, 'этап', 'этапа', 'этапов')} · ${c.termMonths} мес.`,
    why: isC1 ? `Почему вы это видите: срок кредита ${due}` : `Почему вы это видите: заявка на проект ${fmt(c.amount)} млн ₽`,
  }
  if (comm.blocked) R('stop', 'L01', `${c.contacts30} контактов`, `${comm.blocked} → ждём до ${ruDate(comm.nextEligibleAt)}`)
  return out(action, { instruments: shown, excluded: I.filter(i => !shown.includes(i)), message, recipient, depth: depthMap[c.role], cta })
}
