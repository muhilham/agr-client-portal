import { createClient } from '@/lib/supabase/server'
import { getClientAccessByEmail } from '@/lib/clients/active-client'
import { NextRequest, NextResponse } from 'next/server'

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

  const clientAccess = await getClientAccessByEmail(user.email)
  if (clientAccess.status === 'inactive') {
    return NextResponse.redirect(new URL('/auth/unauthorized?state=inactive', siteUrl))
  }

  if (clientAccess.status === 'unregistered') {
    const params = new URLSearchParams({ state: 'unregistered', email: user.email })
    return NextResponse.redirect(new URL(`/auth/unauthorized?${params}`, siteUrl))
  }

  return NextResponse.redirect(new URL('/portal', siteUrl))
}
