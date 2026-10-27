'use client'
import type { ReactNode } from 'react'
import type { Ctx, Decision } from '@/lib/decision'
import { CFG } from '@/lib/config'
import { fmt, plural } from '@/lib/format'

const PATHS = { ok: 'M20 6 9 17l-5-5', stop: 'M18 6 6 18M6 6l12 12', route: 'M7 17 17 7M8 7h9v9', off: 'M6 12h12' }
export type IconK = keyof typeof PATHS
export const Icon = ({ k, w = 13 }: { k: IconK; w?: number }) =>
  <svg viewBox="0 0 24 24" width={w} height={w} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PATHS[k]} /></svg>

export function Chips<T extends string | number>({ opts, value, onPick, idp }: { opts: [T, string][]; value: unknown; onPick: (v: T) => void; idp: string }) {
  return <div className="chips" role="group">{opts.map(([v, t]) =>
    <button key={String(v)} type="button" className="chip" id={`c-${idp}-${v}`} aria-pressed={String(value) === String(v)} onClick={() => onPick(v)}>{t}</button>)}</div>
}

const RED = '#EF3124', INK = '#121214', G = '#C9C8C4'
const T = ({ x, y, children, fs = 8, a = 'start', c = INK, w = 500 }: { x: number; y: number; children: ReactNode; fs?: number; a?: 'start' | 'middle' | 'end'; c?: string; w?: number }) =>
  <text x={x} y={y} fontSize={fs} textAnchor={a} fill={c} fontFamily="Golos Text, Arial, sans-serif" fontWeight={w}>{children}</text>
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']

// Отраслевая визуализация в карточке предложения
export function Visual({ c, d, now }: { c: Ctx; d: Decision; now: string }) {
  const isC1 = c.segment === 'C1'
  let svg: ReactNode, cap: ReactNode
  if (c.industry === 'trade') {
    const v = [4, 5, 6, 9, 10, 7, 5, 4, 6, 9, 11, 8], M = 'ЯФМАМИИАСОНД', cur = new Date(Date.parse(now)).getUTCMonth()
    const due = isC1 ? (cur + (c.monthsToDue || 0)) % 12 : cur
    svg = <svg viewBox="0 0 156 82" role="img" aria-label={`Выручка по месяцам, выделен ${MONTHS[due]}`}>{v.map((x, i) => <g key={i}>
      <rect x={6 + i * 12} y={68 - x * 4.6} width={9} height={x * 4.6} rx={2} fill={i === due ? RED : G} />
      <T x={10.5 + i * 12} y={79} fs={7} a="middle" c={i === due ? RED : '#54545C'} w={i === due ? 700 : 500}>{M[i]}</T></g>)}</svg>
    cap = <>{isC1 ? 'Сезон выручки · погашение: ' : 'Сезон выручки · старт проекта: '}<b>{MONTHS[due]}</b></>
  } else if (c.industry === 'constr') {
    const n = isC1 ? 3 : Math.max(1, c.stages), w = 144 / n
    svg = <svg viewBox="0 0 156 80" role="img" aria-label="Этапы проекта и транши"><T x={6} y={20}>{isC1 ? 'этапы стройки' : 'транши по этапам'}</T>
      {Array.from({ length: n }, (_, i) => <g key={i}><rect x={6 + i * w} y={30} width={w - 4} height={20} rx={4} fill={i === 0 ? RED : G} /><T x={6 + i * w + (w - 4) / 2} y={44} fs={10} a="middle" c={i === 0 ? '#fff' : INK} w={700}>{i + 1}</T></g>)}
      <path d="M6 62 H150" stroke={G} strokeWidth={2} /><T x={6} y={74} fs={7} c="#54545C">старт</T><T x={150} y={74} fs={7} a="end" c="#54545C">сдача</T></svg>
    cap = isC1 ? 'Транши под этапы стройки' : <><b>{n}</b> {plural(n, 'транш', 'транша', 'траншей')} по ~<b>{fmt(Math.round(c.amount / n))}</b> млн ₽</>
  } else if (c.industry === 'manuf') {
    const pay = 42, dm = isC1 ? (c.monthsToDue || 0) : c.termMonths, sc = 144 / Math.max(48, dm)
    svg = <svg viewBox="0 0 156 80" role="img" aria-label={`Срок долга ${dm} мес., окупаемость ${pay} мес.`}>
      <T x={6} y={16}>{`${isC1 ? 'до погашения' : 'срок долга'} · ${dm} мес.`}</T><rect x={6} y={20} width={Math.max(6, dm * sc)} height={14} rx={4} fill={RED} />
      <T x={6} y={50}>{`окупаемость · ${pay} мес.`}</T><rect x={6} y={54} width={pay * sc} height={14} rx={4} fill={G} /></svg>
    cap = dm < pay ? <>Долг короче окупаемости: <b>нужен длинный</b></> : 'Сроки совпадают'
  } else {
    const has = (id: string) => d.instruments.some(i => i.id === id)
    const sy = has('synd') ? Math.min(50, Math.round(c.amount / 100)) : 0, bo = has('bonds') ? (isC1 ? 40 : 25) : 0, cf = has('cfa') ? 15 : 0, cr = 100 - sy - bo - cf
    const parts = ([['кредит', cr, G], ['облигации', bo, RED], ['синдикат', sy, '#8C8C94'], ['ЦФА', cf, '#C8231A']] as [string, number, string][]).filter(p => p[1] > 0)
    let x = 6
    svg = <svg viewBox="0 0 156 80" role="img" aria-label={`Структура финансирования: ${parts.map(p => p[0] + ' ' + p[1] + '%').join(', ')}`}>
      <T x={6} y={18}>структура финансирования, пример</T>
      {parts.map(([n, v, col]) => { const w = 144 * v / 100, x0 = x; x += w; return <g key={n}><rect x={x0} y={26} width={w} height={24} fill={col} />{w >= 26 && <><T x={x0 + w / 2} y={64} a="middle">{n}</T><T x={x0 + w / 2} y={74} a="middle" w={700}>{v + '%'}</T></>}</g> })}</svg>
    cap = isC1 ? 'Микс источников рефинансирования' : <>Проект <b>{fmt(c.amount)}</b> млн ₽: микс источников</>
  }
  return <div className="visual">{svg}<small>{cap}</small></div>
}

// Карточка персонального предложения (интернет-банк)
export function OfferCard({ c, d, now, onRefuse }: { c: Ctx; d: Decision; now: string; onRefuse?: (v: 'notnow' | 'unsub') => void }) {
  const nums = d.instruments.map(i => i.cost).filter((v): v is number => v != null)
  const minV = Math.min(...nums), gap = nums.length > 1 ? Math.max(...nums) - minV : 0
  const [c1, ...rest] = d.cta
  return <div className="offer">
    <div style={{ minWidth: 0 }}>
      <span className="pill">Индивидуальное предложение</span>
      <h4>{d.message!.title}</h4>
      <div className="muted small">{d.message!.sub}</div>
      <div className="opts">{d.instruments.map(i => <div key={i.id} className={'opt' + (i.cost != null && i.cost === minV && nums.length > 1 ? ' best' : '')}>
        <span>{i.name}{i.id === 'loan' && <span className="ghost"> · база</span>}{i.status === 'consultation_only' && <> <span className="tag cons">консультация</span></>}</span>
        <span className="ov">{i.cost != null ? <><small>расходы</small> <b>{fmt(i.cost)}</b> млн ₽</> : 'расчёт у специалиста'}</span></div>)}</div>
      {gap > 0 && <div className="loss">Разница в условных расходах: до {fmt(gap)} млн ₽</div>}
      <div className="why">{d.message!.why} · <u>Настроить предложения</u></div>
      <div className="ctas"><span className="btn red">{c1}</span>{rest.map(r => <span key={r} className="link">{r}</span>)}</div>
      <div className="ctas" style={{ marginTop: 4 }}>{onRefuse
        ? <><button type="button" className="linkbtn" onClick={() => onRefuse('notnow')}>Не сейчас</button><span className="ghost">·</span><button type="button" className="linkbtn" onClick={() => onRefuse('unsub')}>Неактуально</button></>
        : <span className="ghost">Не сейчас · Неактуально</span>}</div>
      <div className="disc">Расходы условные: сумма × ставка × срок/12 + разовые (ставки демо {Math.round(CFG.rate.loan * 100)}% / {Math.round(CFG.rate.bonds * 100)}%). Не оферта, одобрение и ставку не обещаем.</div>
    </div>
    <Visual c={c} d={d} now={now} />
  </div>
}
