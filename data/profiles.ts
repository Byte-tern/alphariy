import type { Ctx, Role } from '@/lib/decision'
export interface User { id: string; label: string; role: Role; canSend: boolean }
export interface Profile { id: string; name: string; ctx: Omit<Ctx, 'role' | 'canSend'>; users: User[] }
const base = { centralized: null as boolean | null, managerPref: false, bondsBefore: false, cfa: 'unknown' as const, refusal: 'none' as const,
  requestSent: false, contacts30: 0, oldestContactDays: 0, lastEmailDays: null as number | null, backCount: 0, compareOpens: 0, idleSec: 0, stages: 0 }
// Все профили вымышленные (status: synthetic)
export const PROFILES: Record<string, Profile> = {
  A: { id: 'A', name: 'А · ТоргСнаб', ctx: { ...base, segment: 'C1', industry: 'trade', structure: 'group', centralized: true, activity: 'high', need: 'confirmed', amount: 800, termMonths: 36, monthsToDue: 5 },
    users: [{ id: 'cfo', label: 'CFO группы', role: 'cfo', canSend: true }, { id: 'treas', label: 'Казначей', role: 'treas', canSend: false }] },
  B: { id: 'B', name: 'Б · СтройГрад', ctx: { ...base, segment: 'C2', industry: 'constr', structure: 'sub', centralized: true, activity: 'low', managerPref: true, need: 'confirmed', amount: 1500, termMonths: 60, monthsToDue: null, stages: 4 },
    users: [{ id: 'acc', label: 'Бухгалтер дочки', role: 'acc', canSend: false }, { id: 'cfo', label: 'Руководитель группы', role: 'cfo', canSend: true }] },
  V: { id: 'V', name: 'В · ПромМаш', ctx: { ...base, segment: 'C1', industry: 'manuf', structure: 'solo', activity: 'mid', need: 'confirmed', amount: 450, termMonths: 24, monthsToDue: 2 },
    users: [{ id: 'u', label: 'Роль неизвестна', role: 'unknown', canSend: false }] },
  G: { id: 'G', name: 'Г · Адресный выпуск', ctx: { ...base, segment: 'C1', industry: 'manuf', structure: 'solo', activity: 'high', need: 'confirmed', amount: 250, termMonths: 12, monthsToDue: 6, cfa: 'confirmed' },
    users: [{ id: 'cfo', label: 'Финдиректор', role: 'cfo', canSend: true }] },
}
