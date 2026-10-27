'use client'
import { PROFILES } from '@/data/profiles'
import { buildCtx } from '@/lib/ctx'
import { decide } from '@/lib/decision'
import { fmt, TODAY, IND_L, ACT_L } from '@/lib/format'
import { OfferCard } from './ui'

const PAIRS: [string, string][] = [['A', 'cfo'], ['B', 'acc']]
const STRUCT: Record<string, string> = { solo: 'самостоятельная', group: 'группа, финансы централизованы', sub: 'дочка без полномочий' }

export default function CompareView() {
  return <>
    <p className="muted" style={{ margin: '0 0 14px' }}>Две компании среднего бизнеса (выручка от 500 млн ₽). Сегодня оптимизатор показал бы обеим один кредит по look-alike. С новыми признаками они получают разный продукт, текст, адресата, канал и частоту.</p>
    <div className="cmp" id="cmp">{PAIRS.map(([pid, uid]) => {
      const p = PROFILES[pid], u = p.users.find(x => x.id === uid)!, c = buildCtx(pid, uid)!, d = decide(c, TODAY)
      const rows: [string, React.ReactNode][] = [
        ['Ситуация', c.segment === 'C1' ? `Погашение через ${c.monthsToDue} мес., ${fmt(c.amount)} млн ₽` : `CAPEX ${fmt(c.amount)} млн ₽, ${c.stages} этапа`],
        ['Продукты', d.instruments.map(i => i.name + (i.status === 'consultation_only' ? ' (консультация)' : '')).join(' · ')],
        ['Текст', `«${d.message!.title}»`], ['Кому и кнопка', `${u.label} → «${d.cta[0]}»`], ['Действие', <span className="code">{d.action}</span>],
        ['Канал', d.channelPlan.steps[0].text], ['Частота', d.channelPlan.steps.filter(s => !s.muted).map(s => s.day).join(' → ')]]
      return <div key={pid} className="panel"><div className="col-h"><span className="tag now">{p.label}</span>{p.name}</div>
        <div className="small muted">{IND_L[c.industry]} · {u.label} · {STRUCT[c.structure]} · активность {ACT_L[c.activity]}</div>
        <div style={{ marginTop: 12 }}><OfferCard c={c} d={d} now={TODAY} /></div>
        <div className="tbl"><table className="cmp-table" style={{ marginTop: 12 }}><tbody>{rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table></div>
        <div className="small muted" style={{ marginTop: 8 }}><b>Было:</b> тот же баннер «Кредит для бизнеса на выгодных условиях» всем сотрудникам.</div></div>
    })}</div>
  </>
}
