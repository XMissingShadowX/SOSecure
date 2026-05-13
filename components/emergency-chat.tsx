'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send, MapPin, AlertTriangle, Phone } from 'lucide-react'
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

interface UserProfile {
  id: string
  display_name: string | null
  phone: string | null
  avatar_url: string | null
}

/** Mensaje enriquecido para la UI */
interface ChatMsg {
  id: string
  contactId: string       // = receiver_id o sender_id (el "otro")
  contactName: string
  text: string
  timestamp: number
  isMe: boolean
  type: 'text' | 'location' | 'sos'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convierte un DBMessage en ChatMsg dado el uid propio */
function toUIMsg(m: DBMessage, myId: string, profiles: Record<string, UserProfile>): ChatMsg {
  const isMe = m.sender_id === myId
  const otherId = isMe ? m.receiver_id : m.sender_id
  const profile = profiles[otherId]
  return {
    id: m.id,
    contactId: otherId,
    contactName: profile?.display_name ?? otherId,
    text: m.content,
    timestamp: new Date(m.created_at).getTime(),
    isMe,
    type: m.type,
  }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function EmergencyChat() {
  const { contacts, currentLocation, sosActive } = useAppStore()
  const [open, setOpen] = useState(false)
  const [activeContactId, setActiveContactId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({})
  const [myId, setMyId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [unread, setUnread] = useState(0)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const emergencyContacts = contacts.filter(
    c => c.importance === 'primary' || c.importance === 'secondary'
  )
  const activeContact = emergencyContacts.find(c => c.id === activeContactId)
  const convoMessages = messages.filter(m => m.contactId === activeContactId)

  // ── Scroll automático ────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeContactId])

  // ── Cargar usuario actual ────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setMyId(data.user.id)
    })
  }, [])

  // ── Cargar perfiles de contactos de emergencia ───────────────────────────
  useEffect(() => {
    if (!myId || emergencyContacts.length === 0) return
    const supabase = createClient()

    const userIds = emergencyContacts.map(c => c.user_id).filter(Boolean)
    if (userIds.length === 0) return

    supabase
      .from('user_profiles')
      .select('id, display_name, phone, avatar_url')
      .in('id', userIds)
      .then(({ data }) => {
        if (!data) return
        const map: Record<string, UserProfile> = {}
        data.forEach(p => { map[p.id] = p })
        setProfiles(map)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId, contacts.length])

  // ── Cargar mensajes históricos y suscribir a tiempo real ─────────────────
  useEffect(() => {
    if (!myId) return
    const supabase = createClient()

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
        .order('created_at', { ascending: true })
        .limit(200)

      if (error) {
        console.error('[EmergencyChat] Error cargando mensajes:', error.message)
        return
      }
      if (data) {
        const converted = (data as DBMessage[]).map(m => toUIMsg(m, myId, profiles))
        setMessages(converted)

        // Contar no leídos (mensajes recibidos sin leer)
        const unreadCount = (data as DBMessage[]).filter(
          m => m.receiver_id === myId && !m.is_read
        ).length
        setUnread(unreadCount)
      }
    }

    loadMessages()

    // Realtime: escuchar inserciones nuevas
    const channel = supabase
      .channel(`chat-${myId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `receiver_id=eq.${myId}`,
        },
        (payload) => {
          const newMsg = payload.new as DBMessage
          const uiMsg = toUIMsg(newMsg, myId, profiles)
          setMessages(prev => [...prev, uiMsg])
          if (!open) setUnread(prev => prev + 1)

          // Marcar como leído si la conversación está abierta
          if (open && activeContactId === uiMsg.contactId) {
            supabase
              .from('chat_messages')
              .update({ is_read: true })
              .eq('id', newMsg.id)
              .then(() => {})
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId, open, activeContactId])

  // ── Marcar mensajes como leídos al abrir conversación ───────────────────
  const openChat = useCallback((contactId: string) => {
    setActiveContactId(contactId)
    setUnread(0)

    if (!myId) return
    const supabase = createClient()
    supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('receiver_id', myId)
      .eq('sender_id', contactId)
      .eq('is_read', false)
      .then(() => {})
  }, [myId])

  // ── Enviar SOS automático a todos los contactos ──────────────────────────
  const emergencyContactsRef = useRef(emergencyContacts)
  useEffect(() => { emergencyContactsRef.current = emergencyContacts })

  useEffect(() => {
    if (!sosActive || !myId) return
    const ctcts = emergencyContactsRef.current
    const sosText = currentLocation
      ? `🚨 ALERTA SOS — Estoy en peligro.\n📍 https://maps.google.com/?q=${currentLocation.latitude},${currentLocation.longitude}`
      : '🚨 ALERTA SOS — Estoy en peligro. No tengo ubicación disponible.'

    const supabase = createClient()

    ctcts.forEach(async (c) => {
      const receiverId = c.user_id
      if (!receiverId || receiverId === myId) return

      // Insertar en Supabase
      const { data: inserted, error } = await supabase
        .from('chat_messages')
        .insert({
          sender_id: myId,
          receiver_id: receiverId,
          content: sosText,
          type: 'sos',
        })
        .select()
        .single()

      if (error) {
        console.error('[EmergencyChat] Error enviando SOS:', error.message)
        return
      }

      // Actualizar conversación
      await upsertConversation(supabase, myId, receiverId, sosText)

      // Mostrar en UI local inmediatamente
      if (inserted) {
        setMessages(prev => [...prev, toUIMsg(inserted as DBMessage, myId, profiles)])
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sosActive])

  // ── Enviar mensaje ────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (type: 'text' | 'location' = 'text') => {
    if (!activeContactId || !myId) return

    const text = type === 'location'
      ? currentLocation
        ? `📍 Mi ubicación actual: https://maps.google.com/?q=${currentLocation.latitude},${currentLocation.longitude}`
        : '⚠️ No tengo ubicación disponible en este momento'
      : input.trim()

    if (!text) return

    const receiverId = activeContact?.user_id
    if (!receiverId) {
      // Sin user_id real: fallback WhatsApp (contacto externo sin cuenta)
      if (activeContact?.phone) {
        const phone = activeContact.phone.replace(/\D/g, '')
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
      }
      return
    }

    setSending(true)
    const supabase = createClient()

    const { data: inserted, error } = await supabase
      .from('chat_messages')
      .insert({
        sender_id: myId,
        receiver_id: receiverId,
        content: text,
        type,
      })
      .select()
      .single()

    setSending(false)

    if (error) {
      console.error('[EmergencyChat] Error enviando mensaje:', error.message)
      return
    }

    // Actualizar conversación (upsert last_message)
    await upsertConversation(supabase, myId, receiverId, text)

    // Mostrar en UI local
    if (inserted) {
      setMessages(prev => [...prev, toUIMsg(inserted as DBMessage, myId, profiles)])
    }

    setInput('')
  }, [activeContactId, activeContact, myId, currentLocation, input, profiles])

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-28 right-4 z-50 w-14 h-14 rounded-full bg-primary shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Abrir chat de emergencia"
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
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ height: '75vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/10">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">
              {activeContact ? activeContact.name : 'Chat de Emergencia'}
            </span>
            {sosActive && (
              <Badge variant="destructive" className="text-xs animate-pulse">SOS ACTIVO</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {activeContact && (
              <button
                onClick={() => setActiveContactId(null)}
                className="text-xs text-muted-foreground px-2 py-1 rounded hover:bg-muted"
              >
                ← Contactos
              </button>
            )}
            <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-muted">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Lista de contactos */}
        {!activeContact && (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {emergencyContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
                <MessageCircle className="w-10 h-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No tienes contactos de emergencia.</p>
                <p className="text-xs text-muted-foreground">
                  Agrégalos en la pestaña <strong>Antes</strong>.
                </p>
              </div>
            ) : (
              emergencyContacts.map(c => {
                const contactMsgs = messages.filter(m => m.contactId === c.id)
                const last = contactMsgs[contactMsgs.length - 1]
                return (
                  <button
                    key={c.id}
                    onClick={() => openChat(c.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/80 active:scale-98 transition-all text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold text-sm">
                        {c.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <Badge variant="outline" className="text-xs ml-1 flex-shrink-0">
                          {c.importance === 'primary' ? 'Principal' : 'Secundario'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {last ? last.text : c.phone}
                      </p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        )}

        {/* Conversación activa */}
        {activeContact && (
          <>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {convoMessages.length === 0 && (
                <p className="text-xs text-muted-foreground text-center pt-4">
                  Envía un mensaje o comparte tu ubicación con {activeContact.name}
                </p>
              )}
              {convoMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm break-words ${
                      msg.type === 'sos'
                        ? 'bg-destructive text-white'
                        : msg.type === 'location'
                        ? 'bg-primary/20 text-foreground'
                        : msg.isMe
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    {msg.type === 'sos' && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                    {msg.type === 'location' && <MapPin className="w-3 h-3 inline mr-1" />}
                    <span style={{ whiteSpace: 'pre-line' }}>{msg.text}</span>
                    <p
                      className={`text-xs mt-1 ${
                        msg.isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'
                      }`}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString('es-MX', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Acciones rápidas */}
            <div className="flex gap-2 px-3 pt-2">
              <button
                onClick={() => sendMessage('location')}
                disabled={sending}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                <MapPin className="w-3 h-3" /> Compartir ubicación
              </button>
              <a
                href={`tel:${activeContact.phone}`}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-500/10 text-green-600 text-xs font-medium hover:bg-green-500/20 transition-colors"
              >
                <Phone className="w-3 h-3" /> Llamar
              </a>
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 p-3 border-t border-border">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !sending) sendMessage('text') }}
                placeholder="Escribe un mensaje..."
                className="flex-1 bg-muted rounded-full px-4 py-2 text-sm outline-none"
                disabled={sending}
              />
              <Button
                size="icon"
                onClick={() => sendMessage('text')}
                disabled={!input.trim() || sending}
                className="rounded-full w-9 h-9 flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Utilidad: upsert conversación ────────────────────────────────────────────

async function upsertConversation(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  otherId: string,
  lastMessage: string
) {
  // Ordenar IDs para respetar la restricción UNIQUE(user_a, user_b)
  const [user_a, user_b] = [userId, otherId].sort()

  await supabase
    .from('chat_conversations')
    .upsert(
      {
        user_a,
        user_b,
        last_message: lastMessage,
        last_message_at: new Date().toISOString(),
      },
      { onConflict: 'user_a,user_b' }
    )
}