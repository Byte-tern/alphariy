import { describe, it, expect } from 'vitest'
import { decide, cost } from '@/lib/decision'
import { buildCtx } from '@/lib/ctx'
const run = (p: string, u: string, ov = {}, ev = {}) => decide(buildCtx(p, u, ov, ev)!, '2026-10-27')
describe('decide', () => {
  it('формула расходов', () => { expect(cost(800, 0.19, 36)).toBeCloseTo(456); expect(cost(800, 0.16, 36, 6)).toBeCloseTo(390) })
  it('границы окна 3 и 12', () => {
    expect(run('A', 'cfo', { monthsToDue: 12 }).action).toBe('show_comparison')
    expect(run('A', 'cfo', { monthsToDue: 13 }).action).toBe('suppress_marketing')
    expect(run('A', 'cfo', { monthsToDue: 3 }).instruments.some(i => i.id === 'bonds' && i.status === 'consultation_only')).toBe(true)
  })
  it('нет потребности → нет рекламы; неизвестна → уточнение', () => {
    expect(run('A', 'cfo', { need: 'none' }).action).toBe('suppress_marketing')
    expect(run('A', 'cfo', { need: 'unknown' }).action).toBe('clarify_need')
  })
  it('ЦФА: unknown не разрешает, confirmed разрешает', () => {
    expect(run('G', 'cfo', { cfa: 'unknown' }).instruments.some(i => i.id === 'cfa')).toBe(false)
    expect(run('G', 'cfo').instruments.some(i => i.id === 'cfa')).toBe(true)
  })
  it('CAPEX с этапами → синдикат; казначей без права → передача', () => {
    expect(run('B', 'cfo').instruments.some(i => i.id === 'synd')).toBe(true)
    expect(run('A', 'treas').action).toBe('route_to_authorized_user')
    expect(run('V', 'u').action).toBe('consult_specialist')
  })
  it('отказ/отписка/лимит/запрос', () => {
    expect(run('A', 'cfo', { refusal: 'notnow' }).action).toBe('suppress_marketing')
    expect(run('A', 'cfo', { refusal: 'tool', refusedTool: 'bonds' }).instruments.some(i => i.id === 'bonds')).toBe(false)
    expect(run('A', 'cfo', { contacts30: 5, lastEmailDays: 10 }).channelPlan.blocked).not.toBe('')
    expect(decide({ ...buildCtx('A', 'cfo')!, requestSent: true }, '2026-10-27').action).toBe('show_request_status')
  })
})
