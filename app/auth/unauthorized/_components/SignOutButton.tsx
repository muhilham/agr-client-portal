'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignOutButton() {
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <button
      data-testid="sign-out-button"
      className="mt-3 inline-flex items-center justify-center rounded-lg border border-[rgba(245,235,201,0.25)] text-brand-parchment hover:text-brand-crema hover:bg-[rgba(245,235,201,0.08)] transition-colors text-sm px-4 py-2.5 min-h-[44px]"
    >
      Keluar dari portal
    </button>
  )
}
