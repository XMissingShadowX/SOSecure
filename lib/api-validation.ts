import { NextResponse } from 'next/server'

// Helpers de validación para rutas app/api/*/route.ts que reciben JSON.
// Uso: llamar al inicio del handler, devolver la respuesta si no es null.
//
//   const ctErr = validateJsonContentType(req)
//   if (ctErr) return ctErr
//   const body = await req.json()
//   const arrErr = validateArrayLimit(body.members, 5, 'members')
//   if (arrErr) return arrErr

export function validateJsonContentType(req: Request): NextResponse | null {
  const contentType = req.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    return NextResponse.json({ error: 'Content-Type debe ser application/json' }, { status: 415 })
  }
  return null
}

export function validateArrayLimit(arr: unknown, max: number, fieldName: string): NextResponse | null {
  if (!Array.isArray(arr) || arr.length === 0) {
    return NextResponse.json({ error: `${fieldName} debe ser un array no vacío` }, { status: 400 })
  }
  if (arr.length > max) {
    return NextResponse.json({ error: `${fieldName} excede el máximo permitido (${max})` }, { status: 400 })
  }
  return null
}

// Para endpoints de chat (Anthropic): limita cantidad de mensajes y longitud
// de cada uno, para no reenviar payloads arbitrariamente grandes al modelo.
export function validateChatMessages(
  messages: unknown,
  maxCount: number,
  maxContentLength: number
): NextResponse | null {
  const arrErr = validateArrayLimit(messages, maxCount, 'messages')
  if (arrErr) return arrErr
  for (const m of messages as { content?: unknown }[]) {
    if (typeof m.content !== 'string' || m.content.length === 0 || m.content.length > maxContentLength) {
      return NextResponse.json(
        { error: `Cada mensaje debe ser texto de máximo ${maxContentLength} caracteres` },
        { status: 400 }
      )
    }
  }
  return null
}
