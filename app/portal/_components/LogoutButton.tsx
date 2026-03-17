'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <button
      onClick={handleLogout}
      className="text-brand-parchment text-sm hover:text-brand-crema transition-colors"
      data-testid="logout-button"
    >
      Keluar
    </button>
  )
}
