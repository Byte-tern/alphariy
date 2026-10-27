export const TODAY = '2026-10-27'
export const fmt = (n: number) => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 1 })
export const fmtInt = (n: number) => Number(n).toLocaleString('ru-RU')
export const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * 864e5).toISOString().slice(0, 10)
export const addMonths = (iso: string, m: number) => { const d = new Date(Date.parse(iso)); d.setUTCMonth(d.getUTCMonth() + m); return d.toISOString().slice(0, 10) }
export const ruDate = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}` }
export function plural(n: number, a: string, b: string, c: string) {
  const m10 = n % 10, m100 = n % 100
  return m10 === 1 && m100 !== 11 ? a : (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c)
}
export const ROLE_L: Record<string, string> = { cfo: 'Финдиректор', treas: 'Казначей', acc: 'Бухгалтер', ceo: 'Гендиректор', unknown: 'Роль не указана' }
export const IND_L: Record<string, string> = { trade: 'Торговля', manuf: 'Производство', constr: 'Строительство', infra: 'Инфраструктура' }
export const ACT_L: Record<string, string> = { high: 'высокая', mid: 'средняя', low: 'низкая', none: 'неизвестна (нет телеметрии)' }
export const STRUCT_L: Record<string, string> = { solo: 'самостоятельная', group: 'группа', sub: 'дочка' }
