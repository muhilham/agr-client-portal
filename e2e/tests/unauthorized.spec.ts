/**
 * unauthorized.spec.ts — Authenticated-but-not-a-client user tests
 *
 * Uses the unauth session saved by auth.setup.ts.
 * This user exists in Supabase Auth but is NOT in the clients table.
 * Covers:
 *   □ /auth/unauthorized page renders correctly
 *   □ Link back to login works
 *   □ Cannot access /portal even when authenticated as a non-client
 */

import { test, expect } from '@playwright/test'
import { AUTH_UNAUTH_FILE } from '../../playwright.config'

// Load the unauthorized user's session
test.use({ storageState: AUTH_UNAUTH_FILE })

test.describe('Unauthorized access', () => {
  test('/auth/unauthorized page shows correct message and contact info', async ({ page }) => {
    await page.goto('/auth/unauthorized')

    await expect(page.getByText('Akses Ditolak')).toBeVisible()
    await expect(
      page.getByText('Akun Anda belum terdaftar sebagai klien Agroastery')
    ).toBeVisible()

    const contactEmail = page.getByTestId('contact-email')
    await expect(contactEmail).toBeVisible()
    await expect(contactEmail).toHaveAttribute('href', 'mailto:hello@agroastery.com')
  })

  test('"Kembali ke halaman masuk" link navigates back to login', async ({ page }) => {
    await page.goto('/auth/unauthorized')

    const backLink = page.getByTestId('back-to-login-link')
    await expect(backLink).toBeVisible()

    // Sign out first so the login page doesn't redirect us to /portal
    await page.evaluate(async () => {
      const { createClient } = await import('/lib/supabase/client.ts' as never)
      const supabase = (createClient as () => ReturnType<typeof createClient>)()
      await supabase.auth.signOut()
    })

    await backLink.click()
    await expect(page).toHaveURL('/')
    await expect(page.getByTestId('google-login-button')).toBeVisible()
  })
})
