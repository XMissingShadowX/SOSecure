'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, MapPin, AlertTriangle } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { sendAlarmNotification } from '@/lib/notifications'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function AfterTab() {
  const { nearbyIncidents } = useAppStore()
  const [dangerZones, setDangerZones] = useState<{ lat: number; lng: number; count: number }[]>([])
  const [notifiedZoneCount, setNotifiedZoneCount] = useState(-1)

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

  return (
    <div className="flex flex-col gap-6 pb-40">
      <Card className="border-safe/50 bg-safe/5">
        <CardContent className="p-4 flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-safe" />
          <div>
            <p className="font-semibold text-sm">Modo DESPUÉS</p>
            <p className="text-xs text-muted-foreground">Seguimiento y protección post-incidente</p>
          </div>
        </CardContent>
      </Card>

      {dangerZones.length > 0 && (
        <Card className="border-warning bg-warning/10">
          <CardHeader className="pb-3">
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
