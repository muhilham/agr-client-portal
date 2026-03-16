/**
 * auth.setup.ts
 *
 * Creates two saved browser sessions before the test suite runs:
 *   1. client.json   — authorized test client (redirects to /portal)
 *   2. unauth.json   — authenticated Google user NOT in clients table
 *
 * Uses supabase.auth.admin.generateLink() to produce a magic-link token,
 * then visits it in a real Playwright browser so our /auth/callback route
 * runs and sets the Supabase SSR session cookies.
 *
 * Requirement: Supabase project must allow http://localhost:3000/auth/callback
 * as a Redirect URL in Auth → URL Configuration.
 */

import { test as setup, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import { AUTH_CLIENT_FILE, AUTH_UNAUTH_FILE } from '../../playwright.config'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

async function createSession(
  page: import('@playwright/test').Page,
  email: string,
  expectPath: string
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo: `${BASE_URL}/auth/callback`,
    },
  })

  if (error || !data?.properties?.action_link) {
    throw new Error(`generateLink failed for ${email}: ${error?.message ?? 'no action_link'}`)
  }

  // Visit the Supabase magic-link URL — it verifies the token and redirects
  // to /auth/callback which sets SSR session cookies.
  await page.goto(data.properties.action_link)

  // Wait for our callback to finish and redirect
  await page.waitForURL(`**${expectPath}`, { timeout: 15_000 })

  await page.context().storageState({
    path: expectPath === '/portal' ? AUTH_CLIENT_FILE : AUTH_UNAUTH_FILE,
  })
}

setup('create authorized client session', async ({ page }) => {
  const clientEmail = process.env.E2E_TEST_CLIENT_EMAIL!
  await createSession(page, clientEmail, '/portal')
  console.log('[auth-setup] Saved authorized client session')
})

setup('create unauthorized user session', async ({ page }) => {
  const unauthEmail = process.env.E2E_TEST_UNAUTH_EMAIL!
  // This user exists in auth.users but NOT in clients table
  // Our /auth/callback will redirect them to /auth/unauthorized
  await createSession(page, unauthEmail, '/auth/unauthorized')
  console.log('[auth-setup] Saved unauthorized user session')
})

setup.afterAll(async () => {
  // Ensure auth state dirs exist (no-op if createSession already wrote them)
  const dir = path.dirname(AUTH_CLIENT_FILE)
  const fs = await import('fs')
  fs.mkdirSync(dir, { recursive: true })
})
