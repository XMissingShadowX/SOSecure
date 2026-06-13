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
import { cn } from '@/lib/utils'
import {
  MessageCircle, X, Send, MapPin, AlertTriangle, Phone,
  Bot, Loader2, Shield, ChevronLeft, Sparkles, UserCircle2, WifiOff, FileVideo, FileAudio, Video, Radio, Camera
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { liveChannelName } from '@/lib/live-stream'
import type { LiveFramePayload, LiveStatusPayload, VideoChunkPayload } from '@/lib/live-stream'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface DBMessage {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  type: 'text' | 'location' | 'sos' | 'media'
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
  type: 'text' | 'location' | 'sos' | 'ai' | 'media'
  loading?: boolean
}

// ─── IDs especiales ───────────────────────────────────────────────────────────

const AI_ID = '__safewalk_ai__'
const LIVE_ID = '__live_sos__'

// ─── Renderizador de mensajes multimedia ──────────────────────────────────────

function MediaMessage({ text, isMe, timestamp }: { text: string; isMe: boolean; timestamp: number }) {
  const lines = text.split('\n')
  const label = lines[0] ?? ''
  const url = lines[1] ?? ''
  const isAudio = label.includes('Audio') || label.includes('audio')
  const isVideo = label.includes('Video') || label.includes('video')

  return (
    <div className="space-y-2 min-w-[200px]">
      <div className="flex items-center gap-1.5 text-xs font-medium">
        {isAudio ? <FileAudio className="w-3.5 h-3.5" /> : <FileVideo className="w-3.5 h-3.5" />}
        {label}
      </div>
      {url && isAudio && (
        <audio controls src={url} className="w-full h-8" style={{ minWidth: 180 }} />
      )}
      {url && isVideo && (
        <video controls src={url} className="w-full rounded-lg max-h-40 object-cover" />
      )}
      {url && !isAudio && !isVideo && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs underline break-all">{url}</a>
      )}
      <p className={`text-xs ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
        {new Date(timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  )
}

// ─── Visualizador de transmisión en vivo ──────────────────────────────────────

/*
  Estrategia de máxima fluidez en el receptor:
  - "Live-edge seeking": tras cada appendBuffer, si el video está > 0.5 s atrás
    del borde del buffer, salta instantáneamente al frente.
  - playbackRate = 1.05 cuando el retraso es 0.2-0.5 s (alcanza el borde sin salto brusco).
  - Buffer recortado a los últimos 3 s para evitar acumulación de memoria.
  - Cola de chunks: si se acumulan > 3 sin procesar (red lenta), descarta los viejos.
*/

const LIVE_EDGE_JUMP    = 0.5   // segundos de retraso antes de saltar al frente
const LIVE_EDGE_CATCHUP = 0.2   // segundos de retraso antes de acelerar playbackRate
const BUFFER_KEEP_S     = 3     // segundos de buffer a conservar

function LiveStreamViewer({ alertId }: { alertId: string }) {
  const videoRef     = useRef<HTMLVideoElement>(null)
  const msRef        = useRef<MediaSource | null>(null)
  const sbRef        = useRef<SourceBuffer | null>(null)
  const queueRef     = useRef<ArrayBuffer[]>([])
  const mimeRef      = useRef<string | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  const [isLive,   setIsLive]   = useState(false)
  const [mode,     setMode]     = useState<'video' | 'jpeg' | null>(null)
  const [jpgFrame, setJpgFrame] = useState<string | null>(null)
  const [waiting,  setWaiting]  = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let destroyed  = false

    // ── live-edge seeking ────────────────────────────────────────────────────
    const snapToLiveEdge = () => {
      const video = videoRef.current
      const sb    = sbRef.current
      if (!video || !sb || sb.buffered.length === 0) return
      const edge = sb.buffered.end(0)
      const lag  = edge - video.currentTime
      if (lag > LIVE_EDGE_JUMP) {
        video.currentTime = edge - 0.1
        video.playbackRate = 1
      } else if (lag > LIVE_EDGE_CATCHUP) {
        video.playbackRate = 1.05
      } else {
        video.playbackRate = 1
      }
    }

    // ── flush de la cola de chunks ───────────────────────────────────────────
    const flushQueue = () => {
      const sb = sbRef.current
      if (!sb || sb.updating || queueRef.current.length === 0) return

      // Si la cola crece demasiado (red lenta), descartar chunks viejos.
      while (queueRef.current.length > 3) queueRef.current.shift()

      try {
        sb.appendBuffer(queueRef.current.shift()!)
      } catch { /* noop */ }
    }

    // ── después de cada append: recortar buffer + snap al borde ─────────────
    const onUpdateEnd = () => {
      const sb = sbRef.current
      if (!sb) return
      // Recortar buffer antiguo.
      if (sb.buffered.length > 0) {
        const end = sb.buffered.end(0)
        const start = sb.buffered.start(0)
        if (end - start > BUFFER_KEEP_S) {
          try { sb.remove(start, end - BUFFER_KEEP_S) } catch { /* noop */ }
        }
      }
      snapToLiveEdge()
      flushQueue()
    }

    // ── inicializar MediaSource ──────────────────────────────────────────────
    const initMediaSource = (mimeType: string): boolean => {
      const video = videoRef.current
      if (!video || !('MediaSource' in window)) return false
      try {
        if (!MediaSource.isTypeSupported(mimeType)) return false
        const ms  = new MediaSource()
        msRef.current = ms
        const url = URL.createObjectURL(ms)
        objectUrlRef.current = url
        video.src = url
        ms.addEventListener('sourceopen', () => {
          if (destroyed) return
          try {
            const sb = ms.addSourceBuffer(mimeType)
            // mode=segments es obligatorio para streams vivos.
            sb.mode = 'segments'
            sbRef.current = sb
            sb.addEventListener('updateend', onUpdateEnd)
            flushQueue()
          } catch { /* noop */ }
        })
        return true
      } catch { return false }
    }

    // ── decodificar base64 y encolar ─────────────────────────────────────────
    const appendChunk = (b64: string) => {
      try {
        const binary = atob(b64)
        const bytes  = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        queueRef.current.push(bytes.buffer)
        flushQueue()
        const video = videoRef.current
        if (video && video.paused) video.play().catch(() => {})
      } catch { /* noop */ }
    }

    // ── suscripción al canal ─────────────────────────────────────────────────
    const channel = supabase
      .channel(liveChannelName(alertId), { config: { broadcast: { ack: false } } })
      .on('broadcast', { event: 'status' }, ({ payload }) => {
        const p = payload as LiveStatusPayload
        setIsLive(p.live)
        if (!p.live) return
        setWaiting(false)
        setMode(p.mode)
        if (p.mode === 'video' && p.mimeType && !mimeRef.current) {
          mimeRef.current = p.mimeType
          initMediaSource(p.mimeType)
        }
      })
      .on('broadcast', { event: 'video_chunk' }, ({ payload }) => {
        const p = payload as VideoChunkPayload
        setIsLive(true)
        setWaiting(false)
        setMode('video')

        // Si status aún no llegó pero el primer chunk trae mimeType, usarlo.
        if (!mimeRef.current && p.mimeType) {
          mimeRef.current = p.mimeType
        }
        if (!mimeRef.current) return

        if (p.seq === 0 && !sbRef.current) {
          // Encolar el chunk ANTES de initMediaSource; sourceopen lo procesará.
          const binary = atob(p.chunk)
          const bytes  = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
          queueRef.current.unshift(bytes.buffer) // al frente: es la cabecera
          initMediaSource(mimeRef.current)
        } else {
          appendChunk(p.chunk)
        }
      })
      .on('broadcast', { event: 'frame' }, ({ payload }) => {
        const p = payload as LiveFramePayload
        setIsLive(true)
        setWaiting(false)
        setMode('jpeg')
        setJpgFrame(p.img)
      })
      .subscribe()

    return () => {
      destroyed = true
      supabase.removeChannel(channel)
      const ms = msRef.current
      if (ms && ms.readyState === 'open') { try { ms.endOfStream() } catch { /* noop */ } }
      if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null }
      const video = videoRef.current
      if (video) { video.pause(); video.playbackRate = 1; video.src = '' }
      msRef.current = null; sbRef.current = null; queueRef.current = []; mimeRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertId])

  // ── Estado "esperando" ───────────────────────────────────────────────────
  if (waiting) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <Radio className="w-8 h-8 text-destructive animate-pulse" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Esperando transmisión…</p>
          <p className="text-xs mt-1">El video aparecerá en cuanto la cámara comience a enviar.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2 px-1">
      <div className="relative rounded-xl overflow-hidden bg-black">
        <div className={`absolute top-2 left-2 z-10 flex items-center gap-1 text-white text-xs px-2 py-0.5 rounded-full font-semibold ${isLive ? 'bg-destructive' : 'bg-black/60'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-white animate-pulse' : 'bg-gray-400'}`} />
          {isLive ? 'EN VIVO' : 'Transmisión terminada'}
        </div>

        {/* Video real (MediaSource) */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`w-full rounded-xl object-cover max-h-72 ${mode === 'video' ? 'block' : 'hidden'}`}
          style={{ background: '#000' }}
        />

        {/* Fallback JPEG */}
        {mode === 'jpeg' && jpgFrame && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={jpgFrame} alt="Transmisión en vivo" className="w-full rounded-xl object-cover max-h-72" />
        )}
      </div>
    </div>
  )
}

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
  const { contacts, currentLocation, sosActive, sosAlert, simpleMode } = useAppStore()
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

  // ── Grabación en tiempo real → chat ──────────────────────────────────────
  const myIdRef = useRef(myId)
  useEffect(() => { myIdRef.current = myId }, [myId])
  const resolvedIdsRef = useRef(resolvedIds)
  useEffect(() => { resolvedIdsRef.current = resolvedIds }, [resolvedIds])

  useEffect(() => {
    const handler = async (e: Event) => {
      const { url, mimeType, segmentNumber, isFinal } = (e as CustomEvent).detail as {
        url: string; mimeType: string; segmentNumber: number; isFinal: boolean
      }
      const currentMyId = myIdRef.current
      if (!currentMyId) return

      const isVideo = mimeType.includes('mp4') || mimeType.includes('webm')
      const label = isFinal
        ? `🎥 Grabación completa SOS`
        : `🎥 Grabación en vivo — segmento ${segmentNumber}`

      const content = `${label}\n${url}`

      for (const contact of contactsRef.current) {
        const email = (contact as any).email as string | undefined
        const receiverId = email ? resolvedIdsRef.current[email] : null
        if (!receiverId || receiverId === currentMyId) continue

        const { data: inserted } = await supabase
          .from('chat_messages')
          .insert({ sender_id: currentMyId, receiver_id: receiverId, content, type: 'media' })
          .select()
          .single()
        if (inserted) {
          setMessages(prev => [...prev, dbToUI(inserted as DBMessage, currentMyId)])
          await upsertConversation(supabase, currentMyId, receiverId, label)
        }
      }

      // Mostrar también en la conversación local para el usuario
      setMessages(prev => [...prev, {
        id: `rec-local-${Date.now()}`,
        contactId: '__local_sos__',
        contactName: 'SOSecure',
        text: content,
        timestamp: Date.now(),
        isMe: true,
        type: 'media',
      }])
      setOpen(true)
    }

    window.addEventListener('sosecure:recording-segment', handler)
    return () => window.removeEventListener('sosecure:recording-segment', handler)
  }, [])

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

  const SOS_REC_ID = '__local_sos__'
  const hasLocalRecs = messages.some(m => m.contactId === SOS_REC_ID)
  const isLiveItem = activeId === LIVE_ID

  const allItems = [
    { id: AI_ID, name: 'SOSecure AI', subtitle: 'Consejos de seguridad y emergencias', isAI: true },
    ...(sosActive && sosAlert ? [{ id: LIVE_ID, name: '🔴 Transmisión en vivo', subtitle: 'Video de cámara en tiempo real — SOS activo', isAI: false, isLive: true, alertId: sosAlert.id }] : []),
    ...(hasLocalRecs ? [{ id: SOS_REC_ID, name: 'Mis grabaciones SOS', subtitle: 'Grabaciones automáticas de emergencia', isAI: false, isSosRec: true }] : []),
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
        className={cn(
          "fixed bottom-28 right-4 z-50 rounded-full bg-primary shadow-lg flex items-center justify-center active:scale-95 transition-transform",
          simpleMode ? "w-18 h-18" : "w-14 h-14"
        )}
        style={simpleMode ? { width: '4.5rem', height: '4.5rem' } : undefined}
        aria-label="Abrir chat"
      >
        <MessageCircle className={simpleMode ? "w-8 h-8 text-primary-foreground" : "w-6 h-6 text-primary-foreground"} />
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
            {activeId ? (
              <button onClick={() => setActiveId(null)} className="flex items-center gap-1 text-xs text-muted-foreground px-2 py-1 rounded hover:bg-muted flex-shrink-0">
                <ChevronLeft className="w-4 h-4" /> Volver
              </button>
            ) : isAIActive ? (
              <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
            ) : isLiveItem ? (
              <Camera className="w-5 h-5 text-destructive flex-shrink-0" />
            ) : activeContact ? (
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold text-xs">{activeContact.name.charAt(0).toUpperCase()}</span>
              </div>
            ) : (
              <MessageCircle className="w-5 h-5 text-primary flex-shrink-0" />
            )}
            <span className="font-semibold text-sm truncate">
              {isAIActive ? 'SOSecure AI' : isLiveItem ? 'Transmisión en vivo' : activeContact ? activeContact.name : 'Chat'}
            </span>
            {isAIActive && <Badge variant="outline" className="text-xs border-primary/40 text-primary flex-shrink-0">IA</Badge>}
            {isLiveItem && <Badge variant="destructive" className="text-xs animate-pulse flex-shrink-0 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-white" />EN VIVO</Badge>}
            {activeContact && !isAIActive && !isLiveItem && (
              activeHasAccount === false
                ? <Badge variant="outline" className="text-xs text-muted-foreground flex-shrink-0"><WifiOff className="w-2.5 h-2.5 mr-1 inline" />Sin cuenta</Badge>
                : activeHasAccount
                  ? <Badge variant="outline" className="text-xs text-green-600 border-green-500/40 flex-shrink-0">En SOSecure</Badge>
                  : <Badge variant="outline" className="text-xs flex-shrink-0">…</Badge>
            )}
            {sosActive && !isLiveItem && <Badge variant="destructive" className="text-xs animate-pulse flex-shrink-0">SOS</Badge>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
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
                  className={cn("w-full flex items-center gap-3 rounded-xl bg-muted/40 hover:bg-muted/80 active:scale-[0.98] transition-all text-left", simpleMode ? "p-4" : "p-3")}
                >
                  <div className={cn("rounded-full flex items-center justify-center flex-shrink-0", simpleMode ? "w-14 h-14" : "w-10 h-10", (item as any).isLive ? 'bg-destructive/20 ring-2 ring-destructive animate-pulse' : (item as any).isSosRec ? 'bg-destructive/20' : 'bg-primary/20')}>
                    {item.isAI
                      ? <Shield className={simpleMode ? "w-7 h-7 text-primary" : "w-5 h-5 text-primary"} />
                      : (item as any).isLive
                        ? <Camera className={simpleMode ? "w-7 h-7 text-destructive" : "w-5 h-5 text-destructive"} />
                        : (item as any).isSosRec
                          ? <Video className={simpleMode ? "w-7 h-7 text-destructive" : "w-5 h-5 text-destructive"} />
                          : <span className={cn("text-primary font-bold", simpleMode ? "text-lg" : "text-sm")}>{item.name.charAt(0).toUpperCase()}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className={cn("font-medium truncate", simpleMode ? "text-base" : "text-sm")}>{item.name}</p>
                      {item.isAI && <Badge variant="outline" className="text-xs border-primary/40 text-primary">Asistente</Badge>}
                      {!item.isAI && (item as any).resolving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                      {!item.isAI && (item as any).hasAccount && <Badge variant="outline" className="text-xs text-green-600 border-green-500/40">En SOSecure</Badge>}
                    </div>
                    <p className={cn("text-muted-foreground truncate mt-0.5", simpleMode ? "text-sm" : "text-xs")}>
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
              {/* Vista de transmisión en vivo */}
              {isLiveItem && sosAlert && (
                <LiveStreamViewer alertId={sosAlert.id} />
              )}

              {!isLiveItem && convoMessages.length === 0 && !isAIActive && (
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
                  <div className={cn(`max-w-[80%] rounded-2xl break-words`, simpleMode ? 'px-4 py-3 text-base' : 'px-3 py-2 text-sm',
                    msg.loading ? 'bg-muted text-muted-foreground'
                    : msg.type === 'sos' ? 'bg-destructive text-white'
                    : msg.type === 'location' ? 'bg-primary/20 text-foreground'
                    : msg.type === 'media' ? (msg.isMe ? 'bg-primary/20 text-foreground' : 'bg-muted text-foreground')
                    : (msg.type === 'ai' && !msg.isMe) ? 'bg-muted text-foreground'
                    : msg.isMe ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                  )}>
                    {msg.loading ? (
                      <div className="flex items-center gap-2 py-0.5">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span className="text-xs">Escribiendo…</span>
                      </div>
                    ) : msg.type === 'media' ? (
                      <MediaMessage text={msg.text} isMe={msg.isMe} timestamp={msg.timestamp} />
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

            {/* Acciones rápidas — ocultas en vista de transmisión en vivo */}
            {!isLiveItem && (
            <div className={cn("flex gap-2 px-3 pt-2 flex-shrink-0 flex-wrap", simpleMode && "pt-3 gap-3")}>
              <button
                onClick={() => handleSend('location')}
                disabled={sending || (isAIActive && aiLoading)}
                className={cn("flex items-center gap-1 rounded-full bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors disabled:opacity-50", simpleMode ? "px-4 py-2.5 text-sm" : "px-3 py-1.5 text-xs")}
              >
                <MapPin className={simpleMode ? "w-4 h-4" : "w-3 h-3"} /> Compartir ubicación
              </button>
              {!isAIActive && activeContact?.phone && (
                <a href={`tel:${activeContact.phone}`} className={cn("flex items-center gap-1 rounded-full bg-green-500/10 text-green-600 font-medium hover:bg-green-500/20 transition-colors", simpleMode ? "px-4 py-2.5 text-sm" : "px-3 py-1.5 text-xs")}>
                  <Phone className={simpleMode ? "w-4 h-4" : "w-3 h-3"} /> Llamar
                </a>
              )}
              {!isAIActive && activeHasAccount === false && activeContact?.phone && (
              <a
                href={`https://wa.me/${activeContact.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("flex items-center gap-1 rounded-full bg-green-600/10 text-green-700 font-medium hover:bg-green-600/20 transition-colors", simpleMode ? "px-4 py-2.5 text-sm" : "px-3 py-1.5 text-xs")}
              >
                <Phone className={simpleMode ? "w-4 h-4" : "w-3 h-3"} /> WhatsApp
              </a>
          )}
            </div>
            )}

            {/* Input — oculto en vista de transmisión en vivo */}
            {!isLiveItem && (
            <div className={cn("flex items-center gap-2 border-t border-border flex-shrink-0", simpleMode ? "p-4" : "p-3")}>
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
                className={cn("flex-1 bg-muted rounded-full px-4 outline-none disabled:opacity-50", simpleMode ? "py-3 text-base" : "py-2 text-sm")}
              />
              <Button
                size="icon"
                onClick={() => handleSend('text')}
                disabled={!input.trim() || sending || (isAIActive && aiLoading) || (!isAIActive && activeHasAccount === false)}
                className={cn("rounded-full flex-shrink-0", simpleMode ? "w-12 h-12" : "w-9 h-9")}
              >
                {(sending || (isAIActive && aiLoading))
                  ? <Loader2 className={simpleMode ? "w-5 h-5 animate-spin" : "w-4 h-4 animate-spin"} />
                  : <Send className={simpleMode ? "w-5 h-5" : "w-4 h-4"} />
                }
              </Button>
            </div>
            )}
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