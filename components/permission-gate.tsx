'use client'

import { useState } from 'react'
import { Shield, MapPin, Bell, Camera, Mic, CheckCircle, AlertCircle } from 'lucide-react'
import { usePermissions } from '@/hooks/use-permissions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface PermissionGateProps {
  children: React.ReactNode
}

// Solo los permisos requeridos se muestran en la pantalla inicial.
// Cámara y micrófono se piden bajo demanda cuando el usuario los necesita.
const requiredPermissionItems = [
  { key: 'geolocation', icon: MapPin, label: 'Ubicación', desc: 'Para rastrearte y alertarte de zonas peligrosas', required: true },
  { key: 'notifications', icon: Bell, label: 'Notificaciones', desc: 'Para alertas de seguridad y emergencias', required: true },
] as const

const optionalPermissionItems = [
  { key: 'camera', icon: Camera, label: 'Cámara', desc: 'Se pedirá al activar grabación SOS', required: false },
  { key: 'microphone', icon: Mic, label: 'Micrófono', desc: 'Se pedirá al activar grabación SOS', required: false },
] as const

export function PermissionGate({ children }: PermissionGateProps) {
  const { permissions, allGranted, requestAll } = usePermissions()
  const [requesting, setRequesting] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const handleRequest = async () => {
    setRequesting(true)
    await requestAll()
    setRequesting(false)
  }

  if (allGranted || dismissed) return <>{children}</>

  const hasRequired =
    permissions.geolocation === 'granted' && permissions.notifications === 'granted'
  const hardDenied =
    permissions.geolocation === 'denied' || permissions.notifications === 'denied'

  // Mostrar gate si: aún no tiene los permisos requeridos Y no los ha descartado
  if (hasRequired || dismissed) return <>{children}</>

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 mb-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">SOSecure necesita permisos</h1>
          <p className="text-sm text-muted-foreground text-center">
            Para protegerte correctamente necesitamos acceso a tu ubicación y notificaciones.
          </p>
        </div>

        {/* Permisos requeridos */}
        <div className="space-y-3">
          {requiredPermissionItems.map((item) => {
            const Icon = item.icon
            const state = permissions[item.key]
            const granted = state === 'granted'
            return (
              <Card key={item.key} className={granted ? 'border-safe/50 bg-safe/5' : ''}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className={`p-2 rounded-full ${granted ? 'bg-safe/20' : 'bg-muted'}`}>
                    <Icon className={`w-5 h-5 ${granted ? 'text-safe' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{item.label}</p>
                      <span className="text-xs text-destructive font-medium">Requerido</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  {granted
                    ? <CheckCircle className="w-5 h-5 text-safe flex-shrink-0" />
                    : <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  }
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Permisos opcionales — solo informativos, sin botón propio */}
        <div className="rounded-lg bg-muted/50 p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Se pedirán cuando los necesites</p>
          {optionalPermissionItems.map((item) => {
            const Icon = item.icon
            return (
              <div key={item.key} className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <span className="text-xs font-medium">{item.label}</span>
                  <span className="text-xs text-muted-foreground"> — {item.desc}</span>
                </div>
              </div>
            )
          })}
        </div>

        {hardDenied ? (
          <div className="text-center space-y-2">
            <p className="text-sm text-destructive">
              Permisos bloqueados. Ve a Configuración de tu navegador/dispositivo para habilitarlos.
            </p>
            <Button variant="outline" className="w-full" onClick={() => setDismissed(true)}>
              Continuar de todas formas
            </Button>
          </div>
        ) : (
          <Button className="w-full" onClick={handleRequest} disabled={requesting}>
            {requesting ? 'Solicitando permisos...' : 'Conceder permisos'}
          </Button>
        )}

        <button
          className="w-full text-sm text-muted-foreground underline"
          onClick={() => setDismissed(true)}
        >
          Continuar sin todos los permisos
        </button>
      </div>
    </div>
  )
}