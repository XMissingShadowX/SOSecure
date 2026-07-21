import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

// Límites por prefijo de ruta: [prefijo, máximo de solicitudes, ventana en ms].
// Se evalúa en orden, así que los prefijos más específicos van primero.
const ROUTE_LIMITS: [prefix: string, limit: number, windowMs: number][] = [
  ['/api/chat', 20, 60_000],
  ['/api/emergency-chat', 20, 60_000],
  ['/api/pin', 10, 60_000],
  ['/api/family/webhook', 120, 60_000],
  ['/api/premium/webhook', 120, 60_000],
]

const DEFAULT_LIMIT = 60
const DEFAULT_WINDOW_MS = 60_000

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const match = ROUTE_LIMITS.find(([prefix]) => pathname.startsWith(prefix))
  const [routeKey, limit, windowMs] = match ?? [pathname, DEFAULT_LIMIT, DEFAULT_WINDOW_MS]

  const ip = getClientIp(req)
  const { allowed, retryAfterSeconds } = rateLimit(`${ip}:${routeKey}`, limit, windowMs)

  if (!allowed) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes, intenta de nuevo más tarde.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
