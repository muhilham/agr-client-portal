import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { safeNextTarget } from '../auth/safe-next'

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  const isPortalRoute = request.nextUrl.pathname.startsWith('/portal')

  if (error?.code === 'refresh_token_not_found' || (isPortalRoute && !user)) {
    const redirectResponse = NextResponse.redirect(new URL('/', request.url))
    // Clear stale auth cookies so the client starts fresh
    request.cookies.getAll().forEach(({ name }) => {
      if (name.startsWith('sb-')) {
        redirectResponse.cookies.delete(name)
      }
    })

    // Carry the target through the login round-trip — guarded by
    // safeNextTarget which only accepts /portal sub-paths (matches proxy
    // matcher scope). Stored as httpOnly cookie so it survives the OAuth
    // round-trip and is consumed server-side in the auth callback, never
    // surfacing attacker-controlled values in the browser URL bar.
    const nextRaw = request.nextUrl.pathname + request.nextUrl.search
    const next = safeNextTarget(nextRaw)
    if (next) {
      redirectResponse.cookies.set('post_login_next', next, {
        maxAge: 300,
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      })
    }

    return redirectResponse
  }

  return supabaseResponse
}
