import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function updateSession(request: NextRequest): Promise<import('next/server').NextResponse> {
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
    return redirectResponse
  }

  return supabaseResponse
}
