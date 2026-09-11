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
      onClick={handleSignOut}
      className="mt-3 text-sm text-brand-parchment hover:text-brand-crema transition-colors underline underline-offset-4"
    >
      Keluar dari portal
    </button>
  )
}
