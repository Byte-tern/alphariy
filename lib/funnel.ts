import { decide, type Ctx, type Role } from './decision'
import { CFG } from './config'

// СИНТЕТИЧЕСКАЯ популяция. Распределения и «старый скор» — наши допущения, не данные банка.
export interface Co { id: number; ctx: Ctx; oldScore: number }
const rng = (s: number) => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
function pick<T>(x: number, o: [T, number][]): T { let a = 0; for (const [v, w] of o) { a += w; if (x < a) return v } return o[o.length - 1][0] }

export function generate(n = 10000, seed = 44): Co[] {
  const r = rng(seed), out: Co[] = []
  for (let id = 0; id < n; id++) {
    const segment = r() < 0.12 ? 'C2' : 'C1'
    const role = pick<Role>(r(), [['cfo', .25], ['treas', .2], ['acc', .25], ['ceo', .1], ['unknown', .2]])
    const canSend = role === 'cfo' || role === 'ceo' || (role === 'treas' && r() < .3)
    const monthsToDue = segment === 'C1' && r() < .6 ? 1 + Math.floor(r() * 36) : null
    const need = segment === 'C1'
      ? (monthsToDue == null ? 'none' : pick<Ctx['need']>(r(), [['confirmed', .65], ['unknown', .2], ['none', .15]]))
      : pick<Ctx['need']>(r(), [['confirmed', .15], ['unknown', .45], ['none', .4]])
    const amount = segment === 'C1' ? Math.round(50 + r() ** 2.5 * 1500) : Math.round(200 + r() ** 2 * 3000)
    const ctx: Ctx = {
      segment, industry: pick(r(), [['trade', .35], ['manuf', .3], ['constr', .2], ['infra', .15]]), role, canSend,
      structure: pick<Ctx['structure']>(r(), [['solo', .6], ['group', .25], ['sub', .15]]),
      centralized: pick<boolean | null>(r(), [[true, .5], [null, .3], [false, .2]]),
      activity: pick<Ctx['activity']>(r(), [['high', .2], ['mid', .3], ['low', .3], ['none', .2]]), managerPref: r() < .3,
      need, amount, termMonths: pick(r(), [[12, .2], [24, .3], [36, .3], [60, .2]]), monthsToDue, stages: 1 + Math.floor(r() * 5),
      cfa: pick<Ctx['cfa']>(r(), [['confirmed', .1], ['unknown', .6], ['no', .3]]), bondsBefore: r() < .1,
      refusal: pick<Ctx['refusal']>(r(), [['none', .85], ['notnow', .06], ['tool', .03], ['solved', .03], ['unsub', .03]]), refusedTool: 'bonds',
      requestSent: r() < .02, contacts30: r() < .08 ? 5 : Math.floor(r() * 4), oldestContactDays: Math.floor(r() * 30), lastEmailDays: r() < .3 ? Math.floor(r() * 90) : null,
      backCount: 0, compareOpens: 0, idleSec: 0,
    }
    // старый look-alike-скор: только «старые» признаки (масштаб) + шум; не знает про срок, роль, отказы
    out.push({ id: id + 1, ctx, oldScore: Math.min(1, .2 + .5 * Math.min(amount / 1500, 1) + .3 * r()) })
  }
  return out
}

export type Fail = 'need' | 'stop' | 'alt' | 'role' | 'limit' | 'ok'
export function classify(c: Ctx, now = '2026-10-27') {
  const needOk = c.need === 'confirmed' && (c.segment === 'C2' || (c.monthsToDue != null && c.monthsToDue <= CFG.refiMax))
  if (!needOk) return { k: 'need' as Fail }
  if (c.requestSent || ['notnow', 'unsub', 'solved'].includes(c.refusal)) return { k: 'stop' as Fail }
  const d = decide(c, now)
  if (d.instruments.length < 2) return { k: 'alt' as Fail, d }
  if (d.action === 'consult_specialist') return { k: 'role' as Fail, d }
  if (d.channelPlan.blocked) return { k: 'limit' as Fail, d }
  return { k: 'ok' as Fail, d }
}

export function run(n = 10000, topPct = 0.03) {
  const K = Math.round(n * topPct)
  const res = generate(n).map(co => ({ co, ...classify(co.ctx) }))
  const byScore = (a: { co: Co }, b: { co: Co }) => b.co.oldScore - a.co.oldScore
  const oldShown = [...res].sort(byScore).slice(0, K)
  const oldBreak: Record<Fail, number> = { need: 0, stop: 0, alt: 0, role: 0, limit: 0, ok: 0 }
  oldShown.forEach(x => oldBreak[x.k]++)
  const cnt = (bad: Fail[]) => res.filter(x => !bad.includes(x.k)).length
  const stages = [n, cnt(['need']), cnt(['need', 'stop']), cnt(['need', 'stop', 'alt']), cnt(['need', 'stop', 'alt', 'role']), cnt(['need', 'stop', 'alt', 'role', 'limit'])]
  const ok = res.filter(x => x.k === 'ok').sort(byScore)
  const newShown = ok.slice(0, K)
  const nonLoan = newShown.filter(x => x.d!.instruments.some(i => i.id !== 'loan')).length
  const routed = newShown.filter(x => x.d!.action === 'route_to_authorized_user').length
  return { n, K, stages, oldShown, oldBreak, newShown, nonLoan, routed }
}
