import { NextResponse } from 'next/server'
import { decide } from '@/lib/decision'
import { buildCtx } from '@/lib/ctx'

export async function POST(req: Request) {
  try {
    const b = await req.json()
    const ctx = buildCtx(b.profileId, b.userId, b.overrides, b.events, !!b.requestSent)
    if (!ctx) return NextResponse.json({ error: 'Неизвестный профиль или пользователь' }, { status: 400 })
    const now = typeof b.demoNow === 'string' && !isNaN(Date.parse(b.demoNow)) ? b.demoNow : '2026-10-27'
    return NextResponse.json(decide(ctx, now))
  } catch { return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 }) }
}
