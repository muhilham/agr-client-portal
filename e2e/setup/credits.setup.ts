/**
 * credits.setup.ts — #411 session bootstrap for the credits project.
 *
 * The existing auth.setup.ts relies on GoTrue's magiclink redirect
 * carrying the session server-side; on the local Docker stack v2.188 the
 * /verify redirect delivers `#access_token=…` (fragment → invisible to
 * the SSR /auth/callback route) so it cannot mint SSR cookies there.
 * This setup instead:
 *   1. sets a known password on the E2E client auth user (service role),
 *   2. signs in through @supabase/ssr's createServerClient — the exact
 *      library the app uses — so the emitted cookie names/encoding are
 *      guaranteed to match what the server components read back.
 *
 * Writes e2e/.auth/credits-client.json (used as storageState).
 */

import { test as setup, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import * as fs from 'fs'
import * as path from 'path'

const CREDITS_AUTH_FILE = path.join(__dirname, '../.auth/credits-client.json')
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'credits-e2e-pass-123'

setup('create credits client session', async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const email = process.env.E2E_TEST_CLIENT_EMAIL!

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  // 1. ensure the auth user exists and has the known password
  const { data: users } = await admin.auth.admin.listUsers()
  let user = users?.users.find((u) => u.email === email)
  if (!user) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    })
    if (error) throw new Error(`createUser failed: ${error.message}`)
    user = created.user
  }
  const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
    password: E2E_PASSWORD,
  })
  if (updErr) throw new Error(`set password failed: ${updErr.message}`)

  // create_order_and_items authorizes via clients.user_id = auth.uid();
  // link the seeded client row to its auth user (idempotent).
  const { error: linkErr } = await admin
    .from('clients')
    .update({ user_id: user.id })
    .eq('email', email)
  if (linkErr) throw new Error(`link clients.user_id failed: ${linkErr.message}`)

  // 2. sign in through the app's own SSR client and capture the cookies it sets
  const jar: Record<string, string> = {}
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })),
      setAll: (list) => {
        for (const { name, value } of list) jar[name] = value
      },
    },
  })
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password: E2E_PASSWORD,
  })
  if (signInErr) throw new Error(`signInWithPassword failed: ${signInErr.message}`)

  const cookieList = Object.entries(jar)
  expect(cookieList.length, 'auth cookies emitted').toBeGreaterThan(0)

  fs.mkdirSync(path.dirname(CREDITS_AUTH_FILE), { recursive: true })
  fs.writeFileSync(
    CREDITS_AUTH_FILE,
    JSON.stringify({
      cookies: cookieList.map(([name, value]) => ({
        name,
        value,
        domain: '127.0.0.1',
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 3600 * 8,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax' as const,
      })),
      origins: [],
    })
  )
  console.log(`[credits-setup] session written (${cookieList.length} cookies) for ${email}`)
})
