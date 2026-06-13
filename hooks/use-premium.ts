import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function usePremium() {
  const [isPremium, setIsPremium] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.rpc('has_premium_access').then(({ data }) => {
      setIsPremium(!!data)
      setLoading(false)
    })
  }, [])

  return { isPremium, loading }
}
