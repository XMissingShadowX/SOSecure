/*
  EmergencyChat — chat completamente integrado dentro de SOSecure.
  
  Flujo de identificación:
  - El usuario actual se identifica por su auth.uid() y su email.
  - Los contactos de emergencia se asocian por email (campo `email` en emergency_contacts).
  - Al enviar un mensaje, se busca el UUID del receptor usando la función RPC `get_user_id_by_email`.
  - Si el contacto no tiene cuenta en SOSecure → fallback a WhatsApp.
  - Si sí tiene cuenta → el mensaje se guarda en `chat_messages` y llega en tiempo real.
*/

'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import {
  MessageCircle, X, Send, MapPin, AlertTriangle, Phone,
  Bot, Loader2, Shield, ChevronLeft, Sparkles, UserCircle2, WifiOff
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface DBMessage {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  type: 'text' | 'location' | 'sos'
  is_read: boolean
  created_at: string
}

interface ChatMsg {
  id: string
  contactId: string
  contactName: string
  text: string
  timestamp: number
  isMe: boolean
  type: 'text' | 'location' | 'sos' | 'ai'
  loading?: boolean
}

// ─── ID especial para el asistente IA ────────────────────────────────────────

const AI_ID = '__safewalk_ai__'

// ─── Hook: Asistente IA ───────────────────────────────────────────────────────

function useAIChat(currentLocation: { latitude: number; longitude: number } | null) {
  const [history, setHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [loading, setLoading] = useState(false)

  const systemPrompt = `Eres SOSecure AI, asistente de seguridad personal integrado en la app SOSecure.
Ayudas a usuarios que pueden estar en situaciones de riesgo.
${currentLocation
    ? `Ubicación actual del usuario: lat ${currentLocation.latitude.toFixed(5)}, lon ${currentLocation.longitude.toFixed(5)}.`
    : 'No tienes acceso a la ubicación del usuario ahora mismo.'
  }
Responde en español de México. Sé conciso, empático y práctico.
Si el usuario está en peligro inmediato, dile que llame al 911 primero.
Nunca te presentes como "Claude".`

  const send = useCallback(async (userText: string): Promise<string> => {
    setLoading(true)
    const newHistory = [...history, { role: 'user' as const, content: userText }]
    try {
      const res = await fetch('/api/emergency-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory, location: currentLocation }),
      })
      const data = await res.json()
      const reply = res.ok ? data.content : 'No pude procesar tu mensaje. Intenta de nuevo.'
      setHistory([...newHistory, { role: 'assistant', content: reply }])
      return reply
    } catch {
      return 'Sin conexión al asistente. Verifica tu internet.'
    } finally {
      setLoading(false)
    }
  }, [history, currentLocation])

  return { send, loading }
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function EmergencyChat() {
  const { contacts, currentLocation, sosActive } = useAppStore()
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [unread, setUnread] = useState(0)
  const [sending, setSending] = useState(false)
  const [myId, setMyId] = useState<string | null>(null)

  const [resolvedIds, setResolvedIds] = useState<Record<string, string | null>>({})

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { send: sendAI, loading: aiLoading } = useAIChat(currentLocation)

  const primaryContacts = contacts.filter(
    c => c.importance === 'primary' || c.importance === 'secondary'
  )

  const activeContact = primaryContacts.find(c => {
    const email = (c as any).email as string | undefined
    return email ? resolvedIds[email] === activeId : c.id === activeId
  })
  const isAIActive = activeId === AI_ID
  const convoMessages = messages.filter(m => m.contactId === activeId)

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeId])

  useEffect(() => {
    if (activeId) setTimeout(() => inputRef.current?.focus(), 100)
  }, [activeId])

  // ── Cargar usuario actual ────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setMyId(data.user.id)
    })
  }, [])

  // ── Resolver emails → UUIDs via RPC ─────────────────────────────────────
  useEffect(() => {
    if (!myId || primaryContacts.length === 0) return
    const emails = primaryContacts
      .map(c => (c as any).email)
      .filter((e): e is string => !!e && !Object.prototype.hasOwnProperty.call(resolvedIds, e))

    if (emails.length === 0) return

    emails.forEach(async (email) => {
      const { data, error } = await supabase.rpc('get_user_id_by_email', { p_email: email })
      setResolvedIds(prev => ({ ...prev, [email]: error ? null : (data as string | null) }))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId, contacts.length])

  // ── Cargar mensajes históricos ────────────────────────────────────────────
  useEffect(() => {
    if (!myId) return
    supabase
      .from('chat_messages')
      .select('*')
      .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
      .order('created_at', { ascending: true })
      .limit(300)
      .then(({ data }) => {
        if (!data) return
        const converted = (data as DBMessage[]).map(m => dbToUI(m, myId))
        setMessages(converted)
        const unreadCount = (data as DBMessage[]).filter(
          m => m.receiver_id === myId && !m.is_read
        ).length
        setUnread(unreadCount)
      })
  }, [myId])

  // ── Realtime: mensajes entrantes ──────────────────────────────────────────
  useEffect(() => {
    if (!myId) return
    const channel = supabase
      .channel(`chat-realtime-${myId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `receiver_id=eq.${myId}`,
        },
        (payload) => {
          const m = payload.new as DBMessage
          const uiMsg = dbToUI(m, myId)
          setMessages(prev => [...prev, uiMsg])
          if (!open || activeId !== uiMsg.contactId) {
            setUnread(prev => prev + 1)
          } else {
            supabase.from('chat_messages').update({ is_read: true }).eq('id', m.id).then(() => {})
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [myId, open, activeId])

  // ── SOS automático ────────────────────────────────────────────────────────
  const contactsRef = useRef(primaryContacts)
  useEffect(() => { contactsRef.current = primaryContacts })

  useEffect(() => {
    if (!sosActive || !myId) return
    const sosText = currentLocation
      ? `🚨 ALERTA SOS — Estoy en peligro.\n📍 https://maps.google.com/?q=${currentLocation.latitude},${currentLocation.longitude}`
      : '🚨 ALERTA SOS — Estoy en peligro. No tengo ubicación disponible.'

    contactsRef.current.forEach(async (c) => {
      const email = (c as any).email as string | undefined
      const receiverId = email ? resolvedIds[email] : null

      if (receiverId && receiverId !== myId) {
        const { data: inserted } = await supabase
          .from('chat_messages')
          .insert({ sender_id: myId, receiver_id: receiverId, content: sosText, type: 'sos' })
          .select()
          .single()
        if (inserted) setMessages(prev => [...prev, dbToUI(inserted as DBMessage, myId)])
        await upsertConversation(supabase, myId, receiverId, sosText)
      } else if (c.phone) {
        const phone = c.phone.replace(/\D/g, '')
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(sosText)}`, '_blank', 'noopener')
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sosActive])

  // ── Abrir chat ────────────────────────────────────────────────────────────
  const openChat = useCallback((id: string) => {
    setActiveId(id)
    setUnread(0)

    if (id === AI_ID) {
      setMessages(prev => {
        if (prev.some(m => m.contactId === AI_ID)) return prev
        return [...prev, {
          id: 'ai-welcome',
          contactId: AI_ID,
          contactName: 'SOSecure AI',
          text: '¡Hola! Soy SOSecure AI, tu asistente de seguridad. ¿En qué puedo ayudarte hoy? 🛡️',
          timestamp: Date.now(),
          isMe: false,
          type: 'ai',
        }]
      })
      return
    }

    if (myId) {
      supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('receiver_id', myId)
        .eq('sender_id', id)
        .eq('is_read', false)
        .then(() => {})
    }
  }, [myId])

  // ── Enviar mensaje ────────────────────────────────────────────────────────
  const handleSend = useCallback(async (type: 'text' | 'location' = 'text') => {
    if (!activeId) return

    let text = ''
    if (type === 'location') {
      text = currentLocation
        ? `📍 Mi ubicación: https://maps.google.com/?q=${currentLocation.latitude},${currentLocation.longitude}`
        : '⚠️ No tengo ubicación disponible ahora.'
    } else {
      text = input.trim()
      if (!text) return
    }

    // IA
    if (activeId === AI_ID) {
      const userMsg: ChatMsg = {
        id: `u-${Date.now()}`,
        contactId: AI_ID,
        contactName: 'Tú',
        text,
        timestamp: Date.now(),
        isMe: true,
        type: type === 'location' ? 'location' : 'ai',
      }
      const loadingMsg: ChatMsg = {
        id: 'ai-loading',
        contactId: AI_ID,
        contactName: 'SOSecure AI',
        text: '',
        timestamp: Date.now(),
        isMe: false,
        type: 'ai',
        loading: true,
      }
      setMessages(prev => [...prev, userMsg, loadingMsg])
      setInput('')
      const reply = await sendAI(text)
      setMessages(prev => [
        ...prev.filter(m => !m.loading),
        {
          id: `ai-${Date.now()}`,
          contactId: AI_ID,
          contactName: 'SOSecure AI',
          text: reply,
          timestamp: Date.now(),
          isMe: false,
          type: 'ai',
        },
      ])
      return
    }

    // Contacto real
    if (!myId) return
    const receiverId = activeId

    setSending(true)
    const { data: inserted, error } = await supabase
      .from('chat_messages')
      .insert({
        sender_id: myId,
        receiver_id: receiverId,
        content: text,
        type: type === 'location' ? 'location' : 'text',
      })
      .select()
      .single()
    setSending(false)

    if (error) { console.error('[EmergencyChat] Error enviando:', error.message); return }
    if (inserted) setMessages(prev => [...prev, dbToUI(inserted as DBMessage, myId)])
    await upsertConversation(supabase, myId, receiverId, text)
    setInput('')
  }, [activeId, myId, input, currentLocation, sendAI])

  // ── Derivados para UI ─────────────────────────────────────────────────────
  const activeContactEmail = activeContact ? (activeContact as any).email as string | undefined : undefined
  const activeReceiverUUID = activeContactEmail ? resolvedIds[activeContactEmail] : undefined
  const activeHasAccount = activeReceiverUUID != null

  const allItems = [
    { id: AI_ID, name: 'SOSecure AI', subtitle: 'Consejos de seguridad y emergencias', isAI: true },
    ...primaryContacts.map(c => {
      const email = (c as any).email as string | undefined
      const uuid = email ? resolvedIds[email] : undefined
      return {
        id: uuid ?? c.id,
        name: c.name,
        subtitle: email ?? c.phone,
        phone: c.phone,
        importance: c.importance,
        hasAccount: uuid !== undefined && uuid !== null,
        resolving: uuid === undefined && !!email,
        isAI: false,
      }
    }),
  ]

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-28 right-4 z-50 w-14 h-14 rounded-full bg-primary shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Abrir chat"
      >
        <MessageCircle className="w-6 h-6 text-primary-foreground" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-white text-xs flex items-center justify-center font-bold">
            {unread}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="fixed bottom-20 right-0 left-0 mx-auto max-w-lg z-50 px-2">
      <div className="bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ height: '75vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/10 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {isAIActive ? (
              <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
            ) : activeContact ? (
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold text-xs">{activeContact.name.charAt(0).toUpperCase()}</span>
              </div>
            ) : (
              <MessageCircle className="w-5 h-5 text-primary flex-shrink-0" />
            )}
            <span className="font-semibold text-sm truncate">
              {isAIActive ? 'SOSecure AI' : activeContact ? activeContact.name : 'Chat'}
            </span>
            {isAIActive && <Badge variant="outline" className="text-xs border-primary/40 text-primary flex-shrink-0">IA</Badge>}
            {activeContact && !isAIActive && (
              activeHasAccount === false
                ? <Badge variant="outline" className="text-xs text-muted-foreground flex-shrink-0"><WifiOff className="w-2.5 h-2.5 mr-1 inline" />Sin cuenta</Badge>
                : activeHasAccount
                  ? <Badge variant="outline" className="text-xs text-green-600 border-green-500/40 flex-shrink-0">En SOSecure</Badge>
                  : <Badge variant="outline" className="text-xs flex-shrink-0">…</Badge>
            )}
            {sosActive && <Badge variant="destructive" className="text-xs animate-pulse flex-shrink-0">SOS</Badge>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {activeId && (
              <button onClick={() => setActiveId(null)} className="flex items-center gap-1 text-xs text-muted-foreground px-2 py-1 rounded hover:bg-muted">
                <ChevronLeft className="w-3 h-3" /> Volver
              </button>
            )}
            <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-muted">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Lista de contactos */}
        {!activeId && (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {allItems.map(item => {
              const lastMsg = messages.filter(m => m.contactId === item.id).slice(-1)[0]
              return (
                <button
                  key={item.id}
                  onClick={() => openChat(item.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/80 active:scale-[0.98] transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    {item.isAI
                      ? <Shield className="w-5 h-5 text-primary" />
                      : <span className="text-primary font-bold text-sm">{item.name.charAt(0).toUpperCase()}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      {item.isAI && <Badge variant="outline" className="text-xs border-primary/40 text-primary">Asistente</Badge>}
                      {!item.isAI && (item as any).resolving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                      {!item.isAI && (item as any).hasAccount && <Badge variant="outline" className="text-xs text-green-600 border-green-500/40">En SOSecure</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {lastMsg ? lastMsg.text.slice(0, 50) + (lastMsg.text.length > 50 ? '…' : '') : item.subtitle}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Conversación */}
        {activeId && (
          <>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {convoMessages.length === 0 && !isAIActive && (
                <p className="text-xs text-muted-foreground text-center pt-4">
                  {activeHasAccount
                    ? `Escribe para chatear con ${activeContact?.name ?? 'este contacto'} dentro de SOSecure`
                    : `${activeContact?.name ?? 'Este contacto'} no tiene cuenta en SOSecure. Puedes compartir tu ubicación vía WhatsApp.`
                  }
                </p>
              )}
              {convoMessages.map(msg => (
                <div key={msg.id} className={`flex items-end gap-2 ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                  {!msg.isMe && (
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mb-1">
                      {msg.type === 'ai' ? <Bot className="w-3 h-3 text-primary" /> : <UserCircle2 className="w-3 h-3 text-primary" />}
                    </div>
                  )}
                  <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm break-words ${
                    msg.loading ? 'bg-muted text-muted-foreground'
                    : msg.type === 'sos' ? 'bg-destructive text-white'
                    : msg.type === 'location' ? 'bg-primary/20 text-foreground'
                    : (msg.type === 'ai' && !msg.isMe) ? 'bg-muted text-foreground'
                    : msg.isMe ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                  }`}>
                    {msg.loading ? (
                      <div className="flex items-center gap-2 py-0.5">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span className="text-xs">Escribiendo…</span>
                      </div>
                    ) : (
                      <>
                        {msg.type === 'sos' && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                        {msg.type === 'location' && <MapPin className="w-3 h-3 inline mr-1" />}
                        <span style={{ whiteSpace: 'pre-line' }}>{msg.text}</span>
                        <p className={`text-xs mt-1 ${msg.isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                          {new Date(msg.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Acciones rápidas */}
            <div className="flex gap-2 px-3 pt-2 flex-shrink-0 flex-wrap">
              <button
                onClick={() => handleSend('location')}
                disabled={sending || (isAIActive && aiLoading)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                <MapPin className="w-3 h-3" /> Compartir ubicación
              </button>
              {!isAIActive && activeContact?.phone && (
                <a href={`tel:${activeContact.phone}`} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-500/10 text-green-600 text-xs font-medium hover:bg-green-500/20 transition-colors">
                  <Phone className="w-3 h-3" /> Llamar
                </a>
              )}
              {!isAIActive && activeHasAccount === false && activeContact?.phone && (
              <a
                href={`https://wa.me/${activeContact.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-600/10 text-green-700 text-xs font-medium hover:bg-green-600/20 transition-colors"
              >
                <Phone className="w-3 h-3" /> WhatsApp
              </a>
          )}
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 p-3 border-t border-border flex-shrink-0">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend('text') } }}
                placeholder={
                  isAIActive ? 'Pregunta algo a SOSecure AI…'
                  : activeHasAccount === false ? 'Este contacto no tiene cuenta en SOSecure'
                  : 'Escribe un mensaje…'
                }
                disabled={sending || (isAIActive && aiLoading) || (!isAIActive && activeHasAccount === false)}
                className="flex-1 bg-muted rounded-full px-4 py-2 text-sm outline-none disabled:opacity-50"
              />
              <Button
                size="icon"
                onClick={() => handleSend('text')}
                disabled={!input.trim() || sending || (isAIActive && aiLoading) || (!isAIActive && activeHasAccount === false)}
                className="rounded-full w-9 h-9 flex-shrink-0"
              >
                {(sending || (isAIActive && aiLoading))
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />
                }
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dbToUI(m: DBMessage, myId: string): ChatMsg {
  const isMe = m.sender_id === myId
  return {
    id: m.id,
    contactId: isMe ? m.receiver_id : m.sender_id,
    contactName: isMe ? 'Tú' : '...',
    text: m.content,
    timestamp: new Date(m.created_at).getTime(),
    isMe,
    type: m.type,
  }
}

async function upsertConversation(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  otherId: string,
  lastMessage: string
) {
  const [user_a, user_b] = [userId, otherId].sort()
  await supabase
    .from('chat_conversations')
    .upsert(
      { user_a, user_b, last_message: lastMessage, last_message_at: new Date().toISOString() },
      { onConflict: 'user_a,user_b' }
    )
}