import { decide, type Ctx, type Role } from './decision'
import { CFG, RANK_W, CAND_KEEP } from './config'

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

export function rankScore(c: Ctx, old: number) {
  const urgency = c.segment === 'C1' ? Math.max(0, Math.min(1, 1 - ((c.monthsToDue ?? 12) - 1) / 11)) : 0.6 + (c.stages >= 3 ? 0.4 : 0)
  const intent = { high: 1, mid: .6, low: .3, none: .2 }[c.activity]
  const parts = [['look-alike (старые признаки)', RANK_W.old * old], ['срочность / подтверждённость (сигналы 1, 5, 6, 8)', RANK_W.urgency * urgency], ['цифровое намерение (сигнал 13)', RANK_W.intent * intent]] as [string, number][]
  return { score: parts.reduce((s, [, v]) => s + v, 0), parts }
}

export function run(n = 10000, topPct = 0.03) {
  const K = Math.round(n * topPct)
  const res = generate(n).map(co => ({ co, ...classify(co.ctx) }))
  const byScore = (a: { co: Co }, b: { co: Co }) => b.co.oldScore - a.co.oldScore
  // ДО: топ-K по look-alike-скору
  const oldShown = [...res].sort(byScore).slice(0, K)
  const oldBreak: Record<Fail, number> = { need: 0, stop: 0, alt: 0, role: 0, limit: 0, ok: 0 }
  oldShown.forEach(x => oldBreak[x.k]++)
  // ПОСЛЕ: 5 стадий
  const pre = res.filter(x => x.k !== 'need' && x.k !== 'stop')
  const cand = [...pre].sort(byScore).slice(0, Math.round(pre.length * CAND_KEEP))
  const afterAlt = cand.filter(x => x.k !== 'alt')
  const fin = afterAlt.filter(x => x.k === 'ok')
  const newShown = fin.map(x => ({ ...x, rank: rankScore(x.co.ctx, x.co.oldScore) })).sort((a, b) => b.rank.score - a.rank.score).slice(0, K)
  const stages = [
    { id: 1, title: 'Бизнес-пре-фильтр', model: 'Жёсткие правила до модели', features: 'Сигналы 1, 5, 6, 8 (потребность и окно), 13 + история отказов', rules: 'E01–E04, R02–R04, S01', inN: n, outN: pre.length, isNew: true },
    { id: 2, title: 'Генерация кандидатов', model: 'Look-alike (действующая, в демо — заглушка)', features: 'Сотни старых признаков: обороты, ОКВЭД, остатки', rules: '—', inN: pre.length, outN: cand.length, isNew: false },
    { id: 3, title: 'Ранжирование', model: 'Скор + ручные веса новых сигналов (в проде — бустинг)', features: `Look-alike ${RANK_W.old}, срочность ${RANK_W.urgency}, намерение ${RANK_W.intent}`, rules: 'порядок, без отсева', inN: cand.length, outN: cand.length, isNew: true },
    { id: 4, title: 'Доранжирование и выбор инструмента', model: 'Правила применимости + сравнение вариантов', features: 'Сигналы 2, 3, 6, 9, 11: срок, сумма, отрасль, готовность', rules: 'E05–E11', inN: cand.length, outN: afterAlt.length, isNew: true },
    { id: 5, title: 'Пост-фильтр: адресат и лимиты', model: 'Правила ЛПР и политика контактов', features: 'Сигнал 12 (роль, полномочия), лимиты 5/30 дн., email 1/60', rules: 'U01, P01, лимиты', inN: afterAlt.length, outN: fin.length, isNew: true },
  ]
  const nonLoan = newShown.filter(x => x.d!.instruments.some(i => i.id !== 'loan')).length
  const routed = newShown.filter(x => x.d!.action === 'route_to_authorized_user').length
  return { n, K, stages, oldShown, oldBreak, newShown, nonLoan, routed }
}
