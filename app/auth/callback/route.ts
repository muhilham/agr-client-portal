import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getClientAccessByEmail } from '@/lib/clients/active-client'
import { NextRequest, NextResponse } from 'next/server'
import { safeNextTarget } from '@/lib/auth/safe-next'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://order.agroastery.com'

  // Helper: redirect and always clear the post-login carry-over cookie, so a
  // stale target from a failed/earlier login attempt can never leak into a
  // different user's session on the same browser.
  function redirectClearingNext(url: string | URL): NextResponse {
    const response = NextResponse.redirect(new URL(url, siteUrl))
    response.cookies.delete('post_login_next')
    return response
  }

  const supabase = await createClient()
  if (code) await supabase.auth.exchangeCodeForSession(code)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return redirectClearingNext('/auth/unauthorized')
  }

  // Auto-link: if client record exists with matching email but user_id IS NULL,
  // this means admin created the client record but no auth account existed yet.
  // Now that auth account exists (via Google OAuth), link it so checkout works.
  const adminClient = getSupabaseAdmin()
  const { data: clientToLink } = await adminClient
    .from('clients')
    .select('id')
    .eq('email', user.email)
    .is('user_id', null)
    .maybeSingle()

  if (clientToLink) {
    await adminClient
      .from('clients')
      .update({ user_id: user.id })
      .eq('id', clientToLink.id)
  }

  const clientAccess = await getClientAccessByEmail(user.email)
  if (clientAccess.status === 'inactive') {
    return redirectClearingNext('/auth/unauthorized?state=inactive')
  }

  if (clientAccess.status === 'unregistered') {
    const params = new URLSearchParams({ state: 'unregistered', email: user.email })
    return redirectClearingNext(`/auth/unauthorized?${params}`)
  }

  // Consume the post-login redirect carried through the login round-trip.
  // Set by middleware when an unauthenticated `/portal` visitor hits the login
  // wall. The value was validated once before the cookie was set, and is
  // re-validated HERE on purpose: the cookie is client-modifiable state, so
  // this second check is defense-in-depth, not redundancy — do not remove.
  const nextRaw = request.cookies.get('post_login_next')?.value ?? null
  const next = safeNextTarget(nextRaw)

  return redirectClearingNext(next ?? '/portal')
}
