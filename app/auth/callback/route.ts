import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  const supabase = await createClient()
  if (code) await supabase.auth.exchangeCodeForSession(code)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.redirect(new URL('/auth/unauthorized', origin))
  }

  const { data: client } = await supabase
    .from('clients')
    .select('id, is_active')
    .eq('email', user.email)
    .single()

  if (!client || !client.is_active) {
    return NextResponse.redirect(new URL('/auth/unauthorized', origin))
  }

  return NextResponse.redirect(new URL('/portal', origin))
}
