'use client'

import { useState } from 'react'
import { Shield, MapPin, Bell, Camera, Mic, CheckCircle, AlertCircle } from 'lucide-react'
import { usePermissions } from '@/hooks/use-permissions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface PermissionGateProps {
  children: React.ReactNode
}

const permissionItems = [
  { key: 'geolocation', icon: MapPin, label: 'Ubicación', desc: 'Para rastrearte y alertarte de zonas peligrosas', required: true },
  { key: 'notifications', icon: Bell, label: 'Notificaciones', desc: 'Para alertas de seguridad y emergencias', required: true },
  { key: 'camera', icon: Camera, label: 'Cámara', desc: 'Para grabación durante emergencias SOS', required: false },
  { key: 'microphone', icon: Mic, label: 'Micrófono', desc: 'Para grabación de audio en emergencias', required: false },
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

  // Show gate only on first load if required permissions not granted
  if (allGranted || dismissed) return <>{children}</>

  const requiredMissing = permissions.geolocation !== 'granted' || permissions.notifications !== 'granted'

  if (!requiredMissing) return <>{children}</>

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 mb-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">SOSecure necesita permisos</h1>
          <p className="text-sm text-muted-foreground text-center">
            Para protegerte correctamente, necesitamos acceso a los siguientes permisos:
          </p>
        </div>

        <div className="space-y-3">
          {permissionItems.map((item) => {
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
                      {item.required && <span className="text-xs text-destructive font-medium">Requerido</span>}
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

        <Button className="w-full" onClick={handleRequest} disabled={requesting}>
          {requesting ? 'Solicitando permisos...' : 'Conceder permisos'}
        </Button>

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
