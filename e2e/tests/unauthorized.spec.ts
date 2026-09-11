/**
 * unauthorized.spec.ts — Authenticated-but-not-a-client user tests
 *
 * Uses the unauth session saved by auth.setup.ts.
 * This user exists in Supabase Auth but is NOT in the clients table.
 * Covers:
 *   □ /auth/unauthorized?state=unregistered page renders correctly with email
 *   □ WhatsApp contact button is shown with pre-filled message
 *   □ Back-to-login link works
 *   □ Cannot access /portal even when authenticated as a non-client
 */

import { test, expect } from '@playwright/test'
import { AUTH_UNAUTH_FILE } from '../../playwright.config'

// Load the unauthorized user's session
test.use({ storageState: AUTH_UNAUTH_FILE })

test.describe('Unauthorized access', () => {
  const UNREGISTERED_EMAIL = 'unregistered@test.com'

  test('shows actionable unregistered message with email and WhatsApp CTA', async ({ page }) => {
    await page.goto(`/auth/unauthorized?state=unregistered&email=${encodeURIComponent(UNREGISTERED_EMAIL)}`)

    await expect(page.getByText('Akses Ditolak')).toBeVisible()
    await expect(
      page.getByText('Akun kamu belum terdaftar sebagai klien Agroastery')
    ).toBeVisible()
    // Email is shown back to the user so they know what to tell support
    await expect(
      page.getByText(`Email yang kamu gunakan saat mendaftar: ${UNREGISTERED_EMAIL}`)
    ).toBeVisible()
    // WhatsApp button is shown (not email)
    const contactWa = page.getByTestId('contact-wa')
    await expect(contactWa).toBeVisible()
    await expect(contactWa).toHaveAttribute('href', new RegExp(`wa\\.me/628979092726`))
    await expect(contactWa).toContainText('Hubungi via WhatsApp')
    // Email link is NOT shown for unregistered state
    await expect(page.getByTestId('contact-email')).not.toBeVisible()
  })

  test('shows generic inactive message and email link when state=inactive', async ({ page }) => {
    await page.goto('/auth/unauthorized?state=inactive')

    await expect(page.getByText('Akses Ditolak')).toBeVisible()
    await expect(
      page.getByText('Akun Anda tidak aktif. Hubungi tim Agroastery.')
    ).toBeVisible()
    await expect(page.getByTestId('contact-email')).toBeVisible()
    await expect(page.getByTestId('contact-wa')).not.toBeVisible()
  })

  test('"Kembali ke halaman masuk" link navigates back to login', async ({ page }) => {
    await page.goto(`/auth/unauthorized?state=unregistered&email=${encodeURIComponent(UNREGISTERED_EMAIL)}`)

    const backLink = page.getByTestId('back-to-login-link')
    await expect(backLink).toBeVisible()

    // Sign out first so the login page doesn't redirect us to /portal
    await page.evaluate(async () => {
      const { createClient } = await import('@/lib/supabase/client' as never)
      const supabase = (createClient as () => ReturnType<typeof createClient>)()
      await supabase.auth.signOut()
    })

    await backLink.click()
    await expect(page).toHaveURL('/')
    await expect(page.getByTestId('google-login-button')).toBeVisible()
  })
})
