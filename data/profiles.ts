import type { Ctx, Role } from '@/lib/decision'
export interface User { id: string; label: string; role: Role; canSend: boolean }
export interface Profile { id: string; label: string; name: string; ctx: Omit<Ctx, 'role' | 'canSend'>; users: User[] }
const base = { centralized: null as boolean | null, managerPref: false, bondsBefore: false, cfa: 'unknown' as const, refusal: 'none' as const, refusedTool: 'bonds',
  requestSent: false, contacts30: 1, oldestContactDays: 12, lastEmailDays: null as number | null, backCount: 0, compareOpens: 0, idleSec: 0, stages: 1, monthsToDue: null as number | null }
// Все профили вымышленные (status: synthetic)
export const PROFILES: Record<string, Profile> = {
  A: { id: 'A', label: 'Клиент А', name: 'ООО «ТоргСнаб»', ctx: { ...base, segment: 'C1', industry: 'trade', structure: 'group', centralized: true, activity: 'high', need: 'confirmed', amount: 800, termMonths: 36, monthsToDue: 5 },
    users: [{ id: 'cfo', label: 'Финдиректор группы', role: 'cfo', canSend: true }, { id: 'treas', label: 'Казначей', role: 'treas', canSend: false }] },
  B: { id: 'B', label: 'Клиент Б', name: 'ООО «СтройГрад»', ctx: { ...base, segment: 'C2', industry: 'constr', structure: 'sub', centralized: true, activity: 'low', managerPref: true, need: 'confirmed', amount: 1500, termMonths: 60, stages: 4 },
    users: [{ id: 'acc', label: 'Бухгалтер дочки', role: 'acc', canSend: false }, { id: 'cfo', label: 'Финдиректор головной компании', role: 'cfo', canSend: true }] },
  V: { id: 'V', label: 'Клиент В', name: 'АО «ПромМаш»', ctx: { ...base, segment: 'C1', industry: 'manuf', structure: 'solo', activity: 'mid', need: 'confirmed', amount: 450, termMonths: 24, monthsToDue: 2, bondsBefore: true },
    users: [{ id: 'u', label: 'Роль не указана в CRM', role: 'unknown', canSend: false }] },
  G: { id: 'G', label: 'Клиент Г', name: 'АО «МагистральИнфра»', ctx: { ...base, segment: 'C1', industry: 'infra', structure: 'solo', activity: 'high', need: 'confirmed', amount: 250, termMonths: 12, monthsToDue: 6, cfa: 'confirmed' },
    users: [{ id: 'cfo', label: 'Финдиректор', role: 'cfo', canSend: true }, { id: 'ceo', label: 'Гендиректор', role: 'ceo', canSend: true }] },
}
