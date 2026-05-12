'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send, MapPin, AlertTriangle, Phone } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface ChatMsg {
  id: string
  contactId: string
  contactName: string
  text: string
  timestamp: number
  isMe: boolean
  type: 'text' | 'location' | 'sos'
}

export function EmergencyChat() {
  const { contacts, currentLocation, sosActive } = useAppStore()
  const [open, setOpen] = useState(false)
  const [activeContactId, setActiveContactId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [unread, setUnread] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  const emergencyContacts = contacts.filter(c => c.importance === 'primary' || c.importance === 'secondary')
  const activeContact = emergencyContacts.find(c => c.id === activeContactId)
  const convoMessages = messages.filter(m => m.contactId === activeContactId)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeContactId])

  const emergencyContactsRef = useRef(emergencyContacts)
  useEffect(() => {
    emergencyContactsRef.current = emergencyContacts
  })

  useEffect(() => {
    if (!sosActive) return
    const contacts = emergencyContactsRef.current
    const sosMsg = currentLocation
      ? `🚨 ALERTA SOS — Estoy en peligro.\n📍 https://maps.google.com/?q=${currentLocation.latitude},${currentLocation.longitude}`
      : '🚨 ALERTA SOS — Estoy en peligro. No tengo ubicación disponible.'

    setMessages(prev => [
      ...prev,
      ...contacts.map(c => ({
        id: `sos-${c.id}-${Date.now()}`,
        contactId: c.id,
        contactName: c.name,
        text: sosMsg,
        timestamp: Date.now(),
        isMe: true,
        type: 'sos' as const,
      }))
    ])
    setUnread(prev => prev + contacts.length)
  }, [sosActive, currentLocation])

  const sendMessage = useCallback((type: 'text' | 'location' = 'text') => {
    if (!activeContactId) return
    const text = type === 'location'
      ? currentLocation
        ? `📍 Mi ubicación actual: https://maps.google.com/?q=${currentLocation.latitude},${currentLocation.longitude}`
        : '⚠️ No tengo ubicación disponible en este momento'
      : input.trim()

    if (!text) return

    const msg: ChatMsg = {
      id: `${Date.now()}-${Math.random()}`,
      contactId: activeContactId,
      contactName: activeContact?.name ?? '',
      text,
      timestamp: Date.now(),
      isMe: true,
      type,
    }
    setMessages(prev => [...prev, msg])
    setInput('')

    if (activeContact?.phone) {
      const phone = activeContact.phone.replace(/\D/g, '')
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
    }
  }, [activeContactId, activeContact, currentLocation, input])

  const openChat = (contactId: string) => {
    setActiveContactId(contactId)
    setUnread(0)
  }

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
      <div className="bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ height: '75vh' }}>

        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/10">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">
              {activeContact ? activeContact.name : 'Chat de Emergencia'}
            </span>
            {sosActive && <Badge variant="destructive" className="text-xs animate-pulse">SOS ACTIVO</Badge>}
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

        {!activeContact && (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {emergencyContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
                <MessageCircle className="w-10 h-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No tienes contactos de emergencia.</p>
                <p className="text-xs text-muted-foreground">Agrégalos en la pestaña <strong>Antes</strong>.</p>
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
                      <span className="text-primary font-bold text-sm">{c.name.charAt(0).toUpperCase()}</span>
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
                    <p className={`text-xs mt-1 ${msg.isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="flex gap-2 px-3 pt-2">
              <button
                onClick={() => sendMessage('location')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
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

            <div className="flex items-center gap-2 p-3 border-t border-border">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sendMessage('text') }}
                placeholder="Escribe un mensaje..."
                className="flex-1 bg-muted rounded-full px-4 py-2 text-sm outline-none"
              />
              <Button
                size="icon"
                onClick={() => sendMessage('text')}
                disabled={!input.trim()}
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