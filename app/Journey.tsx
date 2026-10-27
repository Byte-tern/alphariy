'use client'
import { useState } from 'react'
import { PROFILES } from '@/data/profiles'
import { CFG } from '@/lib/config'
import { fmt, ruDate, ACT_L } from '@/lib/format'
import { type St, type JAct, ctxOf, decisionOf, nowOf, userOf, needOf, pushAllowed } from './state'

const SCR = [['home', 'Главная'], ['clarify', 'Уточнение'], ['compare', 'Сравнение'], ['request', 'Запрос'], ['status', 'Статус'], ['handoff', 'Передано'], ['consult', 'Специалист']]

export default function Journey({ st, act, preset, user }: { st: St; act: (x: JAct) => void; preset: (k: string) => void; user: (id: string) => void }) {
  const [busy, setBusy] = useState(false), [err, setErr] = useState('')
  const c = ctxOf(st), d = decisionOf(st), p = PROFILES[st.pid], u = userOf(st), j = st.j, now = nowOf(st), isC1 = c.segment === 'C1', need = needOf(st)
  const allowed = d.instruments.filter(i => i.status === 'allowed')
  const go = (s: string) => { setErr(''); act({ a: 'go', s }) }

  // Отправка идёт через API: сервер заново проверяет права и применимость инструментов
  const send = async () => {
    if (busy) return
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: `req-${need}`, needId: need, profileId: st.pid, userId: u.id, overrides: st.ov, amount: c.amount, termMonths: c.termMonths, instruments: allowed.map(i => i.id), demoNow: now }) })
      const b = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(b.error || 'Ошибка отправки')
      act({ a: 'sent', req: b })
    } catch (e: unknown) { setErr((e as Error).message || 'Ошибка отправки. Введённые параметры сохранены — повторите.') } finally { setBusy(false) }
  }

  const Close = ({ k }: { k: string }) => <button type="button" className="linkbtn" onClick={() => act({ a: 'close', k })}>{k === 'back' ? 'Вернуть как было' : 'Закрыть'}</button>
  let push = null
  if (j.draft && j.day >= 1 && j.scr !== 'request' && d.action !== 'show_request_status')
    push = pushAllowed(c, d.channelPlan.blocked)
      ? <button type="button" className="push" onClick={() => act({ a: 'openpush' })}><b>Альфа-Бизнес</b> · Расчёт сохранён. Осталось 2 шага<small>Push без суммы, один раз на цепочку</small></button>
      : <div className="hint"><b>Push не шлём:</b> {c.activity === 'low' ? 'клиент работает через менеджера, черновик видит менеджер' : 'действует пауза, отписка или лимит контактов'}. Расчёт сохранён в разделе кредитов.</div>
  const inbox = st.inbox[need] && u.canSend && d.action !== 'show_request_status' ? <div className="hint">Входящее: расчёт передан от «{st.inbox[need].from}». Параметры уже заполнены. <button type="button" className="linkbtn" onClick={() => go('compare')}>Открыть</button></div> : null
  const idleHint = c.idleSec >= CFG.idleSec && !j.closed.idle && c.refusal !== 'unsub' && ['home', 'compare'].includes(j.scr) ? <div className="hint">Выбираете между вариантами? Специалист ответит в чате. <u>Спросить специалиста</u> <Close k="idle" /></div> : null
  const Home = () => <button type="button" className="btn" onClick={() => go('home')}>На главную</button>

  let body
  if (j.scr === 'home') {
    if (d.action === 'suppress_marketing') body = <><div className="blk"><h5>Кредиты</h5><div className="small muted">Предложений по финансированию сейчас нет.</div><div className="ctas"><button type="button" className="linkbtn" onClick={() => go('compare')}>Рассчитать самостоятельно</button></div></div><div className="small muted">{d.blockedText}</div></>
    else if (d.action === 'show_request_status') body = <div className="blk hl"><h5>Запрос {st.reqs[need]?.number}</h5><div className="small">Статус: передан специалисту. Рекламное предложение по этой потребности скрыто.</div></div>
    else if (d.action === 'clarify_need') body = <div className="blk"><h5>{isC1 ? 'Планируете привлекать финансирование после погашения?' : 'Подтвердите параметры проекта'}</h5><div className="pbtns">
      <button type="button" className="btn red" onClick={() => act({ a: 'need', v: 'confirmed' })}>Да</button><button type="button" className="btn" onClick={() => act({ a: 'need', v: 'none' })}>Погасим сами</button><button type="button" className="btn" onClick={() => act({ a: 'need', v: 'later' })}>Пока не решили</button></div></div>
    else body = <div className="blk"><span className="pill">Индивидуальное предложение</span><h5 style={{ marginTop: 8 }}>{d.message!.title}</h5><div className="small muted">{d.message!.sub}</div>
      <div className="pbtns" style={{ marginTop: 10 }}>{d.cta.map((t, i) => <button key={t} type="button" className={'btn' + (i ? '' : ' red')} onClick={() => { setErr(''); act({ a: 'cta', t }) }}>{t}</button>)}</div>
      <div className="ctas" style={{ marginTop: 6 }}><button type="button" className="linkbtn" onClick={() => act({ a: 'refuse', v: 'notnow' })}>Не сейчас</button><button type="button" className="linkbtn" onClick={() => act({ a: 'refuse', v: 'unsub' })}>Неактуально</button></div>
      <div className="why">{d.message!.why}</div></div>
  } else if (j.scr === 'clarify') body = <div className="blk"><h5>Планируете продолжить финансирование?</h5><div className="pbtns"><button type="button" className="btn red" onClick={() => act({ a: 'need', v: 'confirmed' })}>Да</button><button type="button" className="btn" onClick={() => act({ a: 'need', v: 'none' })}>Погасим сами</button></div></div>
  else if (j.scr === 'compare') {
    if (!d.instruments.length) body = <><div className="blk"><h5>Калькулятор</h5><div className="small muted">Введите сумму и срок, чтобы посчитать кредит. Рекламных предложений сейчас нет.</div></div><button type="button" className="btn" onClick={() => act({ a: 'back' })}>Назад</button></>
    else {
      const nums = d.instruments.map(i => i.cost).filter((v): v is number => v != null), minV = Math.min(...nums)
      const canAct = d.action === 'show_comparison' || d.action === 'route_to_authorized_user'
      body = <>
        {c.backCount >= CFG.backThreshold && !j.closed.back && <div className="blk hl"><h5>Коротко: чем отличаются варианты</h5><div className="small">1. Стоимость · 2. Срок подготовки · 3. Требования к компании</div><div className="small" style={{ marginTop: 6 }}>Подняли наверх, потому что вы дважды вернулись назад. <Close k="back" /></div></div>}
        {c.compareOpens >= CFG.compareThreshold && !j.closed.compare && <div className="hint">Вы уже сравнивали варианты. Расчёт сохранён, можно запросить индивидуальную оценку. <Close k="compare" /></div>}
        <div className="blk"><h5>Сравнение вариантов</h5><div className="tbl"><table><tbody>{d.instruments.map(i => <tr key={i.id}><td><b>{i.name}</b>{i.status === 'consultation_only' && <><br /><span className="tag cons">консультация</span></>}<div className="small muted">{i.reason}</div></td>
          <td className="n">{i.cost != null ? <><b style={{ color: i.cost === minV && nums.length > 1 ? 'var(--good)' : 'inherit' }}>{fmt(i.cost)}</b> млн ₽</> : 'у специалиста'}</td></tr>)}</tbody></table></div>
          <details className="excl"><summary>Почему не показаны другие</summary>{d.excluded.map(i => <div key={i.id}>{i.name}: {i.reason}</div>)}</details></div>
        <div className="pbtns">{canAct ? <button type="button" className="btn red" onClick={() => go('request')}>{c.canSend ? 'Подготовить запрос' : 'Подготовить расчёт для передачи'}</button> : <button type="button" className="btn red" onClick={() => go('consult')}>Обсудить со специалистом</button>}
          <button type="button" className="btn" onClick={() => act({ a: 'back' })}>Назад</button><button type="button" className="linkbtn" onClick={() => go('compare')}>Открыть сравнение ещё раз</button></div>
      </>
    }
  } else if (j.scr === 'request') body = <>
    <div className="blk"><h5>{c.canSend ? 'Запрос специалисту' : 'Расчёт для уполномоченного'}</h5><dl className="kv"><dt>Компания</dt><dd>{p.name}</dd><dt>Получатель</dt><dd>{c.canSend ? 'Специалист Альфа-Банка' : d.recipient}</dd><dt>Сумма</dt><dd>{fmt(c.amount)} млн ₽</dd><dt>Срок</dt><dd>{c.termMonths} мес.{!isC1 && ` · ${c.stages} эт.`}</dd><dt>Варианты</dt><dd>{allowed.map(i => i.name).join(', ') || '—'}</dd></dl>
      <div className="small muted" style={{ marginTop: 8 }}>Передаются только цель, сумма, срок и выбранные варианты.</div></div>
    {err && <div className="err">{err} <button type="button" className="linkbtn" onClick={send}>Повторить</button></div>}
    <div className="pbtns">{c.canSend ? <button type="button" className="btn red" disabled={busy} onClick={send}>{busy ? 'Отправка…' : 'Отправить специалисту'}</button> : <button type="button" className="btn red" onClick={() => act({ a: 'handoff' })}>{d.cta[0]?.startsWith('Передать') ? d.cta[0] : 'Передать расчёт уполномоченному'}</button>}
      <button type="button" className="btn" onClick={() => { setErr(''); act({ a: 'leave' }) }}>Назад, не отправляя</button></div></>
  else if (j.scr === 'status') body = <><div className="blk hl"><h5>Запрос {st.reqs[need]?.number || ''}</h5><div className="small">Передан специалисту. Рекламное предложение по этой потребности скрыто, повторный запрос даёт тот же номер.</div></div><Home /></>
  else if (j.scr === 'handoff') body = <><div className="blk hl"><h5>Расчёт передан</h5><div className="small">{d.recipient || 'Уполномоченному'} получил сводку: ссылку в Альфа-Бизнесе и PDF с суммой, сроком и вариантами. Статус <span className="code">awaiting_review</span>.</div>
      <div className="bonus">Бонус за переданный расчёт: если он привёл к сделке — кэшбэк или сертификат от банка. Условия программы публичные.</div>
      <div className="small muted" style={{ marginTop: 6 }}>Демо: переключите пользователя справа на того, у кого есть право отправки, — те же параметры откроются у него.</div></div><Home /></>
  else body = <><div className="blk"><h5>Консультация</h5><div className="small">Специалист свяжется с вами в течение рабочего дня. Расчёт не является офертой.</div></div><Home /></>

  const ACTS: [JAct & { a: 'sig' }, string][] = [[{ a: 'sig', v: 'idle' }, `Пауза ${CFG.idleSec} с на экране`], [{ a: 'sig', v: 'draft' }, 'Бросил черновик заявки'], [{ a: 'sig', v: 'day' }, 'Прошло 2 дня'], [{ a: 'sig', v: 'reset' }, 'Сбросить путь']]
  return <>
    <p className="muted" style={{ margin: '0 0 14px' }}>На экране: <b>{p.name}</b>, {isC1 ? 'С1' : 'С2'}, {u.label.toLowerCase()}, активность {ACT_L[c.activity]}. Это кликабельный путь от карточки до запроса. Перестройка экрана — реакция интерфейса в сессии, а не рассылка, поэтому лимиты контактов не расходуются. Параметры профиля меняются на вкладке «Решение».</p>
    <div className="adapt-grid">
      <div className="phone" id="phone">
        <div className="top"><span><b>Альфа</b>-Бизнес · {p.name}</span><span>{ruDate(now)}</span></div>
        <div className="small muted">Счета · Платежи · Дела в работе · <b style={{ color: 'var(--ink)' }}>Предложения</b></div>
        {push}{inbox}{idleHint}{body}<div style={{ flex: 1 }} />
        <div className="screens" aria-label="Экраны пути">{SCR.map(([k, l]) => <span key={k} className={j.scr === k ? 'on' : ''}>{l}</span>)}</div>
      </div>
      <div className="stack">
        <div className="panel"><h2>Кто открыл интернет-банк</h2>
          <p className="muted small" style={{ margin: '0 0 10px' }}>Роль и право отправки берутся из профиля пользователя. Переключатели демо их не выдают.</p>
          <div className="chips">{p.users.map(x => <button key={x.id} type="button" className="chip" aria-pressed={u.id === x.id} onClick={() => { setErr(''); user(x.id) }}>{x.label}{!x.canSend && <small> · без права отправки</small>}</button>)}</div>
          <div className="presets">{Object.values(PROFILES).map(x => <button key={x.id} type="button" className="btn" aria-pressed={st.pid === x.id} onClick={() => { setErr(''); preset(x.id) }}>{x.label} · {x.name.replace(/^(ООО|АО) /, '')}</button>)}</div></div>
        <div className="panel"><h2>Микро-сигналы сессии</h2>
          <p className="muted small" style={{ margin: '0 0 10px' }}>Возвраты назад и повторные сравнения считаются сами, когда вы кликаете по экрану. Остальное можно сымитировать.</p>
          <div className="acts">{ACTS.map(([x, t]) => <button key={x.v} type="button" className="btn" onClick={() => { setErr(''); act(x) }}>{t}</button>)}</div>
          <div className="log"><div className="small muted">Возвратов назад: <b>{j.back}</b> · открытий сравнения: <b>{j.cmp}</b> · черновик: <b>{j.draft ? 'брошен' : 'нет'}</b> · действие: <span className="code">{d.action}</span></div>
            {j.log.length ? j.log.slice(-5).reverse().map((x, i) => <div key={j.log.length - i}>{x}</div>) : <div className="muted">Пока клиент просто смотрит экран.</div>}</div></div>
        <div className="panel"><h2>UX-метрики пилота</h2>
          <p className="muted small" style={{ margin: 0 }}>Сравниваем адаптивный путь с текущим в A/B. Единица сплита — компания, не меньше 30 дней, MDE считаем до старта.</p>
          <div className="metrics">
            <div className="m"><div className="small muted">Дошли до запроса</div><div className="v">цель +20%</div><div className="small muted">к контролю · гипотеза пилота</div></div>
            <div className="m"><div className="small muted">Время до запроса</div><div className="v">↓</div><div className="small muted">база из аналитики интернет-банка</div></div>
            <div className="m"><div className="small muted">Брошенные черновики</div><div className="v">↓</div><div className="small muted">база из аналитики интернет-банка</div></div>
          </div></div>
        <div className="panel"><h2>Данные и 152-ФЗ</h2><p className="muted small" style={{ margin: 0 }}>Микро-сигналы — события сессии сотрудника компании: переходы и время на экране. Это персональные данные, поэтому в PoC экран перестраиваем только в текущей сессии, в оптимизатор передаём агрегаты без ФИО, основание обработки согласуем с юристами банка до пилота. Клиент видит «Почему вы это видите» и может отключить предложения.</p></div>
      </div>
    </div>
  </>
}
