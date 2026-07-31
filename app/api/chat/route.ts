import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { validateJsonContentType, validateChatMessages } from '@/lib/api-validation'
import { getAuthedUser, getRequestScopedClient } from '@/lib/supabase/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Eres un acompañante de bienestar psicológico dentro de la app SOSecure, diseñada para la seguridad personal. Tu rol es proporcionar apoyo emocional empático, técnicas de manejo de ansiedad y estrés, y orientar al usuario hacia recursos de crisis cuando sea necesario.

Reglas:
- Responde siempre en español, con un tono cálido, empático y no clínico.
- Si el usuario expresa ideación suicida, riesgo para sí mismo u otros, proporciona de inmediato los recursos de crisis: SAPTEL 55 5259-8121 (24h) y CONASAMA 800 290-0024.
- No diagnostiques enfermedades mentales ni reemplaces a un profesional de salud mental.
- Mantén respuestas concisas (máximo 3-4 párrafos) y usa viñetas cuando sea útil.
- Ofrece técnicas prácticas: respiración, grounding 5-4-3-2-1, mindfulness, etc.
- Si el usuario está en peligro físico inmediato, recuérdale que puede usar el botón SOS de la app.`

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedUser(req)
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const supabase = await getRequestScopedClient(req)
    const { data: isPremium } = await supabase.rpc('has_premium_access')
    if (!isPremium) {
      return NextResponse.json({ error: 'Requiere plan premium' }, { status: 403 })
    }

    const ctErr = validateJsonContentType(req)
    if (ctErr) return ctErr

    const { messages } = await req.json() as {
      messages: { role: 'user' | 'assistant'; content: string }[]
    }

    const msgErr = validateChatMessages(messages, 60, 4000)
    if (msgErr) return msgErr

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ content: text })
  } catch (err) {
    console.error('Anthropic API error:', err)
    return NextResponse.json({ error: 'Error al contactar el asistente' }, { status: 500 })
  }
}
