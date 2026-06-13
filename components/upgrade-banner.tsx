'use client'

import { Lock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface UpgradeBannerProps {
  title: string
  description: string
  compact?: boolean
}

export function UpgradeBanner({ title, description, compact = false }: UpgradeBannerProps) {
  const router = useRouter()

  if (compact) {
    return (
      <div className="flex flex-col gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
        <div className="flex items-start gap-2">
          <Lock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 text-xs h-8" onClick={() => router.push('/plan-premium/pago')}>
            Premium — $59/mes
          </Button>
          <Button size="sm" variant="outline" className="flex-1 text-xs h-8" onClick={() => router.push('/plan-familiar/pago')}>
            Familiar — $499/año
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex flex-col items-center gap-4 py-6 px-4">
        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
          <Lock className="w-6 h-6 text-primary" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-base">{title}</p>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        <div className="flex flex-col gap-2 w-full">
          <Button className="w-full" onClick={() => router.push('/plan-premium/pago')}>
            Plan Premium — $59/mes
          </Button>
          <Button variant="outline" className="w-full" onClick={() => router.push('/plan-familiar/pago')}>
            Plan Familiar — $499/año
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
