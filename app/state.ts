// Состояние демо: профиль, переопределения из панели, сессия «Путь клиента». Все переходы — чистые функции,
// поэтому их же переиспользует сценарий демо.
import { PROFILES } from '@/data/profiles'
import { buildCtx } from '@/lib/ctx'
import { decide, type Ctx } from '@/lib/decision'
import { CFG } from '@/lib/config'
import { TODAY, addDays, ruDate } from '@/lib/format'

export interface JState { scr: string; back: number; cmp: number; idle: number; draft: boolean; day: number; closed: Record<string, boolean>; log: string[] }
export interface Req { requestId: string; number: string; status: string }
export interface St {
  pid: string; uid: string; ov: Record<string, unknown>; dirty: boolean; j: JState
  reqs: Record<string, Req>; inbox: Record<string, { from: string; status: string }>
}
export const freshJ = (): JState => ({ scr: 'home', back: 0, cmp: 0, idle: 0, draft: false, day: 0, closed: {}, log: [] })
export const initial = (): St => ({ pid: 'A', uid: 'cfo', ov: {}, dirty: false, j: freshJ(), reqs: {}, inbox: {} })
export const needOf = (s: St) => `need-${s.pid}`
export const nowOf = (s: St) => addDays(TODAY, s.j.day)
export const userOf = (s: St) => PROFILES[s.pid].users.find(u => u.id === s.uid) || PROFILES[s.pid].users[0]
export const ctxOf = (s: St): Ctx => buildCtx(s.pid, userOf(s).id, s.ov, { backCount: s.j.back, compareOpens: s.j.cmp, idleSec: s.j.idle }, !!s.reqs[needOf(s)])!
export const decisionOf = (s: St) => decide(ctxOf(s), nowOf(s))

const log = (j: JState, t: string): JState => ({ ...j, log: [...j.log, t].slice(-30) })
export const setPreset = (s: St, k: string): St => ({ ...s, pid: k, uid: PROFILES[k].users[0].id, ov: {}, dirty: false, j: freshJ() })
export const setUser = (s: St, id: string): St => ({ ...s, uid: id, j: { ...s.j, scr: s.j.scr === 'status' ? 'status' : 'home' } })
export const setOv = (s: St, o: Record<string, unknown>): St => ({ ...s, ov: { ...s.ov, ...o }, dirty: true })

function jgo(j: JState, scr: string): JState {
  if (scr === 'compare') {
    j = { ...j, cmp: j.cmp + 1 }
    if (j.cmp >= CFG.compareThreshold && !j.closed.compare) j = log(j, 'Повторное сравнение → «Расчёт сохранён», предлагаем индивидуальную оценку.')
  }
  return { ...j, scr }
}
function jback(j: JState): JState {
  j = { ...j, back: j.back + 1 }
  if (j.back === CFG.backThreshold && !j.closed.back) j = log(j, 'Второй возврат назад → краткое сравнение поднято наверх, рядом «Вернуть как было».')
  return { ...j, scr: 'home' }
}
export const pushAllowed = (c: Ctx, blocked: string) => !(c.refusal === 'notnow' || c.refusal === 'unsub') && c.activity !== 'low' && !blocked

export type JAct =
  | { a: 'go'; s: string } | { a: 'back' } | { a: 'cta'; t: string } | { a: 'need'; v: 'confirmed' | 'none' | 'later' }
  | { a: 'refuse'; v: 'notnow' | 'unsub' } | { a: 'handoff' } | { a: 'leave' } | { a: 'close'; k: string } | { a: 'openpush' }
  | { a: 'sig'; v: 'idle' | 'draft' | 'day' | 'reset' } | { a: 'sent'; req: Req }

// Действие на экране «Путь клиента» → новое состояние
export function jAction(s: St, x: JAct): St {
  const c = ctxOf(s), d = decide(c, nowOf(s)), j = s.j
  switch (x.a) {
    case 'go': return { ...s, j: jgo(j, x.s) }
    case 'back': return { ...s, j: jback(j) }
    case 'cta':
      if (x.t.startsWith('Передать')) return { ...s, j: jgo(j, 'request') }
      if (x.t.startsWith('Обсудить') || x.t.startsWith('Уточнить')) return { ...s, j: jgo(j, 'consult') }
      return { ...s, j: jgo(j, 'compare') }
    case 'need':
      if (x.v === 'confirmed') {
        const o: Record<string, unknown> = { need: 'confirmed' }
        if (c.segment === 'C1' && c.monthsToDue == null) o.monthsToDue = 5
        return { ...setOv(s, o), j: jgo(log(j, 'Клиент подтвердил потребность → оптимизатор пересчитал предложение.'), 'compare') }
      }
      if (x.v === 'none') return { ...setOv(s, { need: 'none' }), j: { ...log(j, '«Погасим сами» → потребности нет, рекламу не показываем.'), scr: 'home' } }
      return { ...s, j: { ...log(j, '«Пока не решили» → вопрос повторим не раньше чем через 30 дней.'), scr: 'home' } }
    case 'refuse':
      return { ...setOv(s, { refusal: x.v }), j: { ...log(j, x.v === 'notnow' ? `«Не сейчас» → пауза ${CFG.notNowDays} дней во всех каналах.` : '«Неактуально» → отписка, стоп во всех каналах.'), scr: 'home' } }
    case 'handoff':
      return { ...s, inbox: { ...s.inbox, [needOf(s)]: { from: userOf(s).label, status: 'awaiting_review' } }, j: { ...log(j, `Расчёт передан: ${d.recipient}. Статус awaiting_review.`), draft: false, scr: 'handoff' } }
    case 'sent':
      return { ...s, reqs: { ...s.reqs, [needOf(s)]: x.req }, j: { ...log(j, `Запрос ${x.req.number} отправлен → реклама по потребности остановлена.`), draft: false, scr: 'status' } }
    case 'leave': return { ...s, j: jback({ ...log(j, 'Черновик заявки брошен → расчёт сохранён.'), draft: true }) }
    case 'close': return { ...s, j: { ...log(j, 'Клиент закрыл подсказку → в этой сессии она не вернётся.'), closed: { ...j.closed, [x.k]: true } } }
    case 'openpush': return { ...s, j: { ...log(j, 'Клиент вернулся по push → тот же шаг, данные на месте.'), scr: 'request', draft: false } }
    case 'sig':
      if (x.v === 'idle') return { ...s, j: { ...log(j, c.refusal === 'unsub' ? 'Пауза, но клиент отписался → подсказку с чатом не показываем.' : `Пауза ${CFG.idleSec} с → закрываемая подсказка с чатом специалиста.`), idle: CFG.idleSec } }
      if (x.v === 'draft') return { ...s, j: { ...log(j, 'Черновик заявки брошен → расчёт сохранён.'), draft: true, scr: 'home' } }
      if (x.v === 'day') {
        const day = j.day + 2, n = ruDate(addDays(TODAY, day))
        return { ...s, j: { ...log(j, `Прошло 2 дня, сейчас ${n}.` + (j.draft ? (pushAllowed(c, d.channelPlan.blocked) ? ' Есть брошенный черновик → push «Расчёт сохранён».' : ' Черновик есть, но push не шлём.') : '')), day } }
      }
      { // reset: новая сессия, запрос и передача по этой компании забываются
        const need = needOf(s), reqs = { ...s.reqs }, inbox = { ...s.inbox }
        delete reqs[need]; delete inbox[need]
        return { ...s, reqs, inbox, j: freshJ() }
      }
  }
}
