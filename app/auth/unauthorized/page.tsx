import Link from 'next/link'
import Image from 'next/image'

export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>
}) {
  const { state } = await searchParams
  const isInactive = state === 'inactive'

  return (
    <main className="min-h-screen bg-brand-black flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-8 text-center">
        <Image
          src="/agroastery-logo.svg"
          alt="Agroastery"
          width={180}
          height={28}
        />

        <div className="w-full rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight p-8 flex flex-col gap-5">
          <div className="text-4xl">🔒</div>
          <h2 className="text-lg font-medium text-brand-crema">Akses Ditolak</h2>
          <p className="text-sm text-brand-parchment leading-relaxed">
            {isInactive
              ? 'Akun Anda tidak aktif. Hubungi tim Agroastery.'
              : 'Akun Anda belum terdaftar sebagai klien Agroastery, atau akun Anda tidak aktif.'}
          </p>
          <p className="text-sm text-brand-parchment leading-relaxed">
            Hubungi tim kami untuk mendapatkan akses:
          </p>
          <a
            href="mailto:hello@agroastery.com"
            className="text-brand-crema hover:text-brand-honey transition-colors text-sm font-medium"
            data-testid="contact-email"
          >
            hello@agroastery.com
          </a>
        </div>

        <Link
          href="/"
          data-testid="back-to-login-link"
          className="text-sm text-brand-parchment hover:text-brand-crema transition-colors underline underline-offset-4"
        >
          Kembali ke halaman masuk
        </Link>
      </div>
    </main>
  )
}
