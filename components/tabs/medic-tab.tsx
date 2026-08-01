/*
  Este código define el componente `MedicTab`, que es una interfaz de chat para un acompañante de bienestar psicológico. 
  El componente utiliza varios hooks de React para manejar el estado de los mensajes, la entrada del usuario y el estado 
  de carga. También define una serie de respuestas predefinidas para ciertos temas relacionados con la ansiedad, la 
  respiración, las crisis emocionales y el estrés, que se devuelven cuando el usuario envía un mensaje que coincide 
  con esos temas. La interfaz incluye un área de desplazamiento para mostrar los mensajes del chat, botones de acceso 
  rápido para enviar mensajes predefinidos, y un formulario para que el usuario ingrese sus propios mensajes. Además, 
  se muestra un mensaje inicial del asistente con información sobre los servicios que ofrece y recursos de emergencia 
  en caso de crisis emocional.
*/

'use client'

// Importar los hooks de React para manejar el estado, referencias y efectos secundarios, así como los iconos de 
// Lucide, la función `cn` para combinar clases condicionalmente, y los componentes de UI personalizados como 
// Button, Card, Textarea y ScrollArea. También se importa el tipo `ChatMessage` para definir la estructura de los 
// mensajes del chat.
import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { useTranslation } from '@/lib/i18n'
import { Send, Bot, User, Sparkles, Heart, MessageCircle, Wind, AlertCircle, Smile } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { usePremium } from '@/hooks/use-premium'
import { UpgradeBanner } from '@/components/upgrade-banner'
import { FormattedMessage } from '@/components/formatted-message'
import { createClient } from '@/lib/supabase/client'
import type { ChatMessage } from '@/lib/types'

// Definir un objeto `offlineResponses` que contiene respuestas predefinidas para diferentes temas relacionados 
// con el bienestar psicológico. Cada clave del objeto corresponde a un tema (ansiedad, respiración, crisis, estrés) 
// y su valor es una cadena de texto que proporciona información y técnicas relacionadas con ese tema. Estas 
// respuestas se utilizan cuando el usuario envía un mensaje que coincide con alguno de los temas definidos, 
// proporcionando así una respuesta útil incluso cuando el asistente no tiene acceso a una API de inteligencia 
// artificial para generar respuestas dinámicas.
const offlineResponses: Record<string, string> = {
  ansiedad: `**Técnica 5-4-3-2-1 para ansiedad:**\nNombra en voz alta:\n• 5 cosas que puedes VER\n• 4 cosas que puedes TOCAR\n• 3 cosas que puedes OÍR\n• 2 cosas que puedes OLER\n• 1 cosa que puedes SABOREAR\n\nEsto ancla tu mente al presente. 💙`,
  respiracion: `**Respiración cuadrada (Box Breathing):**\n1. Inhala contando 4 segundos\n2. Retén el aire 4 segundos\n3. Exhala contando 4 segundos\n4. Pausa 4 segundos\n\nRepite 4-6 veces. Usado por fuerzas de élite para calmarse. 🌬️`,
  crisis: `**Si estás en crisis emocional:**\n\n🆘 Líneas de apoyo México:\n• SAPTEL: 55 5259-8121 (24h)\n• CONASAMA: 800 290-0024\n• Cruz Roja: 065\n\nNo estás solo/a. Hay personas que quieren ayudarte. 💙`,
  estres: `**Técnicas rápidas anti-estrés:**\n• Mueve los hombros en círculos\n• Agua fría en muñecas\n• Cuenta hacia atrás desde 10\n• Haz una lista de 3 cosas por las que estás agradecido/a\n• Estira el cuello suavemente`,
}

// Función para obtener una respuesta predefinida basada en el contenido del mensaje del usuario. La función convierte 
// el mensaje a minúsculas y verifica si contiene ciertas palabras clave relacionadas con los temas definidos en 
// `offlineResponses`. Si encuentra una coincidencia, devuelve la respuesta correspondiente; de lo contrario, 
// devuelve null, lo que indica que no se encontró una respuesta predefinida para ese mensaje.
function getOfflineResponse(prompt: string): string | null {
  const lower = prompt.toLowerCase()
  if (lower.includes('ansied') || lower.includes('pánico') || lower.includes('angustia')) return offlineResponses.ansiedad
  if (lower.includes('respira') || lower.includes('calmar')) return offlineResponses.respiracion
  if (lower.includes('crisis') || lower.includes('solo') || lower.includes('llorar') || lower.includes('triste')) return offlineResponses.crisis
  if (lower.includes('estrés') || lower.includes('estres') || lower.includes('técnica')) return offlineResponses.estres
  return null
}

export function MedicTab() {
  const { isPremium, loading: premiumLoading } = usePremium()
  const { simpleMode } = useAppStore()
  const { t } = useTranslation()

  const quickPrompts = [
    { icon: Heart, label: t('medic_anxiety'), prompt: t('medic_anxietyMsg') },
    { icon: Wind, label: t('medic_breathing'), prompt: t('medic_breathingMsg') },
    { icon: MessageCircle, label: t('medic_talk'), prompt: t('medic_talkMsg') },
    { icon: Smile, label: t('medic_techniques'), prompt: t('medic_techniquesMsg') },
  ]

  const INITIAL_MSG: ChatMessage = {
    id: 'initial',
    role: 'assistant',
    content: t('medic_welcome'),
    timestamp: new Date(),
  }

  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MSG])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Historial en el formato que espera la API (excluye el mensaje inicial del sistema)
  const apiHistory = messages
    .filter(m => m.id !== 'initial')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  // Efecto para hacer scroll automático hacia el final del área de mensajes cada vez que se actualiza la lista de 
  // mensajes. Esto asegura que el usuario siempre vea el mensaje más reciente sin tener que desplazarse manualmente.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Función para enviar un mensaje. Verifica que el mensaje no esté vacío y que no se esté cargando una respuesta,
  // luego agrega el mensaje del usuario a la lista de mensajes, limpia la entrada y establece el estado de carga. 
  // Después de un breve retraso simulado, obtiene una respuesta predefinida basada en el contenido del mensaje del 
  // usuario y la agrega a la lista de mensajes, luego desactiva el estado de carga.
  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          messages: [...apiHistory, { role: 'user', content: messageText }],
        }),
      })
      const data = await res.json()
      const content = res.ok
        ? data.content
        : (getOfflineResponse(messageText) ?? `💙 Recuerda que lo que sientes es válido.\n\nSi necesitas hablar con alguien:\n• **SAPTEL:** 55 5259-8121\n• **CONASAMA:** 800 290-0024`)
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content,
        timestamp: new Date(),
      }])
    } catch {
      const offline = getOfflineResponse(messageText) ?? `💙 Sin conexión. Si necesitas ayuda:\n• **SAPTEL:** 55 5259-8121`
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: offline,
        timestamp: new Date(),
      }])
    } finally {
      setIsLoading(false)
    }
  }

  // Función para manejar el envío del formulario. Evita que el formulario se envíe de forma predeterminada, y en 
  // su lugar llama a la función `sendMessage` con el contenido de la entrada del usuario. Esto permite que el usuario
  // envíe su mensaje al hacer clic en el botón de enviar o al presionar Enter, sin recargar la página.
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); sendMessage(input) }

  // Renderizar la interfaz de chat, que incluye un mensaje de alerta con información de contacto para crisis emocionales, 
  // un área de mensajes que muestra la conversación entre el usuario y el asistente, botones de acceso rápido para enviar 
  // mensajes predefinidos, y un formulario para que el usuario ingrese sus propios mensajes. El área de mensajes se 
  // desplaza automáticamente hacia el final cada vez que se actualiza la lista de mensajes, y el botón de enviar se 
  // desactiva si la entrada está vacía o si se está cargando una respuesta del asistente.
  if (!premiumLoading && !isPremium) {
    return (
      <div className="flex flex-col h-[calc(100dvh-8rem)] pb-36 items-center justify-center p-4">
        <UpgradeBanner
          title="Chat de Apoyo Psicológico"
          description="El acompañante de bienestar con IA está disponible solo en planes Premium y Familiar."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] pb-36">
      <Card className="mb-4 border-primary/30 bg-primary/5">
        <CardContent className="flex items-center justify-center gap-3 py-2 px-3">
          <AlertCircle className="w-5 h-5 text-primary shrink-0" />
          <div className="text-center">
            <p className="text-base font-semibold">{t('medic_crisis')}</p>
            <p className="text-sm text-muted-foreground">
              <a href="tel:5552598121" className="text-primary underline font-bold">{t('medic_saptel')}</a>
              {' · '}{t('medic_saptelHours')}
            </p>
          </div>
        </CardContent>
      </Card>

      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-4 pb-4">
          {messages.map((message) => (
            <div key={message.id} className={cn('flex gap-3', message.role === 'user' ? 'justify-end' : 'justify-start')}>
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
              )}
              <div className={cn('max-w-[85%] rounded-2xl px-4 py-3', message.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-card border border-border rounded-bl-md')}>
                <div className="text-sm whitespace-pre-wrap"><FormattedMessage content={message.content} /></div>
                <p className={cn("text-xs mt-2 opacity-60", message.role === 'user' ? 'text-right' : '')}>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0"><Bot className="w-5 h-5 text-primary" /></div>
              <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary animate-pulse" /><span className="text-sm text-muted-foreground">{t('medic_writing')}</span></div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="flex gap-2 overflow-x-auto pb-3 mb-3">
        {quickPrompts.map((prompt) => {
          const Icon = prompt.icon
          return (
            <Button key={prompt.label} variant="outline" size={simpleMode ? 'default' : 'sm'} onClick={() => sendMessage(prompt.prompt)} disabled={isLoading} className="flex-shrink-0">
              <Icon className="w-4 h-4 mr-1.5" />{prompt.label}
            </Button>
          )
        })}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('medic_placeholder')} className={`${simpleMode ? 'min-h-[80px]' : 'min-h-[44px]'} max-h-[120px] resize-none`} rows={simpleMode ? 3 : 1}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e) } }} />
        <Button type="submit" size="icon" disabled={!input.trim() || isLoading} className="h-[44px] w-[44px] flex-shrink-0"><Send className="w-5 h-5" /></Button>
      </form>
    </div>
  )
}
