import { NextResponse } from 'next/server'
import { decide } from '@/lib/decision'
import { buildCtx } from '../decision/route'

export async function POST(req: Request) {
  try {
    const b = await req.json()
    if (!b.requestId || !b.needId) return NextResponse.json({ error: 'Не указан requestId или needId' }, { status: 400 })
    if (!(b.amount > 0) || !(b.termMonths > 0)) return NextResponse.json({ error: 'Сумма и срок должны быть положительными' }, { status: 400 })
    if (b.stages?.length && Math.abs(b.stages.reduce((s: number, x: number) => s + x, 0) - b.amount) > 0.01) return NextResponse.json({ error: 'Сумма траншей должна совпадать с бюджетом' }, { status: 400 })
    const ctx = buildCtx(b.profileId, b.userId, { ...b.overrides, amount: b.amount, termMonths: b.termMonths })
    if (!ctx) return NextResponse.json({ error: 'Неизвестный профиль или пользователь' }, { status: 400 })
    if (!ctx.canSend) return NextResponse.json({ error: 'У пользователя нет права отправки: передайте расчёт уполномоченному' }, { status: 403 })
    const d = decide(ctx, b.demoNow || '2026-10-27')
    const okIds = d.instruments.map(i => i.id)
    if (!(b.instruments?.length) || b.instruments.some((i: string) => !okIds.includes(i))) return NextResponse.json({ error: 'Выбран неприменимый инструмент' }, { status: 400 })
    let h = 0; for (const ch of String(b.requestId)) h = (h * 31 + ch.charCodeAt(0)) % 90000 // детерминированный демо-номер: повтор даёт тот же номер
    return NextResponse.json({ requestId: b.requestId, number: `DEMO-${10000 + h}`, status: 'demo_submitted' })
  } catch { return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 }) }
}
