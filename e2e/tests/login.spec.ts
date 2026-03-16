/**
 * login.spec.ts — Unauthenticated user tests
 *
 * Runs without any saved session state.
 * Covers:
 *   □ Login page loads with Google button
 *   □ Clicking the button initiates Google OAuth redirect
 *   □ Visiting /portal unauthenticated redirects to /
 */

import { test, expect } from '@playwright/test'

test.describe('Login page', () => {
  test('loads with Agroastery branding and Google sign-in button', async ({ page }) => {
    await page.goto('/')

    // Brand name visible (DOM text is 'Agroastery'; CSS uppercase is visual-only)
    await expect(page.getByText('Agroastery').first()).toBeVisible()

    // Sub-heading
    await expect(page.getByText('Portal Pemesanan Klien')).toBeVisible()

    // Google sign-in button
    const loginBtn = page.getByTestId('google-login-button')
    await expect(loginBtn).toBeVisible()
    await expect(loginBtn).toContainText('Masuk dengan Google')
    await expect(loginBtn).toBeEnabled()
  })

  test('clicking Google button triggers OAuth redirect to Supabase with google provider', async ({
    page,
  }) => {
    await page.goto('/')

    // Fulfill the Supabase OAuth navigation with a redirect back to '/' so the
    // browser never leaves localhost — avoids flakiness from external network.
    let capturedOAuthUrl: string | null = null
    await page.route(/supabase\.co\/auth\/v1\/authorize/, (route) => {
      capturedOAuthUrl = route.request().url()
      route.fulfill({
        status: 302,
        headers: { location: 'http://localhost:3000/' },
      })
    })

    const loginBtn = page.getByTestId('google-login-button')
    await expect(loginBtn).toBeEnabled()

    // Capture the outbound OAuth request before the fulfill fires
    const requestPromise = page.waitForRequest(/auth\/v1\/authorize/, { timeout: 8000 })
    await loginBtn.click()
    await requestPromise

    // Verify the captured URL points to the Google OAuth provider
    expect(capturedOAuthUrl).not.toBeNull()
    expect(capturedOAuthUrl).toContain('provider=google')
  })

  test('visiting /portal without auth redirects to login', async ({ page }) => {
    await page.goto('/portal')
    await expect(page).toHaveURL('/')
    await expect(page.getByTestId('google-login-button')).toBeVisible()
  })

  test('visiting /portal/orders without auth redirects to login', async ({ page }) => {
    await page.goto('/portal/orders')
    await expect(page).toHaveURL('/')
  })
})
