'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AppShell } from '@/components/app-shell'
import { Shield } from 'lucide-react'
import Link from 'next/link'

export default function HomePage() {
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setAuthenticated(!!user)
      setLoading(false)
    })
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setAuthenticated(!!session?.user)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
            <Shield className="w-10 h-10 text-primary animate-pulse" />
          </div>
          <p className="text-muted-foreground text-sm">Loading SOSecure...</p>
        </div>
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="flex flex-col items-center gap-2 mb-8">
            <div className="w-20 h-20 rounded-3xl bg-primary/20 flex items-center justify-center">
              <Shield className="w-12 h-12 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">SOSecure</h1>
            <p className="text-muted-foreground">Your personal safety companion</p>
          </div>
          <div className="flex flex-col gap-3">
            <Link
              href="/auth/login"
              className="flex items-center justify-center h-11 rounded-lg bg-primary text-primary-foreground font-semibold text-sm"
            >
              Sign In
            </Link>
            <Link
              href="/auth/sign-up"
              className="flex items-center justify-center h-11 rounded-lg border border-border text-foreground font-semibold text-sm"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <AppShell />
}
