'use client'
import { useMemo } from 'react'
import { run } from '@/lib/funnel'

const ST: [string, string, string][] = [
  ['Все компании сегмента', 'Базовый look-alike-скор: сотни старых признаков (обороты, ОКВЭД, остатки)', 'действующий оптимизатор'],
  ['Подтверждённая потребность', 'Сигналы 1, 5, 6, 8: окно погашения 3–12 мес. / подтверждённый CAPEX', 'E01–E04'],
  ['Нет отказа и отправленного запроса', 'Сигнал 13 и история коммуникаций', 'R02–R04, S01'],
  ['Есть допустимая альтернатива кредиту', 'Сигналы 2, 3, 6, 9, 11: срок, сумма, отрасль, готовность', 'E05–E11'],
  ['Есть адресат (роль известна)', 'Сигнал 12: роль и полномочия', 'U01, P01'],
  ['Лимиты контактов позволяют', 'Частота 5 за 30 дней, email 1 за 60', 'политика контактов'],
]
const LBL: Record<string, string> = { need: 'нет подтверждённой потребности / окна', stop: 'отказ, отписка или запрос уже отправлен', alt: 'нет допустимой альтернативы кредиту', role: 'роль неизвестна', limit: 'исчерпан лимит контактов', ok: 'релевантный показ' }
const pct = (a: number, b: number) => (100 * a / b).toFixed(1).replace('.', ',') + '%'
const Row = ({ x, old }: any) => { const c = x.co.ctx, d = x.d
  return <tr><td>#{x.co.id}</td><td>{c.segment} · {c.industry}</td><td>{c.role}</td><td>{x.co.oldScore.toFixed(2)}</td>
    <td>{old ? 'Кредит для бизнеса' : d.instruments.map((i: any) => i.name.split(' ')[0]).join(' + ')}</td><td>{old ? (x.k === 'ok' ? '✓' : '✗ ' + LBL[x.k]) : d.recipient}</td></tr> }

export default function Funnel() {
  const r = useMemo(() => run(), [])
  const { n, K, stages: S, oldBreak: ob } = r
  return <div>
    <div className="card"><span className="tag">Синтетическая симуляция · {n.toLocaleString('ru-RU')} вымышленных компаний</span>
      <h2>Воронка модели: до и после</h2>
      <p className="mut">«До» — наше допущение о действующем оптимизаторе: показ продукта компаниям с наибольшим look-alike-скором. «После» — тот же скор + 13 сигналов + бизнес-правила. Это иллюстрация логики, а не оценка реального эффекта: он измеряется только A/B-тестом.</p></div>
    <div className="card"><h2>После: что отсекает каждый этап</h2>
      {S.map((n2, i) => <div key={i} style={{ margin: '8px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>{i + 1}. {ST[i][0]}</b><b>{n2.toLocaleString('ru-RU')}{i ? ` (−${(S[i - 1] - n2).toLocaleString('ru-RU')})` : ''}</b></div>
        <div style={{ background: '#eee', borderRadius: 6 }}><div style={{ width: pct(n2, n), background: '#ef3124', height: 10, borderRadius: 6 }} /></div>
        <small>{ST[i][1]} · <b>{ST[i][2]}</b></small></div>)}
      <div style={{ margin: '8px 0' }}><b>7. Показ: топ-{K} по базовому скору среди допустимых</b><br /><small>скор не отменяет запрет: ранжируем только то, что прошло правила</small></div></div>
    <div className="card"><h2>До против после (показано {K} компаниям)</h2>
      <table><thead><tr><th></th><th>До: топ-{K} по скору</th><th>После: топ-{K} допустимых</th></tr></thead><tbody>
        <tr><td>Релевантные показы</td><td><b>{pct(ob.ok, K)}</b></td><td><b>{pct(K, K)}</b> <small>по построению правил</small></td></tr>
        {(['need', 'stop', 'alt', 'role', 'limit'] as const).map(k => <tr key={k}><td className="mut">{LBL[k]}</td><td>{ob[k]} ({pct(ob[k], K)})</td><td>0</td></tr>)}
        <tr><td>С альтернативой кредиту</td><td>0 <small>(один продукт)</small></td><td>{pct(r.nonLoan, K)}</td></tr>
        <tr><td>Через передачу уполномоченному</td><td>—</td><td>{pct(r.routed, K)}</td></tr></tbody></table>
      <small>Если «до» показывает {pct(ob.ok, K)} релевантных, остальное — нерелевантный показ: клиенту без потребности, после отказа, без альтернативы, с неизвестным адресатом или сверх лимита.</small></div>
    <div className="card"><h2>Первые 10 в каждом варианте</h2>
      <b>До</b><table><tbody>{r.oldShown.slice(0, 10).map(x => <Row key={x.co.id} x={x} old />)}</tbody></table>
      <b>После</b><table><tbody>{r.newShown.slice(0, 10).map(x => <Row key={x.co.id} x={x} />)}</tbody></table></div>
  </div>
}
