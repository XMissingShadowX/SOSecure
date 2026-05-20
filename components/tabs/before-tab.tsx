/*
  Pestaña "Antes" de la aplicación SOSecure, que se muestra antes de activar el modo de seguridad. Esta pestaña 
  ayuda a los usuarios a prepararse antes de salir, con funciones como un temporizador de seguridad, información 
  sobre zonas seguras cercanas, seguimiento de contactos que comparten su ubicación, y un resumen de los contactos 
  listos para alertar en caso de emergencia. El código maneja la lógica del temporizador, la geolocalización para 
  mostrar zonas seguras, y la integración con la tienda global para gestionar el estado de los contactos y el temporizador.
*/

'use client'

// React y librerías
import { useState, useEffect, useCallback } from 'react'
import { ShieldCheck, Clock, MapPin, Users, Timer, AlertTriangle, Plus, Trash2, Eye } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useGeolocation } from '@/hooks/use-geolocation'
import { sendAlarmNotification, playAlarmSound } from '@/lib/notifications'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

// Tipos de zonas seguras para mostrar en la sección de zonas seguras cercanas, con etiquetas y colores asociados 
// para cada tipo
const SAFE_ZONE_TYPES = [
  { type: 'pharmacy', label: '💊 Farmacia', color: 'text-green-400' },
  { type: 'police', label: '👮 Policía', color: 'text-blue-400' },
  { type: 'hospital', label: '🏥 Hospital', color: 'text-red-400' },
  { type: 'store', label: '🏪 Tienda', color: 'text-yellow-400' },
]

// Función para formatear el tiempo restante del temporizador de seguridad en formato "m:ss" para 
// mostrarlo en la UI, redondeando hacia arriba para mostrar el minuto completo restante y asegurando que los segundos
// siempre tengan dos dígitos
function formatCountdown(ms: number) {
  const totalSec = Math.ceil(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Componente principal para la pestaña "Antes" de la aplicación SOSecure, que incluye la lógica y la UI para el
// temporizador de seguridad, zonas seguras cercanas, seguimiento de contactos, y resumen de contactos listos para alertar. 
// Utiliza la tienda global para acceder a los contactos y el estado del temporizador, y maneja la geolocalización para 
// mostrar zonas seguras cercanas. También incluye efectos para manejar el conteo regresivo del temporizador 
// y acciones automáticas cuando el temporizador expira, como activar una alerta SOS y notificar a los contactos.
export function BeforeTab() {
  // Acceder a los contactos y el estado del temporizador de seguridad desde la tienda global de la aplicación, 
  // así como funciones para actualizar el estado del temporizador y activar el modo SOS. También usar el hook de 
  // geolocalización para obtener las coordenadas actuales del usuario, y manejar estados locales para el conteo 
  // regresivo del temporizador, la configuración del tiempo del temporizador, y la visibilidad de los diálogos 
  // de configuración y zonas seguras.
  const { contacts, securityTimerActive, securityTimerEnd, setSecurityTimer, setSosActive } = useAppStore()
  const { coordinates } = useGeolocation({ watch: true })
  const [countdown, setCountdown] = useState<number | null>(null)
  const [timerMinutes, setTimerMinutes] = useState('30')
  const [showTimerDialog, setShowTimerDialog] = useState(false)
  const [showSafeZones, setShowSafeZones] = useState(false)
  const [trackedUsers] = useState<{ name: string; status: string }[]>([
    // Placeholder — en una implementación real, esta información vendría de la base de datos o de la tienda global, 
    // mostrando los contactos que actualmente comparten su ubicación contigo y su estado 
    // (por ejemplo, "En camino", "Llegó a destino", etc.)
  ])

  // Efecto para manejar el conteo regresivo del temporizador de seguridad, actualizando el estado del conteo cada segundo,
  // y tomando acciones automáticas cuando el temporizador expira, como activar una alerta SOS y notificar a los contactos.
  useEffect(() => {
    // Si el temporizador de seguridad no está activo o no tiene una hora de finalización establecida, limpiar el conteo 
    // regresivo y salir del efecto
    if (!securityTimerActive || !securityTimerEnd) {
      setCountdown(null)
      return
    }

    // Función para actualizar el conteo regresivo del temporizador cada segundo, calculando el tiempo restante y 
    // actualizando
    const tick = () => {
      // Calcular el tiempo restante restando la hora actual de la hora de finalización del temporizador
      const remaining = securityTimerEnd - Date.now()
      // Si el tiempo restante es menor o igual a cero, significa que el temporizador ha expirado, por lo que 
      // se actualiza el estado del conteo a cero, se reproduce un sonido de alarma, se envía una notificación 
      // de alerta a los contactos, se activa el modo SOS, y se desactiva el temporizador de seguridad. Si el 
      // tiempo restante es mayor a cero, se actualiza el estado del conteo con el tiempo restante, y si el tiempo 
      // restante es menor a 5 minutos (pero mayor a 4.9 minutos para evitar múltiples notificaciones), se envía una 
      // notificación de advertencia a los contactos indicando que quedan 5 minutos en el temporizador de seguridad.
      if (remaining <= 0) {
        setCountdown(0)
        // Timer expired → trigger SOS automatically
        playAlarmSound()
        sendAlarmNotification('⏰ Temporizador de seguridad expirado', 'No se recibió confirmación de llegada — activando alerta', true)
        setSosActive(true)
        setSecurityTimer(false, null)
      } else {
        setCountdown(remaining)
        // Warn at 5 min
        if (remaining < 5 * 60 * 1000 && remaining > 4.9 * 60 * 1000) {
          sendAlarmNotification('⏰ SOSecure', 'Quedan 5 minutos en tu temporizador de seguridad')
        }
      }
    }
    // Iniciar el conteo regresivo llamando a la función
    tick()
    // Configurar un intervalo para actualizar el conteo regresivo cada segundo, y limpiar el intervalo 
    // cuando el componente se desmonte o cuando cambien las dependencias del efecto
    const id = setInterval(tick, 1000)
    // Limpiar el intervalo cuando el componente se desmonte o cuando cambien las dependencias del efecto 
    // para evitar fugas de memoria
    return () => clearInterval(id)
  }, [securityTimerActive, securityTimerEnd, setSosActive, setSecurityTimer])

  // Función para iniciar el temporizador de seguridad, calculando la hora de finalización basada en los minutos configurados,
  // actualizando el estado del temporizador en la tienda global, cerrando el diálogo de configuración, y enviando una 
  // notificación a los contactos indicando que el temporizador ha sido iniciado con el tiempo configurado.
  const startTimer = useCallback(() => {
    const mins = parseInt(timerMinutes) || 30
    const endTime = Date.now() + mins * 60 * 1000
    setSecurityTimer(true, endTime)
    setShowTimerDialog(false)
    sendAlarmNotification('⏱️ Temporizador iniciado', `Tienes ${mins} minutos para llegar a tu destino`)
  }, [timerMinutes, setSecurityTimer])

  // Función para cancelar el temporizador de seguridad, desactivando el temporizador en la tienda global, 
  // limpiando el estado del conteo regresivo, y enviando una notificación a los contactos indicando que el 
  // temporizador ha sido cancelado y que el usuario llegó con seguridad a su destino.
  const cancelTimer = useCallback(() => {
    setSecurityTimer(false, null)
    setCountdown(null)
    sendAlarmNotification('✅ Temporizador cancelado', 'Llegaste con seguridad')
  }, [setSecurityTimer])

  // Renderizar la UI de la pestaña "Antes" con varias secciones, incluyendo una tarjeta informativa sobre el modo "Antes",
  // una sección para el temporizador de seguridad que muestra el conteo regresivo y opciones para iniciar o cancelar el temporizador, 
  // una sección para mostrar zonas seguras cercanas basada en la geolocalización, una sección para mostrar contactos que comparten su ubicación, 
  // y una sección para mostrar un resumen de los contactos listos para alertar. La UI utiliza componentes de diseño como tarjetas, botones, diálogos, 
  // y badges para organizar la información y las acciones disponibles para el usuario.
  return (
    <div className="flex flex-col gap-6 pb-40">
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <div>
            <p className="font-semibold text-sm">Modo ANTES</p>
            <p className="text-xs text-muted-foreground">Prepárate antes de salir</p>
          </div>
        </CardContent>
      </Card>

      {/* Security Timer */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Timer className="w-5 h-5 text-primary" />
            Temporizador de Seguridad
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {securityTimerActive && countdown !== null ? (
            <div className="space-y-4">
              <div className="text-center">
                <div className={`text-5xl font-mono font-bold ${countdown < 5 * 60 * 1000 ? 'text-destructive' : 'text-safe'}`}>
                  {formatCountdown(countdown)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Tiempo restante para llegar</p>
              </div>
              <div className={`p-3 rounded-lg ${countdown < 5 * 60 * 1000 ? 'bg-destructive/10' : 'bg-safe/10'}`}>
                <p className="text-xs text-center text-muted-foreground">
                  Si el tiempo expira sin confirmación, se activará una alerta automática
                </p>
              </div>
              <Button className="w-full" variant="outline" onClick={cancelTimer}>
                ✅ Llegué con seguridad
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Activa un temporizador. Si no confirmas tu llegada, se alertará a tus contactos automáticamente.
              </p>
              <Dialog open={showTimerDialog} onOpenChange={setShowTimerDialog}>
                <DialogTrigger asChild>
                  <Button className="w-full">
                    <Clock className="w-4 h-4 mr-2" />
                    Iniciar Temporizador
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Configurar Temporizador de Seguridad</DialogTitle>
                    <DialogDescription>
                      ¿Cuántos minutos tienes para llegar a tu destino?
                    </DialogDescription>
                  </DialogHeader>
                  <FieldGroup>
                    <Field>
                      <FieldLabel>Minutos</FieldLabel>
                      <Input
                        type="number"
                        min="1"
                        max="240"
                        value={timerMinutes}
                        onChange={(e) => setTimerMinutes(e.target.value)}
                        placeholder="30"
                      />
                    </Field>
                    <div className="flex gap-2 flex-wrap">
                      {[5, 10, 15, 30, 60].map(m => (
                        <button key={m} onClick={() => setTimerMinutes(m.toString())}
                          className={`px-3 py-1.5 rounded-md text-sm ${timerMinutes === m.toString() ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                          {m} min
                        </button>
                      ))}
                    </div>
                  </FieldGroup>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowTimerDialog(false)}>Cancelar</Button>
                    <Button onClick={startTimer}>Iniciar</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </CardContent>
      </Card>

      {/* Safe Zones */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="w-5 h-5 text-safe" />
            Zonas Seguras Cercanas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Locales donde puedes refugiarte en caso de emergencia:
          </p>
          {coordinates ? (
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '💊 Farmacia', query: 'farmacia' },
                { label: '👮 Policía', query: 'ministerio+publico' },
                { label: '🏥 Hospital', query: 'hospital' },
                { label: '🏪 Tienda 24h', query: 'tienda+24+horas' },
              ].map((z) => (
                <button
                  key={z.query}
                  onClick={() => window.open(`https://www.google.com/maps/search/${z.query}/@${coordinates.latitude},${coordinates.longitude},15z`, '_blank')}
                  className="p-3 bg-muted/50 rounded-lg flex items-center gap-2 hover:bg-muted transition-colors text-left w-full"
                >
                  <span className="text-lg">{z.label.split(' ')[0]}</span>
                  <div>
                    <p className="text-xs font-medium text-foreground">{z.label.split(' ').slice(1).join(' ')}</p>
                    <p className="text-xs text-muted-foreground">Ver en mapa</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {SAFE_ZONE_TYPES.map((z) => (
                <div key={z.type} className="p-3 bg-muted/50 rounded-lg flex items-center gap-2">
                  <span className="text-lg">{z.label.split(' ')[0]}</span>
                  <div>
                    <p className="text-xs font-medium">{z.label.split(' ').slice(1).join(' ')}</p>
                    <p className="text-xs text-muted-foreground">Activa ubicación</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tracking */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-5 h-5 text-primary" />
            Seguimiento a Contactos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {trackedUsers.length === 0 ? (
            <div className="text-center py-4">
              <Users className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No hay usuarios compartiéndote su ubicación</p>
              <p className="text-xs text-muted-foreground mt-1">Pídeles a tus contactos que habiliten el seguimiento</p>
            </div>
          ) : (
            <div className="space-y-2">
              {trackedUsers.map((u, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground text-center">
            El seguimiento requiere que el contacto acepte compartir su ubicación
          </p>
        </CardContent>
      </Card>

      {/* Contacts summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="w-5 h-5 text-warning" />
            Contactos listos para alertar
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Agrega contactos desde la pestaña Inicio</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {contacts.map((c) => (
                <Badge key={c.id} variant="secondary" className="text-sm !text-black dark:!text-white">
                  {c.name} · {c.importance === 'primary' ? '🔴' : c.importance === 'secondary' ? '🟡' : '🔵'}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
