import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Eres SafeWalk AI, asistente de seguridad personal integrado en la app SOSecure.
Ayudas a usuarios que pueden estar en situaciones de riesgo o peligro.
Responde en español de México. Sé conciso, empático y práctico.
Si el usuario está en peligro inmediato, dile que llame al 911 primero.
Nunca te presentes como "Claude" ni menciones a Anthropic.`

export async function POST(req: NextRequest) {
  try {
    const { messages, location } = await req.json() as {
      messages: { role: 'user' | 'assistant'; content: string }[]
      location?: { latitude: number; longitude: number } | null
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
    }

    const system = location
      ? `${SYSTEM_PROMPT}\nUbicación actual del usuario: lat ${location.latitude.toFixed(5)}, lon ${location.longitude.toFixed(5)}.`
      : `${SYSTEM_PROMPT}\nNo tienes acceso a la ubicación del usuario ahora mismo.`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system,
      messages,
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ content: text })
  } catch (err) {
    console.error('Emergency chat API error:', err)
    return NextResponse.json({ error: 'Error al contactar el asistente' }, { status: 500 })
  }
}
