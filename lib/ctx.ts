import { PROFILES } from '@/data/profiles'
import type { Ctx } from '@/lib/decision'

// Переключатели панели не могут выдать право отправки: роль и права берутся только из профиля/пользователя.
const ALLOWED = ['segment', 'industry', 'structure', 'centralized', 'activity', 'need', 'amount', 'termMonths', 'monthsToDue', 'stages', 'cfa', 'bondsBefore', 'refusal', 'refusedTool', 'contacts30', 'lastEmailDays']

export function buildCtx(profileId: string, userId: string, ov: Record<string, unknown> = {}, ev: Record<string, number> = {}, requestSent = false): Ctx | null {
  const p = PROFILES[profileId]; const u = p?.users.find(x => x.id === userId)
  if (!p || !u) return null
  const o: Record<string, unknown> = {}
  for (const k of ALLOWED) if (k in ov) o[k] = ov[k]
  const num = (x: unknown) => (typeof x === 'number' && isFinite(x) ? x : 0)
  return { ...p.ctx, ...o, role: u.role, canSend: u.canSend, requestSent, backCount: num(ev.backCount), compareOpens: num(ev.compareOpens), idleSec: num(ev.idleSec) } as Ctx
}
