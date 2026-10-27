'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import DecisionView from './DecisionView'
import Journey from './Journey'
import CompareView from './CompareView'
import Funnel from './Funnel'
import { type St, type JAct, initial, setPreset, setUser, setOv, jAction } from './state'

const KEY = 'alfa-demo-v2'
type Tab = 'profile' | 'journey' | 'compare' | 'funnel'
const TABS: [Tab, string, string][] = [['profile', 'Решение', ' оптимизатора'], ['journey', 'Путь клиента', ''], ['compare', 'Два клиента', ''], ['funnel', 'Воронка', ' модели']]

// Сценарий демо: каждый шаг — чистое преобразование состояния; шаг i = шаги 0..i, применённые к чистому старту
const DEMO: { t: string; r: string; go?: (s: St) => St; tab?: Tab; hl: string }[] = [
  { t: 'Клиент А: торговля, группа компаний, финдиректор', r: 'Из CRM и договора собираем новые признаки: погашение через 5 мес., сезонная выручка, финансы группы централизованы, получатель — финдиректор группы. Внизу — как признаки поднимают ранг.', go: s => setPreset(s, 'A'), tab: 'profile', hl: '#result .pipe .step:nth-child(1)' },
  { t: 'Та же компания, но в интернет-банк зашёл казначей', r: 'Роль и право отправки берутся из профиля пользователя. Права нет → правило P01: расчёт готовится и передаётся финдиректору.', go: s => setUser(s, 'treas'), hl: '#result .pipe .step:nth-child(3)' },
  { t: 'Ситуация С2: появилась заявка на CAPEX', r: 'Продукт меняется: синдикат траншами рядом с кредитом, облигации — только консультация. Меняются текст и визуал.', go: s => setOv(setUser(s, 'cfo'), { segment: 'C2', stages: 3, amount: 1200 }), hl: '#result .offer' },
  { t: 'Цифровая активность низкая', r: 'Клиент работает через менеджера → первым звонит менеджер, push не шлём.', go: s => setOv(s, { activity: 'low' }), hl: '#result .timeline' },
  { t: 'Клиент нажал «Не сейчас»', r: 'Стоп-правило R02 сильнее остальных: пауза 90 дней во всех каналах с конкретной датой возврата.', go: s => setOv(s, { refusal: 'notnow' }), hl: '#result .pipe .step:nth-child(2)' },
  { t: 'Путь клиента: интернет-банк открыл бухгалтер дочки СтройГрада', r: 'Права отправки у него нет, поэтому главная кнопка — «Передать расчёт в головную компанию», а не «Отправить запрос».', go: s => setPreset(s, 'B'), tab: 'journey', hl: '#phone .blk' },
  { t: 'Бухгалтер передаёт расчёт', r: 'Запрос не уходит в банк: расчёт с суммой, сроком и вариантами ждёт проверки уполномоченного. Статус awaiting_review.', go: s => jAction(jAction(s, { a: 'cta', t: 'Передать' }), { a: 'handoff' }), hl: '#phone .blk' },
  { t: 'Входит финдиректор головной компании', r: 'У него есть право отправки. Переданный расчёт уже во входящих, параметры заполнены — остаётся открыть и отправить.', go: s => setUser(s, 'cfo'), hl: '#phone .hint' },
  { t: 'Воронка: 10 000 синтетических компаний', r: 'Сравниваем, кому уходят показы сегодня и после надстройки. Без пре-фильтра большая часть показов уходит компаниям без потребности или с отказом.', tab: 'funnel', hl: '#funnel .two .panel' },
]

export default function Page() {
  const [st, setSt] = useState<St>(initial)
  const [tab, setTab] = useState<Tab>('profile')
  const [ready, setReady] = useState(false)
  const [D, setD] = useState(-1)
  const scrolled = useRef(-1)

  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s?.v === 2) { setSt({ ...initial(), ...s.st }); if (s.tab) setTab(s.tab) } else if (s) localStorage.removeItem(KEY) } catch {}
    try { localStorage.removeItem('alfa-demo-v1') } catch {}
    setReady(true)
  }, [])
  useEffect(() => { if (ready) try { localStorage.setItem(KEY, JSON.stringify({ v: 2, st, tab })) } catch {} }, [ready, st, tab])

  const set = useCallback((o: Record<string, unknown>) => setSt(s => setOv(s, o)), [])
  const preset = useCallback((k: string) => setSt(s => setPreset(s, k)), [])
  const user = useCallback((id: string) => setSt(s => setUser(s, id)), [])
  const act = useCallback((x: JAct) => setSt(s => jAction(s, x)), [])

  // ----- сценарий демо -----
  const show = (i: number) => {
    let s = initial(), t: Tab = 'profile'
    for (let k = 0; k <= i; k++) { const step = DEMO[k]; if (step.go) s = step.go(s); if (step.tab) t = step.tab }
    setSt(s); setTab(t); setD(i)
  }
  const exit = () => { setD(-1); scrolled.current = -1; document.querySelectorAll('.demo-hl').forEach(n => n.classList.remove('demo-hl')); document.getElementById('demo-start')?.focus() }
  useEffect(() => {
    document.querySelectorAll('.demo-hl').forEach(n => n.classList.remove('demo-hl'))
    if (D < 0) return
    const el = document.querySelector(DEMO[D].hl) as HTMLElement | null
    if (!el) return
    el.classList.add('demo-hl')
    if (scrolled.current !== D) {
      scrolled.current = D
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView({ block: (innerWidth < 900 || el.offsetHeight > innerHeight * 0.55) ? 'start' : 'center', behavior: reduce ? 'auto' : 'smooth' })
    }
  })
  useEffect(() => {
    if (D < 0) return
    const k = (e: KeyboardEvent) => {
      if (/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)) return
      if (e.key === 'ArrowRight') { e.preventDefault(); if (D < DEMO.length - 1) show(D + 1) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); if (D > 0) show(D - 1) }
      else if (e.key === 'Escape') exit()
    }
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k)
  }, [D]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { document.body.classList.toggle('demo-on', D >= 0) }, [D])

  return <>
    <header><div className="wrap">
      <div className="brand"><b>Альфа-Навигатор финансирования</b><span>Кейс-школа Альфа-Будущего · Команда № 44 · прототип доработки ML-оптимизатора</span></div>
      <div className="hdr-r">
        <button type="button" className="demo-btn" id="demo-start" onClick={() => { show(0); setTimeout(() => document.getElementById('demo-next')?.focus(), 0) }}><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" /></svg>Сценарий демо</button>
        <span className="badge">Синтетические данные</span>
      </div>
    </div></header>
    <nav><div className="wrap" role="tablist">{TABS.map(([k, l, tail]) =>
      <button key={k} role="tab" id={`tab-${k}`} aria-controls={`view-${k}`} aria-selected={tab === k} onClick={() => setTab(k)}>{l}{tail && <span className="hide-sm">{tail}</span>}</button>)}</div></nav>
    <main><div className="wrap">
      {!ready ? <div className="loading">Загружаем демо…</div> : <section id={`view-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'profile' && <DecisionView st={st} set={set} preset={preset} user={user} />}
        {tab === 'journey' && <Journey st={st} act={act} preset={preset} user={user} />}
        {tab === 'compare' && <CompareView />}
        {tab === 'funnel' && <Funnel />}
      </section>}
    </div></main>
    {D >= 0 && <div className="demo" role="region" aria-label="Сценарий демо">
      <div aria-live="polite"><div className="k">Шаг {D + 1} из {DEMO.length}</div><div className="t">{DEMO[D].t}</div><div className="r">{DEMO[D].r}</div>
        <div className="dots">{DEMO.map((_, j) => <i key={j} className={j <= D ? 'on' : ''} />)}</div></div>
      <div className="dnav"><button type="button" disabled={D === 0} onClick={() => show(D - 1)}>Назад</button>
        <button type="button" className="primary" id="demo-next" onClick={() => D < DEMO.length - 1 ? show(D + 1) : exit()}>{D === DEMO.length - 1 ? 'Готово' : 'Далее'}</button>
        <button type="button" onClick={exit}>Выйти</button></div>
    </div>}
  </>
}
