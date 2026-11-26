import { createClient } from '@/lib/supabase/server'
import { getClientAccessByEmail } from '@/lib/clients/active-client'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatIDR } from '@/lib/payment'

export const dynamic = 'force-dynamic'

// #411 — portal credit history (issue UI work: grants, spends,
// refunds with reasons). Reads flow through the client-RLS policy on
// credit_entries (email = auth.jwt()->>'email'), so this page can
// only ever see the signed-in client's own rows.

const KIND_LABEL: Record<string, string> = {
  GRANT: 'Pemberian kredit',
  REVOKE: 'Penarikan kredit',
  SPEND: 'Dipakai untuk pesanan',
  REFUND: 'Refund pesanan dibatalkan',
  PREPAY: 'Pembayaran deal',
}

export default async function CreditsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) redirect('/')

  const clientAccess = await getClientAccessByEmail(user.email)
  if (clientAccess.status !== 'active') redirect('/portal')
  const client = clientAccess.client

  const [{ data: entries }, { count }] = await Promise.all([
    supabase
      .from('credit_entries')
      .select('id, delta, kind, reason, order_id, created_at')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('credit_entries')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', client.id),
  ])

  // Reviewer F9: contract says zero-credit clients see NO credit UI
  // anywhere — a direct /portal/credits hit by a client that has never
  // had an entry (shared link, stale tab after a grant→revoke wipe)
  // must bounce home, not render the balance card.
  if (!entries || entries.length === 0 || count === 0) redirect('/portal')

  const { data: bal } = await supabase
    .from('client_credit_balances')
    .select('balance')
    .eq('client_id', client.id)
    .maybeSingle()
  const balance = Number(bal?.balance ?? 0)

  return (
    <main className="min-h-screen bg-brand-black">
      <nav className="sticky top-0 z-40 bg-brand-black border-b border-[rgba(245,235,201,0.25)] px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/portal" className="text-brand-crema font-semibold text-sm" data-testid="credits-back-link">
            ← Katalog
          </Link>
          <p className="text-brand-parchment text-xs uppercase tracking-wider">Kredit</p>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
        <div className="rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight px-5 py-4">
          <p className="text-brand-parchment text-xs uppercase tracking-wider">Saldo Credit</p>
          <p className="text-brand-honey font-semibold text-2xl mt-1" data-testid="credits-balance">
            {formatIDR(balance)}
          </p>
        </div>

        <div className="rounded-xl border border-[rgba(245,235,201,0.25)] bg-brand-midnight overflow-hidden">
          <div className="px-5 py-3 border-b border-[rgba(245,235,201,0.15)]">
            <p className="text-brand-parchment text-xs uppercase tracking-wider">Riwayat</p>
          </div>
          {(count ?? 0) === 0 ? (
            <p className="px-5 py-6 text-brand-parchment text-sm" data-testid="credits-empty">
              Belum ada aktivitas kredit.
            </p>
          ) : (
            <ul className="divide-y divide-[rgba(245,235,201,0.08)]">
              {(entries ?? []).map((e) => (
                <li key={e.id} className="px-5 py-3 flex items-start justify-between gap-3" data-testid={`credit-row-${e.kind.toLowerCase()}`}>
                  <div className="flex flex-col">
                    <p className="text-brand-crema text-sm font-medium">
                      {KIND_LABEL[e.kind] ?? e.kind}
                      {e.order_id && (
                        <Link
                          href={`/portal/orders/${e.order_id}`}
                          className="ml-1 text-brand-honey text-xs underline underline-offset-2"
                        >
                          lihat pesanan
                        </Link>
                      )}
                    </p>
                    <p className="text-brand-parchment text-xs mt-0.5">{e.reason}</p>
                    <p className="text-brand-parchment text-xs opacity-60 mt-0.5">
                      {new Intl.DateTimeFormat('id-ID', {
                        timeZone: 'Asia/Jakarta',
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(e.created_at))}
                    </p>
                  </div>
                  <p
                    className={`text-sm font-semibold tabular-nums ${
                      Number(e.delta) >= 0 ? 'text-green-400' : 'text-brand-crema'
                    }`}
                  >
                    {Number(e.delta) >= 0 ? '+' : '-'}
                    {formatIDR(Math.abs(Number(e.delta)))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  )
}
