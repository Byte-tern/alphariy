import { describe, it, expect } from 'vitest'
import { decide, cost, planCommunication } from '@/lib/decision'
import { buildCtx } from '@/lib/ctx'
import { run as funnel } from '@/lib/funnel'
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
  it('ЦФА: unknown не разрешает, confirmed — только консультация', () => {
    expect(run('G', 'cfo', { cfa: 'unknown' }).instruments.some(i => i.id === 'cfa')).toBe(false)
    expect([...run('G', 'cfo').instruments, ...run('G', 'cfo').excluded].some(i => i.id === 'cfa' && i.status === 'consultation_only')).toBe(true)
  })
  it('CAPEX с этапами → синдикат; казначей без права → передача', () => {
    expect(run('B', 'cfo').instruments.some(i => i.id === 'synd' && i.status === 'consultation_only')).toBe(true)
    expect(run('A', 'treas').action).toBe('route_to_authorized_user')
    expect(run('V', 'u').action).toBe('consult_specialist')
  })
  it('отказ/отписка/лимит/запрос', () => {
    expect(run('A', 'cfo', { refusal: 'notnow' }).action).toBe('suppress_marketing')
    expect(run('A', 'cfo', { refusal: 'tool', refusedTool: 'bonds' }).instruments.some(i => i.id === 'bonds')).toBe(false)
    expect(run('A', 'cfo', { contacts30: 5, lastEmailDays: 10 }).channelPlan.blocked).not.toBe('')
    expect(decide({ ...buildCtx('A', 'cfo')!, requestSent: true }, '2026-10-27').action).toBe('show_request_status')
  })
  it('долг группы: централизованная группа проходит порог облигаций, одиночная — нет', () => {
    expect(run('A', 'cfo', { amount: 150 }).instruments.some(i => i.id === 'bonds' && i.status === 'consultation_only')).toBe(true)
    expect(run('A', 'cfo', { amount: 150, structure: 'solo' }).instruments.some(i => i.id === 'bonds')).toBe(false)
  })
  it('С2: облигации под проект — консультация, в стройке исключены', () => {
    expect(run('A', 'cfo', { segment: 'C2', amount: 1200, stages: 3 }).instruments.some(i => i.id === 'bonds' && i.status === 'consultation_only')).toBe(true)
    expect(run('B', 'cfo').instruments.some(i => i.id === 'bonds')).toBe(false)
  })
  it('текст зависит от отрасли и роли; гендиректор получает встречу со специалистом', () => {
    expect(run('A', 'cfo').message!.title).toContain('сезона закупок')
    expect(run('G', 'ceo').cta[0]).toBe('Обсудить со специалистом')
  })
  it('клиент А: продление против рефинансирования, разница 66 млн; облигации только консультация', () => {
    const d = run('A', 'cfo')
    expect(d.instruments.map(i => i.id)).toEqual(['loan', 'refi', 'bonds'])
    expect(d.instruments[0].cost! - d.instruments[1].cost!).toBeCloseTo(66)
    expect(d.instruments[2].status).toBe('consultation_only')
    expect(d.instruments[2].cost).toBeNull()
  })
  it('сложные инструменты никогда не доступны в один клик', () => {
    for (const [p, u, ov] of [['A', 'cfo'], ['B', 'cfo'], ['G', 'cfo'], ['V', 'u'], ['A', 'cfo', { segment: 'C2', amount: 1200, stages: 3 }]]) {
      const d = run(p as string, u as string, ov || {})
      expect(d.instruments.filter(i => ['bonds', 'synd', 'cfa'].includes(i.id)).every(i => i.status === 'consultation_only')).toBe(true)
    }
  })
})
describe('каналы и воронка', () => {
  it('низкая активность → первым звонит менеджер; email блокируется паузой 60 дней', () => {
    const p = planCommunication(buildCtx('B', 'acc')!, '2026-10-27')
    expect(p.steps[0].text).toContain('менеджер')
    const e = planCommunication(buildCtx('A', 'cfo', { lastEmailDays: 10 })!, '2026-10-27')
    expect(e.steps.some(s => s.text === 'Email пропускаем')).toBe(true)
  })
  it('после пре-фильтра в выдаче нет компаний без потребности', () => {
    const r = funnel(2000)
    expect(r.newShown.every(x => x.k === 'ok')).toBe(true)
  })
})
