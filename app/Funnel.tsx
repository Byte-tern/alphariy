'use client'
import { useMemo } from 'react'
import { run } from '@/lib/funnel'
import { CFG, MOCK_SCORES as MOCK } from '@/lib/config'
import { fmtInt, IND_L, ROLE_L } from '@/lib/format'
import { Icon } from './ui'

const LBL = { need: 'нет подтверждённой потребности', stop: 'отказ или запрос уже отправлен', alt: 'нет альтернативы кредиту', role: 'роль неизвестна', limit: 'лимит контактов исчерпан' } as const
const pct = (a: number, b: number) => (100 * a / b).toFixed(1).replace('.', ',') + '%'
const NEXT = ['Нейро-ранкер на 3-й стадии вместо ручных весов', 'Граф структуры группы и эмбеддинги связей', 'Псевдо-метки для редких целевых событий', 'Холодный старт: контентные признаки, если истории нет', 'A/B: компания как единица сплита, ≥ 30 дней, MDE до старта']

export default function Funnel() {
  const r = useMemo(() => run(), [])
  const { n, K, oldBreak: ob } = r
  const cfg: [string, string | number][] = [['Окно рефинансирования', `${CFG.refiMin}–${CFG.refiMax} мес.`], ['Облигации: сумма от', `${CFG.bondMinAmount} млн ₽`], ['Облигации: срок от', `${CFG.bondMinTerm} мес.`], ['Подготовка выпуска', `${CFG.bondPrepMonths} мес.`], ['Синдикат: сумма от', `${fmtInt(CFG.syndAmount)} млн ₽`], ['Синдикат: этапов от', CFG.syndStages], ['Ставка кредита', `${Math.round(CFG.rate.loan * 100)}%`], ['Ставка облигаций', `${Math.round(CFG.rate.bonds * 100)}%`], ['Разовые расходы выпуска', `${CFG.bondFee} млн ₽`], ['Контактов за 30 дней', `≤ ${CFG.maxContacts30}`], ['Email', `≤ 1 в ${CFG.emailGapDays} дней`], ['Пауза после «Не сейчас»', `${CFG.notNowDays} дней`], ['Подсказка: возвратов назад', CFG.backThreshold], ['Подсказка: пауза', `${CFG.idleSec} с`], ['Mock-скоры', `кредит ${MOCK.loan} · облигации ${MOCK.bonds} · синдикат ${MOCK.synd} · ЦФА ${MOCK.cfa}`]]
  return <div className="stack" id="funnel">
    <div className="panel"><div className="col-h"><span className="tag newst">Синтетическая симуляция · {fmtInt(n)} вымышленных компаний</span></div>
      <h2>Архитектура модели: 5 стадий</h2>
      <p className="muted small" style={{ margin: '0 0 12px', maxWidth: '72ch' }}>Действующий оптимизатор в демо — заглушка: look-alike-скор по старым признакам. Наша надстройка: пре-фильтр до модели, веса новых сигналов в ранжировании, выбор инструмента и пост-фильтр. Числа зависят от допущений генератора и не являются оценкой эффекта.</p>
      <div className="stack" style={{ gap: 10 }}>{r.stages.map(s => <div key={s.id} className="fstage">
        <div className="h"><span>{s.id}. {s.title} <span className={'tag ' + (s.isNew ? 'newst' : 'oldst')}>{s.isNew ? 'новое' : 'действующее'}</span></span><b>{fmtInt(s.inN)} → {fmtInt(s.outN)}</b></div>
        <div className="fbar"><span style={{ width: `${100 * s.outN / n}%`, background: s.isNew ? 'var(--red)' : 'var(--ink-3)' }} /></div>
        <div className="small muted"><b>Модель:</b> {s.model} · <b>Признаки:</b> {s.features} · <b>Правила:</b> {s.rules}</div></div>)}</div>
      <p className="small" style={{ margin: '12px 0 0' }}><b>Выдача:</b> топ-{fmtInt(K)} по итоговому рангу. Скор не отменяет запрет: ранжируем только допустимое.</p></div>
    <div className="two">
      <div className="panel"><h2>До и после: кому ушли {fmtInt(K)} показов</h2>
        <div className="tbl"><table style={{ marginTop: 8 }}><thead><tr><th></th><th className="n">До: топ по скору</th><th className="n">После</th></tr></thead><tbody>
          <tr><td><b>Релевантные показы</b></td><td className="n"><b>{pct(ob.ok, K)}</b></td><td className="n"><b>{pct(r.newShown.length, K)}</b></td></tr>
          {(Object.keys(LBL) as (keyof typeof LBL)[]).map(k => <tr key={k}><td className="muted">{LBL[k]}</td><td className="n">{fmtInt(ob[k])} · {pct(ob[k], K)}</td><td className="n">0</td></tr>)}
          <tr><td>С альтернативой кредиту</td><td className="n">0</td><td className="n">{pct(r.nonLoan, K)}</td></tr>
          <tr><td>Через передачу уполномоченному</td><td className="n">—</td><td className="n">{pct(r.routed, K)}</td></tr></tbody></table></div>
        <p className="small muted" style={{ margin: '8px 0 0' }}>«После» = 100% релевантных по построению правил. Реальный эффект покажет только A/B.</p></div>
      <div className="panel"><h2>Решение не финальное: следующие шаги</h2>{NEXT.map(t => <div key={t} className="rule"><span className="ico route"><Icon k="route" /></span><span>{t}</span></div>)}</div>
    </div>
    <div className="panel"><h2>Почему именно им: топ-10 после</h2><p className="small muted" style={{ margin: 0 }}>Ранг = сумма вкладов признаков. Для каждой компании видно вклад каждого и сработавшие правила.</p>
      <div className="tbl"><table style={{ marginTop: 8 }}><thead><tr><th>Компания</th><th>Предложение и адресат</th><th className="n">Ранг</th><th>Вклады</th><th>Правила</th></tr></thead><tbody>
        {r.newShown.slice(0, 10).map(x => <tr key={x.co.id}><td>#{x.co.id}<br /><small className="muted">{x.co.ctx.segment} · {IND_L[x.co.ctx.industry]} · {ROLE_L[x.co.ctx.role]}</small></td>
          <td>{x.d!.instruments.map(i => i.name.split(',')[0]).join(' + ')}<br /><small className="muted">{x.d!.recipient}</small></td>
          <td className="n"><b>{x.rank.score.toFixed(2)}</b></td><td><small>{x.rank.parts.map(([l, v]) => `${l} ${v.toFixed(2)}`).join(' · ')}</small></td>
          <td><small>{x.d!.reasonCodes.map(c => c.ruleId).join(', ')}</small></td></tr>)}</tbody></table></div></div>
    <div className="panel"><h2>Допущения демо</h2><p className="small muted" style={{ margin: '0 0 10px' }}>Пороги и ставки — допущения команды, не критерии Альфа-Банка. Меняются в одном месте после ответов эксперта. Версия правил {CFG.rulesVersion}.</p>
      <div className="cfg">{cfg.map(([k, v]) => <div key={k}><span className="muted">{k}</span><b>{v}</b></div>)}</div></div>
  </div>
}
