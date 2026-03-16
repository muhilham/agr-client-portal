import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LoginButton from './_components/LoginButton'

export default async function LoginPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/portal')
  }

  return (
    <main className="min-h-screen bg-brand-black flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        {/* Brand */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-full border border-[rgba(245,235,201,0.25)] flex items-center justify-center">
            <span className="text-2xl font-bold text-brand-crema">A</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-widest text-brand-crema uppercase">
            Agroastery
          </h1>
          <p className="text-sm text-brand-parchment">Portal Pemesanan Klien</p>
        </div>

        {/* Card */}
        <div className="w-full rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight p-8 flex flex-col gap-6">
          <div className="text-center">
            <h2 className="text-lg font-medium text-brand-crema">Masuk</h2>
            <p className="mt-1 text-sm text-brand-parchment">
              Gunakan akun Google yang terdaftar
            </p>
          </div>
          <LoginButton />
        </div>

        <p className="text-xs text-brand-parchment text-center opacity-60">
          Hanya untuk klien terdaftar Agroastery
        </p>
      </div>
    </main>
  )
}
