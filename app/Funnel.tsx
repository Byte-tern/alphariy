'use client'
import { useMemo } from 'react'
import { run } from '@/lib/funnel'

const LBL: Record<string, string> = { need: 'нет подтверждённой потребности', stop: 'отказ или запрос уже отправлен', alt: 'нет альтернативы кредиту', role: 'роль неизвестна', limit: 'лимит контактов', ok: 'релевантный показ' }
const pct = (a: number, b: number) => (100 * a / b).toFixed(1).replace('.', ',') + '%'
const f = (x: number) => x.toLocaleString('ru-RU')
const NEXT = ['Нейро-ранкер (3-я стадия) вместо ручных весов', 'Граф структуры группы и эмбеддинги связей', 'Псевдо-метки для редких целевых событий', 'Холодный старт: контентные признаки, если истории нет', 'A/B: компании как единица сплита, ≥ 30 дней, MDE до старта']

export default function Funnel() {
  const r = useMemo(() => run(), [])
  const { n, K, oldBreak: ob } = r
  return <div>
    <div className="card"><span className="tag">Синтетическая симуляция · {f(n)} вымышленных компаний</span>
      <h2>Архитектура модели: 5 стадий</h2>
      <p className="mut">Действующий оптимизатор в демо представлен заглушкой (look-alike-скор по старым признакам). Наша надстройка: пре-фильтр до модели, ручные веса новых сигналов в ранжировании, выбор инструмента и пост-фильтр. Числа зависят от допущений генератора и не являются оценкой эффекта.</p>
      {r.stages.map(s => <div key={s.id} style={{ margin: '10px 0', padding: 10, border: '1px solid #eee', borderRadius: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>{s.id}. {s.title} {s.isNew ? <span className="tag">новое</span> : <span className="tag" style={{ background: '#eee', color: '#555' }}>действующее</span>}</b><b>{f(s.inN)} → {f(s.outN)}</b></div>
        <div style={{ background: '#eee', borderRadius: 6, margin: '6px 0' }}><div style={{ width: pct(s.outN, n), background: s.isNew ? '#ef3124' : '#888', height: 8, borderRadius: 6 }} /></div>
        <small><b>Модель:</b> {s.model}<br /><b>Признаки:</b> {s.features}<br /><b>Правила:</b> {s.rules}</small></div>)}
      <b>Выдача:</b> топ-{f(K)} по итоговому рангу. Скор не отменяет запрет: ранжируем только допустимое.</div>
    <div className="card"><h2>До против после (показано {f(K)} компаниям)</h2>
      <table><thead><tr><th></th><th>До: топ по скору</th><th>После: топ допустимых</th></tr></thead><tbody>
        <tr><td>Релевантные показы</td><td><b>{pct(ob.ok, K)}</b></td><td><b>{pct(r.newShown.length, K)}</b> <small>по построению правил</small></td></tr>
        {(['need', 'stop', 'alt', 'role', 'limit'] as const).map(k => <tr key={k}><td className="mut">{LBL[k]}</td><td>{ob[k]} ({pct(ob[k], K)})</td><td>0</td></tr>)}
        <tr><td>С альтернативой кредиту</td><td>0</td><td>{pct(r.nonLoan, K)}</td></tr>
        <tr><td>Через передачу уполномоченному</td><td>—</td><td>{pct(r.routed, K)}</td></tr></tbody></table></div>
    <div className="card"><h2>Почему именно им: топ-10 после</h2>
      <small>Ранг = сумма вкладов признаков (ручные веса). Для каждой компании — вклад каждого и правила, которые сработали.</small>
      <table><thead><tr><th>Компания</th><th>Предложение</th><th>Ранг и вклады</th><th>Правила</th></tr></thead><tbody>
        {r.newShown.slice(0, 10).map(x => <tr key={x.co.id}><td>#{x.co.id}<br /><small>{x.co.ctx.segment} · {x.co.ctx.industry} · {x.co.ctx.role}</small></td>
          <td>{x.d!.instruments.map(i => i.name.split(' ')[0]).join(' + ')}<br /><small>{x.d!.recipient}</small></td>
          <td><b>{x.rank.score.toFixed(2)}</b><br /><small>{x.rank.parts.map(([l, v]) => `${l.split(' (')[0]} ${v.toFixed(2)}`).join(' · ')}</small></td>
          <td><small>{x.d!.reasonCodes.map(c => c.ruleId).join(', ')}</small></td></tr>)}</tbody></table></div>
    <div className="card"><h2>Решение не финальное: следующие шаги</h2>{NEXT.map(t => <div key={t} className="rule">• {t}</div>)}</div>
  </div>
}
