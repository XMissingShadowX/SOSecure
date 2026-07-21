// Rate limiter en memoria por ventana fija. Al igual que el placeholder en
// app/api/pin/verify/route.ts, no persiste entre instancias serverless/edge —
// en producción reemplazar por Redis/Upstash (o similar) compartido entre instancias.
type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 5000

export function rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now()
  const entry = buckets.get(key)

  if (!entry || now >= entry.resetAt) {
    if (buckets.size >= MAX_BUCKETS) buckets.clear()
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  entry.count++
  if (entry.count > limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) }
  }
  return { allowed: true, retryAfterSeconds: 0 }
}
