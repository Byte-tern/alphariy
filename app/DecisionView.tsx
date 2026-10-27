'use client'
import { PROFILES } from '@/data/profiles'
import { CFG } from '@/lib/config'
import { rankScore } from '@/lib/funnel'
import { fmt, ruDate, ROLE_L, IND_L, ACT_L } from '@/lib/format'
import { type St, ctxOf, decisionOf, nowOf, userOf, needOf } from './state'
import { Chips, Icon, OfferCard, type IconK } from './ui'

const OPT = {
  segment: [['C1', 'С1 · Рефинансирование долга'], ['C2', 'С2 · Инвестпроект (CAPEX)']],
  industry: [['trade', 'Торговля'], ['manuf', 'Производство'], ['constr', 'Строительство'], ['infra', 'Инфраструктура']],
  structure: [['solo', 'Самостоятельная'], ['group', 'Группа компаний'], ['sub', 'Дочка без полномочий']],
  centralized: [['yes', 'Да'], ['null', 'Неизвестно'], ['no', 'Нет']],
  activity: [['high', 'Высокая · ежедневно'], ['mid', 'Средняя · раз в неделю'], ['low', 'Низкая · через менеджера'], ['none', 'Нет телеметрии']],
  need: [['confirmed', 'Подтверждена'], ['unknown', 'Неизвестна'], ['none', 'Отсутствует']],
  refusal: [['none', 'Отказов нет'], ['notnow', '«Не сейчас»'], ['tool', 'Отказ от облигаций'], ['solved', 'Задача решена'], ['unsub', 'Отписка']],
  cfa: [['confirmed', 'Подтверждена'], ['unknown', 'Нет данных'], ['no', 'Не подходит']],
  term: [[12, '12 мес.'], [24, '24 мес.'], [36, '36 мес.'], [60, '60 мес.']],
  lastEmail: [['null', 'Не было'], ['10', '10 дней назад'], ['70', '70 дней назад']],
} as const satisfies Record<string, readonly (readonly [string | number, string])[]>
const o = <K extends keyof typeof OPT>(k: K) => OPT[k] as unknown as [string, string][]
const ACTION_T: Record<string, string> = { show_comparison: 'Показать сравнение', route_to_authorized_user: 'Подготовить расчёт и передать', consult_specialist: 'Нейтральная версия + специалист', clarify_need: 'Уточнить задачу', suppress_marketing: 'Не показывать', show_request_status: 'Показать статус запроса' }

function Range({ id, label, min, max, step = 1, value, shown, onChange }: { id: string; label: string; min: number; max: number; step?: number; value: number; shown: string; onChange: (v: number) => void }) {
  return <div className="field"><label className="lbl" htmlFor={id}>{label}</label><div className="row">
    <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} /><span className="num">{shown}</span></div></div>
}

export default function DecisionView({ st, set, preset, user }: { st: St; set: (o: Record<string, unknown>) => void; preset: (k: string) => void; user: (id: string) => void }) {
  const c = ctxOf(st), d = decisionOf(st), p = PROFILES[st.pid], now = nowOf(st), isC1 = c.segment === 'C1'

  const controls = <>
    <div className="field"><span className="lbl">{p.name} · пользователь</span><div className="chips">{p.users.map(u =>
      <button key={u.id} type="button" className="chip" aria-pressed={userOf(st).id === u.id} onClick={() => user(u.id)}>{u.label}{!u.canSend && <small> · без права отправки</small>}</button>)}</div></div>
    <div className="group-h">Потребность</div>
    <div className="field"><span className="lbl">Ситуация</span><Chips idp="segment" opts={o('segment')} value={c.segment} onPick={v => set({ segment: v, ...(v === 'C1' && c.monthsToDue == null ? { monthsToDue: 5 } : {}), ...(v === 'C2' && c.stages < 2 ? { stages: 3 } : {}) })} /></div>
    {isC1 ? <>
      <Range id="monthsToDue" label="До погашения кредита" min={1} max={15} value={c.monthsToDue ?? 5} shown={`${c.monthsToDue ?? '—'} мес.`} onChange={v => set({ monthsToDue: v })} />
      <Range id="amount" label="Остаток долга" min={50} max={3000} step={50} value={c.amount} shown={`${fmt(c.amount)} млн`} onChange={v => set({ amount: v })} />
    </> : <>
      <Range id="amount" label="Сумма проекта" min={200} max={5000} step={100} value={c.amount} shown={`${fmt(c.amount)} млн`} onChange={v => set({ amount: v })} />
      <Range id="stages" label="Этапов проекта" min={1} max={5} value={c.stages} shown={String(c.stages)} onChange={v => set({ stages: v })} />
    </>}
    <div className="field"><span className="lbl">Новый срок финансирования</span><Chips idp="term" opts={o('term')} value={c.termMonths} onPick={v => set({ termMonths: +v })} /></div>
    <div className="field"><span className="lbl">Потребность в финансировании</span><Chips idp="need" opts={o('need')} value={c.need} onPick={v => set({ need: v })} /></div>
    <div className="group-h">Компания</div>
    <div className="field"><span className="lbl">Отрасль</span><Chips idp="industry" opts={o('industry')} value={c.industry} onPick={v => set({ industry: v })} /></div>
    <div className="field"><span className="lbl">Структура бизнеса</span><Chips idp="structure" opts={o('structure')} value={c.structure} onPick={v => set({ structure: v })} /></div>
    {c.structure === 'group' && <div className="field"><span className="lbl">Финансы централизованы</span><Chips idp="centralized" opts={o('centralized')} value={c.centralized === true ? 'yes' : c.centralized === false ? 'no' : 'null'} onPick={v => set({ centralized: v === 'yes' ? true : v === 'no' ? false : null })} /></div>}
    <div className="field"><label className="toggle"><input id="bondsBefore" type="checkbox" checked={c.bondsBefore} onChange={e => set({ bondsBefore: e.target.checked })} /> Уже выпускали облигации</label></div>
    <div className="group-h">Поведение и история</div>
    <div className="field"><span className="lbl">Цифровая активность</span><Chips idp="activity" opts={o('activity')} value={c.activity} onPick={v => set({ activity: v })} /></div>
    <div className="field"><span className="lbl">История коммуникаций</span><Chips idp="refusal" opts={o('refusal')} value={c.refusal} onPick={v => set({ refusal: v, ...(v === 'tool' ? { refusedTool: 'bonds' } : {}) })} /></div>
    <Range id="contacts30" label="Рекламных контактов за 30 дней" min={0} max={5} value={c.contacts30} shown={`${c.contacts30} из ${CFG.maxContacts30}`} onChange={v => set({ contacts30: v })} />
    <div className="field"><span className="lbl">Последний email</span><Chips idp="lastEmail" opts={o('lastEmail')} value={c.lastEmailDays == null ? 'null' : c.lastEmailDays} onPick={v => set({ lastEmailDays: v === 'null' ? null : +v })} /></div>
  </>

  // 1. Новые признаки
  type F = [string, string | [string]]
  const feats: F[] = []
  if (isC1) feats.push(['Окно рефинансирования', c.monthsToDue != null ? `${c.monthsToDue} мес. · ${fmt(c.amount)} млн ₽` : ['нет данных']])
  else { feats.push(['Подтверждённость CAPEX', 'заявка в работе']); feats.push(['Масштаб проекта', `${fmt(c.amount)} млн ₽ · ${c.stages} эт.`]) }
  feats.push(['Потребность', c.need === 'confirmed' ? 'подтверждена' : c.need === 'unknown' ? ['неизвестна'] : 'нет'])
  feats.push(['История инструментов', c.bondsBefore ? 'выпускали облигации' : 'только кредиты'])
  feats.push(['Отрасль', IND_L[c.industry] + (c.industry === 'trade' ? ' · сезонность' : '')])
  feats.push(['Структура', c.structure === 'group' ? (c.centralized === true ? 'группа, централизована' : c.centralized == null ? ['централизация неизвестна'] : 'группа, децентрализована') : c.structure === 'sub' ? 'дочка' : 'самостоятельная'])
  feats.push(['Роль и права', c.role === 'unknown' ? ['не указана в CRM'] : `${ROLE_L[c.role]} · ${c.canSend ? 'может отправить' : 'без права отправки'}`])
  feats.push(['Цифровая активность', ACT_L[c.activity]])
  const rk = rankScore(c, Math.min(1, .2 + .5 * Math.min(c.amount / 1500, 1) + .15))

  const stop = d.action === 'suppress_marketing', sent = d.action === 'show_request_status', ask = d.action === 'clarify_need', none = stop || sent || ask
  const blockedRules = stop || sent
  let after
  if (stop) after = <div className="stopbox"><b>Предложение не показываем.</b><br />{d.blockedText}<div className="small muted" style={{ marginTop: 6 }}>Место в выдаче занимает следующее допустимое предложение. Причина пишется в историю для дообучения. Клиент сам может открыть калькулятор в разделе кредитов.</div></div>
  else if (sent) after = <div className="askbox"><b>Запрос {st.reqs[needOf(st)]?.number} отправлен.</b><br />Реклама по этой потребности остановлена, клиент видит статус запроса.</div>
  else if (ask) after = <div className="askbox"><b>{isC1 ? 'Планируете привлекать финансирование после погашения?' : 'Подтвердите параметры проекта'}</b>
    <div className="ctas"><button type="button" className="btn red" onClick={() => set({ need: 'confirmed', ...(isC1 && c.monthsToDue == null ? { monthsToDue: 5 } : {}) })}>Да</button><button type="button" className="btn" onClick={() => set({ need: 'none' })}>Погасим сами</button><span className="btn">Пока не решили</span></div>
    <div className="small muted" style={{ marginTop: 8 }}>Точную рекомендацию не даём, пока не знаем задачу. Ответ записывается как признак «потребность».</div></div>
  else {
    const total = c.contacts30 + d.channelPlan.planned
    const lims: [string, boolean][] = [[`${c.contacts30} уже + ${d.channelPlan.planned} в цепочке, лимит ${CFG.maxContacts30} за 30 дней`, total > CFG.maxContacts30 || !!d.channelPlan.blocked], [d.channelPlan.dailyLimit, false], ['Отказ → стоп во всех каналах', false], ['Без сумм в push: их видно на экране блокировки', false], ['Данные ЛПР по 152-ФЗ', false]]
    after = <>
      {d.channelPlan.blocked && <div className="stopbox" style={{ marginBottom: 12 }}><b>{d.channelPlan.blocked}.</b> Предложение готово, но первый контакт не раньше {ruDate(d.channelPlan.nextEligibleAt)}.</div>}
      <OfferCard c={c} d={d} now={now} onRefuse={v => set({ refusal: v })} />
      <details className="excl"><summary>Почему не показаны другие инструменты ({d.excluded.length})</summary>{d.excluded.length ? d.excluded.map(i => <div key={i.id}><b>{i.name}</b>: {i.reason} <span className="code">{i.ruleId}</span></div>) : <div>Все применимые показаны</div>}</details>
      <div className="timeline"><div className="sec-title" style={{ margin: '6px 0 8px' }}>Канал и частота</div>
        {d.channelPlan.steps.map((s, i) => <div key={i} className={'tl' + (s.muted ? ' grey' : '')}><span className="d">{s.day}</span><span className={'dot' + (s.muted ? ' grey' : '')} /><div className="t">{s.text}{s.note && <small>{s.note}</small>}</div></div>)}</div>
      <div className="limits">{lims.map(([l, bad]) => <span key={l} className={'lim' + (bad ? ' bad' : '')}><Icon k={bad ? 'stop' : 'ok'} />{l}</span>)}</div>
    </>
  }

  return <div className="grid">
    <aside className="panel" aria-label="Профиль клиента">
      <h2>Профиль клиента</h2>
      <p className="muted small" style={{ margin: 0 }}>Выберите компанию и пользователя, меняйте параметры. Справа пересчитываются признаки, правила, предложение, канал и частота.</p>
      <div className="presets">{Object.values(PROFILES).map(x => <button key={x.id} type="button" className="btn" aria-pressed={st.pid === x.id} onClick={() => preset(x.id)}>{x.label}{st.pid === x.id && st.dirty && <span className="mod">· изменён</span>}</button>)}</div>
      {controls}
    </aside>
    <div className="stack" id="result">
      <div className="panel" style={{ padding: '14px 18px' }}><div className="small muted">Синтетический клиент · {userOf(st).label} · правила {d.rulesVersion}</div><div style={{ fontWeight: 700, fontSize: 17 }}>{p.name}{c.structure === 'group' ? ' и ещё 3 компании группы' : ''}</div></div>
      <div>
        <div className="sec-title">Как оптимизатор принимает решение</div>
        <div className="pipe">
          <div className="step"><h3><i>1</i>Новые признаки</h3>
            {feats.map(([k, v]) => <div key={k} className="feat"><span>{k}</span>{Array.isArray(v) ? <b className="flag">{v[0]} · флаг неполноты</b> : <b>{v}</b>}</div>)}
            <div className="small" style={{ marginTop: 10 }}>Ранг на стадии ранжирования: <b>{rk.score.toFixed(2)}</b></div>
            <div className="bar">{rk.parts.map(x => <span key={x[0]} style={{ width: `${x[1] * 100}%`, background: x[2] }} />)}</div>
            <div className="parts">{rk.parts.map(x => <span key={x[0]}><i style={{ background: x[2] }} />{x[0]}: {x[1].toFixed(2)}</span>)}</div></div>
          <div className="step"><h3><i>2</i>Бизнес-правила</h3>
            {d.reasonCodes.map((r, i) => { const t: IconK = blockedRules && r.t !== 'stop' ? 'off' : r.t; return <div key={i} className="rule"><span className={'ico ' + t}><Icon k={t} /></span><span><span className="rid">{r.ruleId}</span>{r.text} <small>[{r.fact}]</small></span></div> })}
            {blockedRules && <div className="small muted" style={{ marginTop: 6 }}>Стоп-правило сильнее остальных: дальше правила не применяются.</div>}</div>
          <div className="step"><h3><i>3</i>Адресат и действие</h3>
            <dl className="kv"><dt>Действие</dt><dd>{ACTION_T[d.action]} <span className="code">{d.action}</span></dd>
              <dt>Кому</dt><dd>{none ? '—' : d.recipient}</dd><dt>Глубина</dt><dd>{none ? '—' : d.depth}</dd>
              <dt>Кнопка</dt><dd>{none ? 'не показываем' : `«${d.cta[0]}»`}</dd>
              <dt>Вариантов</dt><dd>{none ? '0' : `${d.instruments.length} для сравнения`}</dd>
              <dt>Канал</dt><dd>{stop || sent ? 'никакой' : d.channelPlan.blocked ? 'ждём до ' + ruDate(d.channelPlan.nextEligibleAt) : d.channelPlan.steps[0].text}</dd>
              <dt>Неполные поля</dt><dd>{d.missingFields.length ? d.missingFields.join(', ') : 'нет'}</dd></dl></div>
        </div>
      </div>
      <div>
        <div className="sec-title">Что получает клиент</div>
        <div className="ba">
          <div className="panel"><div className="col-h"><span className="tag was">Было</span> Текущий оптимизатор</div>
            <div className="oldbanner"><span className="small">Карусель баннеров · для всех</span><b>Кредит для бизнеса на выгодных условиях</b><span className="small">Оформить заявку →</span></div>
            <dl className="kv" style={{ marginTop: 12 }}><dt>Кому</dt><dd>всем пользователям компании одинаково</dd><dt>Продукт</dt><dd>один кредит по look-alike</dd><dt>Канал</dt><dd>баннер + массовая рассылка</dd><dt>Частота</dt><dd>по лимитам продукта, без учёта поведения</dd></dl></div>
          <div className="panel"><div className="col-h"><span className="tag now">Стало</span> Альфа-Навигатор финансирования</div>{after}</div>
        </div>
      </div>
      <p className="note">Прототип показывает логику Proof of Concept: архитектура оптимизатора прежняя, добавляются признаки, правила и шаблоны сообщений. Источники признаков: CRM (роль, права, структура группы), кредитный договор (срок и сумма), заявки (CAPEX), события интернет-банка (активность). Скоры — заглушка вместо выхода банковского look-alike. Все компании, суммы и ставки вымышлены.</p>
    </div>
  </div>
}
