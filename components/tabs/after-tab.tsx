'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, MapPin, AlertTriangle, Home, Mic, Video, Download, Trash2, Loader2, ShieldAlert } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { sendAlarmNotification } from '@/lib/notifications'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { usePremium } from '@/hooks/use-premium'
import { UpgradeBanner } from '@/components/upgrade-banner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface SosAlertItem {
  id: string
  created_at: string
  latitude: number | null
  longitude: number | null
  status: string
}

interface StoredRecording {
  id: string
  recording_type: 'audio' | 'video'
  public_url: string
  duration_ms: number
  created_at: string
  latitude: number | null
  longitude: number | null
}

export function AfterTab() {
  const { isPremium } = usePremium()
  const { nearbyIncidents, contacts, simpleMode } = useAppStore()
  const [dangerZones, setDangerZones] = useState<{ lat: number; lng: number; count: number }[]>([])
  const [notifiedZoneCount, setNotifiedZoneCount] = useState(-1)
  const [arrivedSent, setArrivedSent] = useState(false)
  const [sendingArrived, setSendingArrived] = useState(false)
  const [arrivedResult, setArrivedResult] = useState<{ internal: number; whatsapp: number } | null>(null)
  const [recordings, setRecordings] = useState<StoredRecording[]>([])
  const [loadingRecordings, setLoadingRecordings] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [sosHistory, setSosHistory] = useState<SosAlertItem[]>([])
  const [sosHistoryFilter, setSosHistoryFilter] = useState<'7d' | '1m' | '3m' | '6m'>('1m')
  const [loadingSosHistory, setLoadingSosHistory] = useState(false)

  useEffect(() => {
    const high = nearbyIncidents.filter(i => i.severity === 'high')
    const zones = high.reduce<{ lat: number; lng: number; count: number }[]>((acc, inc) => {
      const existing = acc.find(z => Math.abs(z.lat - inc.latitude) < 0.005 && Math.abs(z.lng - inc.longitude) < 0.005)
      if (existing) { existing.count++ } else { acc.push({ lat: inc.latitude, lng: inc.longitude, count: 1 }) }
      return acc
    }, [])
    setDangerZones(zones)

    if (zones.length > 0 && zones.length !== notifiedZoneCount) {
      sendAlarmNotification('⚠️ Zona de Peligro', `Hay ${zones.length} zona(s) de alerta cercanas`)
      setNotifiedZoneCount(zones.length)
    }
  }, [nearbyIncidents])

  useEffect(() => {
    if (!isPremium) return
    async function fetchSosHistory() {
      setLoadingSosHistory(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoadingSosHistory(false); return }
      const filterMap = { '7d': 7, '1m': 30, '3m': 90, '6m': 180 }
      const days = filterMap[sosHistoryFilter]
      const since = new Date(Date.now() - days * 86400000).toISOString()
      const { data } = await supabase
        .from('sos_alerts')
        .select('id, created_at, latitude, longitude, status')
        .eq('user_id', user.id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
      setSosHistory(data ?? [])
      setLoadingSosHistory(false)
    }
    fetchSosHistory()
  }, [isPremium, sosHistoryFilter])

  useEffect(() => {
    async function fetchRecordings() {
      setLoadingRecordings(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoadingRecordings(false); return }
      const { data } = await supabase
        .from('recordings')
        .select('id, recording_type, public_url, duration_ms, created_at, latitude, longitude')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      setRecordings(data ?? [])
      setLoadingRecordings(false)
    }
    fetchRecordings()
  }, [])

  async function handleArrivedWell() {
    if (!contacts.length || sendingArrived) return
    setSendingArrived(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const content = `✅ Llegué bien a mi destino — ${new Date().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}`

    let internalCount = 0
    let whatsappCount = 0

    for (const contact of contacts) {
      const email = (contact as any).email as string | undefined

      // 1. Intentar por mensajería interna si el contacto tiene email registrado
      if (user && email) {
        const { data: receiverId } = await supabase.rpc('get_user_id_by_email', { p_email: email })
        if (receiverId && receiverId !== user.id) {
          const { error } = await supabase
            .from('chat_messages')
            .insert({ sender_id: user.id, receiver_id: receiverId, content, type: 'text' })
          if (!error) {
            await supabase
              .from('chat_conversations')
              .upsert(
                { user_a: [user.id, receiverId].sort()[0], user_b: [user.id, receiverId].sort()[1], last_message: content, last_message_at: new Date().toISOString() },
                { onConflict: 'user_a,user_b' }
              )
            internalCount++
            continue
          }
        }
      }

      // 2. Fallback: WhatsApp si el contacto no está en SOSecure o falla el interno
      const phone = contact.phone.replace(/\D/g, '')
      if (phone) {
        const waMsg = `${content}\n\nMensaje enviado automáticamente desde la app SOSecure.`
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(waMsg)}`, '_blank', 'noopener')
        whatsappCount++
        if (contacts.indexOf(contact) < contacts.length - 1) {
          await new Promise(r => setTimeout(r, 600))
        }
      }
    }

    await sendAlarmNotification(
      '✅ Llegaste bien',
      internalCount > 0
        ? `${internalCount} contacto${internalCount > 1 ? 's' : ''} notificado${internalCount > 1 ? 's' : ''} por SOSecure`
        : `Abriendo WhatsApp para ${whatsappCount} contacto${whatsappCount > 1 ? 's' : ''}`
    )

    setSendingArrived(false)
    setArrivedSent(true)
    setArrivedResult({ internal: internalCount, whatsapp: whatsappCount })
  }

  async function handleDeleteRecording(rec: StoredRecording) {
    setDeletingId(rec.id)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const ext = rec.public_url?.split('.').pop() ?? 'webm'
      await supabase.storage.from('recordings').remove([`${user.id}/${rec.id}.${ext}`])
      await supabase.from('recordings').delete().eq('id', rec.id)
      setRecordings(prev => prev.filter(r => r.id !== rec.id))
    }
    setDeletingId(null)
  }

  function formatDuration(ms: number) {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
  }

  return (
    <div className="flex flex-col gap-6 pb-40">
      <Card className="border-safe/50 bg-safe/5">
        <CardContent className="flex items-center justify-center gap-3 py-2 px-3">
          <CheckCircle className="w-5 h-5 shrink-0 text-safe" />
          <div className="text-center">
            <p className="font-semibold text-base">Modo DESPUÉS</p>
            <p className="text-sm text-muted-foreground">Seguimiento y protección post-incidente</p>
          </div>
        </CardContent>
      </Card>

      {/* Llegué bien */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Home className="w-5 h-5 text-safe" />
            Notificar llegada
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Avisa a tus contactos que llegaste bien. Si tienen SOSecure, recibirán el mensaje en la app; de lo contrario se enviará por WhatsApp.
          </p>
          {simpleMode && <p className="text-base text-muted-foreground">Avisa a tus contactos que llegaste bien.</p>}
          {arrivedSent && arrivedResult ? (
            <div className="space-y-2">
              {arrivedResult.internal > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-safe/10 text-safe text-sm font-medium">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  {arrivedResult.internal} contacto{arrivedResult.internal > 1 ? 's' : ''} notificado{arrivedResult.internal > 1 ? 's' : ''} por SOSecure
                </div>
              )}
              {arrivedResult.whatsapp > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted text-muted-foreground text-sm">
                  <CheckCircle className="w-4 h-4 shrink-0 text-safe" />
                  {arrivedResult.whatsapp} contacto{arrivedResult.whatsapp > 1 ? 's' : ''} notificado{arrivedResult.whatsapp > 1 ? 's' : ''} por WhatsApp
                </div>
              )}
            </div>
          ) : (
            <Button
              className={`w-full bg-safe hover:bg-safe/90 text-white ${simpleMode ? 'h-14 text-base font-bold' : ''}`}
              disabled={sendingArrived || contacts.length === 0}
              onClick={handleArrivedWell}
            >
              {sendingArrived ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</>
              ) : (
                <>✅ Llegué bien</>
              )}
            </Button>
          )}
          {contacts.length === 0 && (
            <p className="text-xs text-destructive">Agrega contactos de emergencia en la pestaña Inicio.</p>
          )}
          {arrivedSent && (
            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setArrivedSent(false)}>
              Enviar de nuevo
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Historial de Alertas SOS — oculto en Modo Simple */}
      {!simpleMode && <Card>
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="w-5 h-5 text-destructive" />
            Historial de Alertas SOS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-3">
          {!isPremium ? (
            <UpgradeBanner
              title="Historial de Alertas SOS"
              description="Accede a tus alertas pasadas con ubicación y grabaciones adjuntas."
              compact
            />
          ) : (
            <>
              <Select value={sosHistoryFilter} onValueChange={(v) => setSosHistoryFilter(v as typeof sosHistoryFilter)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Última semana</SelectItem>
                  <SelectItem value="1m">Último mes</SelectItem>
                  <SelectItem value="3m">Últimos 3 meses</SelectItem>
                  <SelectItem value="6m">Últimos 6 meses</SelectItem>
                </SelectContent>
              </Select>
              {loadingSosHistory ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : sosHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No hay alertas SOS en el período seleccionado.
                </p>
              ) : (
                <div className="space-y-2">
                  {sosHistory.map(alert => (
                    <div key={alert.id} className="flex items-center gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                      <ShieldAlert className="w-4 h-4 text-destructive shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">
                          {new Date(alert.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                        {alert.latitude && alert.longitude && (
                          <p className="text-xs text-muted-foreground font-mono">
                            {alert.latitude.toFixed(4)}, {alert.longitude.toFixed(4)}
                          </p>
                        )}
                      </div>
                      <Badge variant={alert.status === 'active' ? 'destructive' : 'secondary'} className="text-xs shrink-0">
                        {alert.status === 'active' ? 'Activa' : 'Resuelta'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>}

      {/* Grabaciones — ocultas en Modo Simple */}
      {!simpleMode && <Card>
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Video className="w-5 h-5 text-primary" />
            Mis grabaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRecordings ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : recordings.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No tienes grabaciones almacenadas.
            </p>
          ) : (
            <div className="space-y-2">
              {recordings.map(rec => (
                <div key={rec.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                  {rec.recording_type === 'video'
                    ? <Video className="w-4 h-4 text-primary shrink-0" />
                    : <Mic className="w-4 h-4 text-primary shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium capitalize">{rec.recording_type}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(rec.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                      {rec.duration_ms > 0 && ` · ${formatDuration(rec.duration_ms)}`}
                    </p>
                    {rec.latitude && rec.longitude && (
                      <p className="text-xs text-muted-foreground font-mono">
                        {rec.latitude.toFixed(4)}, {rec.longitude.toFixed(4)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <a href={rec.public_url} target="_blank" rel="noopener noreferrer" download>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      disabled={deletingId === rec.id}
                      onClick={() => handleDeleteRecording(rec)}
                    >
                      {deletingId === rec.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />
                      }
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>}

      {/* Zonas de peligro — ocultas en Modo Simple */}
      {!simpleMode && dangerZones.length > 0 && (
        <Card className="border-warning bg-warning/10">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-base text-warning">
              <AlertTriangle className="w-5 h-5" />
              Alertas de Zona Peligrosa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dangerZones.map((zone, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-warning/10 rounded-lg">
                <MapPin className="w-4 h-4 text-warning" />
                <div>
                  <p className="text-sm font-medium">{zone.count} incidente{zone.count > 1 ? 's' : ''} reportado{zone.count > 1 ? 's' : ''}</p>
                  <p className="text-xs text-muted-foreground font-mono">{zone.lat.toFixed(4)}, {zone.lng.toFixed(4)}</p>
                </div>
                <Badge variant="destructive" className="ml-auto">Evitar</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

    </div>
  )
}
