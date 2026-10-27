import { NextResponse } from 'next/server'
import { PROFILES } from '@/data/profiles'
import { decide, type Ctx } from '@/lib/decision'

// Переключатели панели не могут выдать право отправки: роль и права берутся только из профиля/пользователя.
const ALLOWED = ['segment', 'industry', 'structure', 'centralized', 'activity', 'need', 'amount', 'termMonths', 'monthsToDue', 'stages', 'cfa', 'refusal', 'refusedTool', 'contacts30', 'lastEmailDays']

export function buildCtx(profileId: string, userId: string, ov: Record<string, unknown> = {}, ev: Record<string, number> = {}, requestSent = false): Ctx | null {
  const p = PROFILES[profileId]; const u = p?.users.find(x => x.id === userId)
  if (!p || !u) return null
  const o: Record<string, unknown> = {}
  for (const k of ALLOWED) if (k in ov) o[k] = ov[k]
  const num = (x: unknown) => (typeof x === 'number' && isFinite(x) ? x : 0)
  return { ...p.ctx, ...o, role: u.role, canSend: u.canSend, requestSent, backCount: num(ev.backCount), compareOpens: num(ev.compareOpens), idleSec: num(ev.idleSec) } as Ctx
}

export async function POST(req: Request) {
  try {
    const b = await req.json()
    const ctx = buildCtx(b.profileId, b.userId, b.overrides, b.events, !!b.requestSent)
    if (!ctx) return NextResponse.json({ error: 'Неизвестный профиль или пользователь' }, { status: 400 })
    const now = typeof b.demoNow === 'string' && !isNaN(Date.parse(b.demoNow)) ? b.demoNow : '2026-10-27'
    return NextResponse.json(decide(ctx, now))
  } catch { return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 }) }
}
