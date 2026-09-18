/**
 * Middleware regression tests for the reorder deep-link carry-over (issue #72).
 *
 * These lock the contract the auth callback depends on:
 *   □ logged-out /portal?reorder=X redirect sets httpOnly post_login_next
 *   □ the cookie value is exactly the guarded path
 *   □ paths outside /portal never set the cookie
 */

import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'

// No session cookies present → getUser() fails → updateSession treats
// the visitor as logged out, exercising the redirect branch.
function loggedOutRequest(pathWithQuery: string): NextRequest {
  return new NextRequest(`https://order.agroastery.com${pathWithQuery}`)
}

describe('updateSession — post_login_next carry-over', () => {
  it('sets the cookie for logged-out /portal?reorder hits', async () => {
    const { updateSession } = await import('./middleware')
    const res = await updateSession(loggedOutRequest('/portal?reorder=abc-123'))

    expect(res.status).toBe(307)
    expect(new URL(res.headers.get('location')!).pathname).toBe('/')

    const cookie = res.cookies.get('post_login_next')
    expect(cookie).toBeDefined()
    expect(cookie!.value).toBe('/portal?reorder=abc-123')
    expect(cookie!.httpOnly).toBe(true)
    expect(cookie!.maxAge).toBe(300)
  })

  it('does not set the cookie for non-portal paths', async () => {
    const { updateSession } = await import('./middleware')
    const res = await updateSession(loggedOutRequest('/dashboard'))
    expect(res.cookies.get('post_login_next')).toBeUndefined()
  })

  it('sets bare /portal target when no query is present', async () => {
    const { updateSession } = await import('./middleware')
    const res = await updateSession(loggedOutRequest('/portal'))
    expect(res.cookies.get('post_login_next')?.value).toBe('/portal')
  })
})
