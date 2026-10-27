'use client'
import { useEffect, useState } from 'react'
import { PROFILES } from '@/data/profiles'

const KEY = 'alfa-demo-v1', BASE = Date.parse('2026-10-27')
const OPT: Record<string, [string, string][]> = {
  segment: [['C1', 'С1 рефинансирование'], ['C2', 'С2 CAPEX']],
  activity: [['high', 'высокая'], ['mid', 'средняя'], ['low', 'низкая'], ['none', 'нет телеметрии']],
  need: [['confirmed', 'подтверждена'], ['unknown', 'неизвестна'], ['none', 'отсутствует']],
  cfa: [['confirmed', 'ЦФА подтверждены'], ['unknown', 'ЦФА unknown'], ['no', 'ЦФА не подходит']],
  refusal: [['none', 'нет отказа'], ['notnow', 'не сейчас'], ['tool', 'отказ от облигаций'], ['solved', 'задача решена'], ['unsub', 'отписка']],
}
const fmt = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 1 })
type Any = any

export default function Page() {
  const [pid, setPid] = useState('A'), [uid, setUid] = useState('cfo'), [ov, setOv] = useState<Any>({}), [ev, setEv] = useState({ backCount: 0, compareOpens: 0, idleSec: 0 })
  const [day, setDay] = useState(0), [mode, setMode] = useState<'after' | 'before'>('after'), [scr, setScr] = useState('home')
  const [res, setRes] = useState<Any>(null), [reqs, setReqs] = useState<Any>({}), [inbox, setInbox] = useState<Any>({})
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [ready, setReady] = useState(false), [panel, setPanel] = useState(true)
  const P = PROFILES[pid], U = P.users.find(u => u.id === uid) || P.users[0], need = `need-${pid}`
  const now = new Date(BASE + day * 864e5).toISOString().slice(0, 10)
  const eff = { ...P.ctx, ...ov }

  useEffect(() => { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s?.v === 1) { setPid(s.pid); setUid(s.uid); setOv(s.ov); setDay(s.day); setReqs(s.reqs); setInbox(s.inbox) } else if (s) localStorage.removeItem(KEY) } catch {} setReady(true) }, [])
  useEffect(() => { if (ready) try { localStorage.setItem(KEY, JSON.stringify({ v: 1, pid, uid, ov, day, reqs, inbox })) } catch {} }, [ready, pid, uid, ov, day, reqs, inbox])
  const load = () => {
    setErr('')
    fetch('/api/decision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileId: pid, userId: uid, overrides: ov, events: ev, requestSent: !!reqs[need], demoNow: now }) })
      .then(r => r.json()).then(d => d.error ? setErr(d.error) : setRes(d)).catch(() => setErr('Не удалось получить решение'))
  }
  useEffect(() => { if (ready) load() }, [ready, pid, uid, ov, ev, day, reqs]) // eslint-disable-line
  const pick = (p: string) => { setPid(p); setUid(PROFILES[p].users[0].id); setOv({}); setEv({ backCount: 0, compareOpens: 0, idleSec: 0 }); setScr('home') }
  const reset = () => { try { localStorage.removeItem(KEY) } catch {} setReqs({}); setInbox({}); setDay(0); pick('A') }
  const go = (s: string) => { if (s === 'compare') setEv(e => ({ ...e, compareOpens: e.compareOpens + 1 })); setScr(s) }
  const back = () => { setEv(e => ({ ...e, backCount: e.backCount + 1 })); setScr('home') }
  const setO = (k: string, v: Any) => setOv((o: Any) => ({ ...o, [k]: v }))

  const act = res?.action
  const send = async () => {
    if (busy) return; setBusy(true); setErr('')
    const requestId = `req-${need}`
    try {
      const r = await fetch('/api/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId, needId: need, profileId: pid, userId: uid, overrides: ov, amount: eff.amount, termMonths: eff.termMonths, instruments: res.instruments.map((i: Any) => i.id).filter((i: string) => res.instruments.find((x: Any) => x.id === i).status === 'allowed'), demoNow: now }) })
      const d = await r.json(); if (!r.ok) throw new Error(d.error)
      setReqs((q: Any) => ({ ...q, [need]: d })); setScr('status')
    } catch (e: Any) { setErr(e.message || 'Ошибка отправки. Введённые параметры сохранены — повторите.') } finally { setBusy(false) }
  }
  const handoff = () => { setInbox((i: Any) => ({ ...i, [need]: { from: U.label, status: 'awaiting_review' } })); setScr('handoff') }
  const ctaClick = (t: string) => t.startsWith('Передать') ? handoff() : t.startsWith('Обсудить') || t.startsWith('Уточнить') ? setScr('consult') : go(act === 'clarify_need' ? 'clarify' : 'compare')

  const Home = () => {
    if (mode === 'before') return <div className="card"><span className="tag">До · иллюстрация</span><h2>Кредит для бизнеса</h2><p className="mut">Один баннер всем сотрудникам компании.</p><button className="btn">Узнать больше</button><br /><small>Сравнение сценариев, а не копия закрытой системы банка.</small></div>
    if (!res) return <div className="card">Считаем…</div>
    if (act === 'suppress_marketing') return <div className="card mut">Предложений по финансированию сейчас нет. <button className="link" onClick={() => go('compare')}>Рассчитать самостоятельно</button></div>
    if (act === 'show_request_status') return <div className="card"><h2>Запрос {reqs[need]?.number}</h2><p>Статус: передано специалисту в демо</p></div>
    if (act === 'clarify_need') return <div className="card"><h2>Планируете привлекать финансирование?</h2><button className="btn" onClick={() => { setO('need', 'confirmed'); }}>Да</button><button className="btn sec" onClick={() => setO('need', 'none')}>Погасим сами</button><button className="btn sec">Пока не решили</button></div>
    const m = res.message
    return <div className="card"><span className="tag">Индивидуальное предложение · учебное демо</span><h2>{m.title}</h2><p className="mut">{m.sub}</p>
      {inbox[need] && U.canSend && <div className="hint">Входящее: расчёт передан от «{inbox[need].from}». Подтвердите продолжение.</div>}
      {res.cta.map((t: string, i: number) => <button key={t} className={'btn' + (i ? ' sec' : '')} onClick={() => ctaClick(t)}>{t}</button>)}
      <button className="link" onClick={() => setO('refusal', 'notnow')}>Неактуально</button><br /><small>{m.why}</small>
      {res.journeyHint && <div className="hint">💡 {res.journeyHint}</div>}</div>
  }
  const Clarify = () => <div className="card"><h2>Планируете продолжить финансирование?</h2>
    {[['Да', () => go('compare')], ['Погасим сами', () => { setO('refusal', 'solved'); setScr('home') }], ['Пока не решили', () => setScr('home')]].map(([t, f]: Any) => <button key={t} className="btn sec" onClick={f}>{t}</button>)}</div>
  const Compare = () => !res?.instruments?.length ? <div className="card">Нет допустимых вариантов. <button className="link" onClick={back}>Назад</button></div> : <div className="card"><h2>Сравнение вариантов</h2>
    <table><thead><tr><th>Вариант</th><th>Условные расходы*</th><th>Почему</th></tr></thead><tbody>{res.instruments.map((i: Any) => <tr key={i.id}><td><b>{i.name}</b>{i.status === 'consultation_only' && <div className="tag">консультация</div>}</td><td>{i.cost != null ? fmt(i.cost) + ' млн ₽' : 'Определит специалист'}</td><td>{i.reason}</td></tr>)}</tbody></table>
    <small>*Тестовые ставки {19}% / {16}%: сумма × ставка × срок/12 + разовые. Не экономия и не оферта.</small>
    <details><summary>Почему не показаны другие</summary>{res.excluded.map((i: Any) => <div key={i.id} className="rule">{i.name}: {i.reason} ({i.ruleId})</div>)}</details>
    <p><button className="btn" onClick={() => setScr('request')}>Подготовить запрос</button><button className="btn sec" onClick={back}>Назад</button><button className="link" onClick={() => go('compare')}>Открыть сравнение ещё раз</button></p></div>
  const Request = () => <div className="card"><h2>Запрос специалисту</h2>
    <p>Компания: <b>{P.name.slice(4)}</b> · Получатель: <b>{res?.recipient}</b><br />Сумма: {fmt(eff.amount)} млн ₽ · срок {eff.termMonths} мес.{eff.segment === 'C2' && ` · этапов: ${eff.stages}`}<br />Инструменты: {res?.instruments.filter((i: Any) => i.status === 'allowed').map((i: Any) => i.name).join(', ')}</p>
    <small>Передаются: цель, сумма, срок, выбранные варианты.</small>
    <p>{U.canSend ? <button className="btn" disabled={busy} onClick={send}>{busy ? 'Отправка…' : 'Отправить специалисту'}</button> : <button className="btn" onClick={handoff}>Подготовить и передать руководителю</button>}<button className="btn sec" onClick={() => setScr('compare')}>Назад</button></p>
    {err && <div className="err">{err} <button className="link" onClick={send}>Повторить</button></div>}</div>
  const Msg = ({ t, s }: { t: string; s: string }) => <div className="card"><h2>{t}</h2><p>{s}</p><button className="btn sec" onClick={() => setScr('home')}>На главную</button></div>

  return <div className="wrap"><div>
    <div className="card top"><span><b>Альфа</b>-Бизнес · {P.name.slice(4)}</span><span className="tag">учебное демо, данные вымышлены</span></div>
    <div className="card"><div className="mut">Счета · Платежи · Дела в работе · Предложения</div></div>
    {err && scr === 'home' && <div className="err">{err} <button className="link" onClick={load}>Повторить</button></div>}
    {scr === 'home' && <Home />}{scr === 'clarify' && <Clarify />}{scr === 'compare' && <Compare />}{scr === 'request' && <Request />}
    {scr === 'status' && <Msg t={`Запрос ${reqs[need]?.number}`} s="Передано специалисту в демо. Рекламное предложение по этой потребности скрыто." />}
    {scr === 'handoff' && <Msg t="Расчёт передан" s="Статус awaiting_review. Переключитесь на пользователя с правом отправки в панели «Демо» — те же параметры откроются у него." />}
    {scr === 'consult' && <Msg t="Консультация" s="Специалист свяжется с вами. Расчёт не является офертой." />}
  </div>
  <div className="card panel"><b>Панель «Демо»</b> <button className="link" onClick={() => setPanel(!panel)}>{panel ? 'свернуть' : 'развернуть'}</button>
    {panel && <><p>{Object.values(PROFILES).map(p => <span key={p.id} className={'pill' + (p.id === pid ? ' on' : '')} onClick={() => pick(p.id)}>{p.name}</span>)}</p>
      <div>Пользователь: {P.users.map(u => <span key={u.id} className={'pill' + (u.id === uid ? ' on' : '')} onClick={() => setUid(u.id)}>{u.label}{u.canSend ? '' : ' (без права отправки)'}</span>)}</div>
      <p>Режим: {(['before', 'after'] as const).map(m => <span key={m} className={'pill' + (m === mode ? ' on' : '')} onClick={() => setMode(m)}>{m === 'before' ? 'До' : 'После'}</span>)}</p>
      {Object.keys(OPT).map(k => <select key={k} value={eff[k]} onChange={e => setO(k, e.target.value)}>{OPT[k].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>)}
      <label>Мес. до погашения <input type="number" value={eff.monthsToDue ?? ''} onChange={e => setO('monthsToDue', e.target.value === '' ? null : +e.target.value)} /></label>
      <label>Сумма, млн ₽ <input type="number" value={eff.amount} onChange={e => setO('amount', +e.target.value)} /></label>
      <label>Новый срок, мес. <input type="number" value={eff.termMonths} onChange={e => setO('termMonths', +e.target.value)} /></label>
      <p><button className="btn sec" onClick={() => setDay(d => d + 2)}>Прошло 2 дня (сейчас {now})</button><button className="btn sec" onClick={() => setEv(e => ({ ...e, idleSec: 45 }))}>Пауза 45 с</button><button className="btn sec" onClick={reset}>Сбросить демо</button></p>
      {res && <><b>Решение ({res.source}, {res.rulesVersion}): {res.action}</b>{res.reasonCodes.map((r: Any, i: number) => <div key={i} className={'rule' + (/^(E01|E02|E04|R|S)/.test(r.ruleId) ? ' stop' : '')}><b>{r.ruleId}</b> {r.text} <small>[{r.fact}]</small></div>)}
        <p>Канал: {res.channelPlan.first}{res.channelPlan.followUp && ' → ' + res.channelPlan.followUp}<br />{res.channelPlan.blocked || res.channelPlan.emailBlocked}<br />Ближайшая дата: {res.nextEligibleAt} · {res.channelPlan.dailyLimit}</p>
        <small>Тестовые оценки (mock, не вероятности): {res.instruments.map((i: Any) => `${i.id} ${i.mockScore}`).join(', ')}</small></>}</>}</div></div>
}
