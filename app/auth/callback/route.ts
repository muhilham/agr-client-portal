import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getClientAccessByEmail } from '@/lib/clients/active-client'
import { NextRequest, NextResponse } from 'next/server'
import { safeNextTarget } from '@/lib/auth/safe-next'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://order.agroastery.com'

  const supabase = await createClient()
  if (code) await supabase.auth.exchangeCodeForSession(code)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.redirect(new URL('/auth/unauthorized', siteUrl))
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
    return NextResponse.redirect(new URL('/auth/unauthorized?state=inactive', siteUrl))
  }

  if (clientAccess.status === 'unregistered') {
    const params = new URLSearchParams({ state: 'unregistered', email: user.email })
    return NextResponse.redirect(new URL(`/auth/unauthorized?${params}`, siteUrl))
  }

  // Consume the post-login redirect carried through the login round-trip.
  // Set by middleware when an unauthenticated `/portal` visitor hits the login wall.
  const nextRaw = request.cookies.get('post_login_next')?.value ?? null
  const next = safeNextTarget(nextRaw)
  // Delete after first read so it's not re-used on subsequent navigations.
  return NextResponse.redirect(new URL(next ?? '/portal', siteUrl), {
    headers: { 'Set-Cookie': 'post_login_next=; path=/; max-age=0' },
  })
}
