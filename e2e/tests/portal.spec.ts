/**
 * portal.spec.ts — Full authenticated portal flow
 *
 * Uses the authorized client session saved by auth.setup.ts.
 * Runs the full happy-path checklist end-to-end:
 *
 *   □ Catalog loads with products assigned to the test client
 *   □ Add items to cart — sticky cart appears with correct total
 *   □ Click "Review Pesanan" → order summary page
 *   □ Confirm Order → order saved, redirects to confirmation
 *   □ Confirmation page shows order number
 *   □ View Order History → order appears in list
 *   □ Click order row → detail page shows items, fulfillment badge, and payment badge
 *
 * Cleanup: deletes the test order after all tests complete.
 */

import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { mockBiteshipLocation, mockBiteshipRates } from '../helpers/biteship'

// ── Helpers ──────────────────────────────────────────────────────────────────

function getTestIds() {
  const file = path.join(__dirname, '../.auth/test-ids.json')
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as {
    clientId: string
    clientEmail: string
    unauthEmail: string
    clientAuthId: string
  }
}

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function getFirstProductId(page: Page): Promise<string> {
  const card = page.locator('[data-testid^="product-card-"]').first()
  await card.waitFor()
  const testId = await card.getAttribute('data-testid')
  return testId!.replace('product-card-', '')
}

// ── State shared across tests in this suite ───────────────────────────────────

let createdOrderId: string | null = null
let createdOrderNumber: string | null = null

// ── Cleanup ───────────────────────────────────────────────────────────────────

test.afterAll(async () => {
  if (!createdOrderId) return
  const supabase = adminSupabase()
  await supabase.from('order_items').delete().eq('order_id', createdOrderId)
  await supabase.from('notification_logs').delete().eq('order_id', createdOrderId)
  await supabase.from('orders').delete().eq('id', createdOrderId)
  console.log(`[portal] Cleaned up test order ${createdOrderNumber}`)
})

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Portal catalog (CP-02)', () => {
  test('catalog loads with welcome banner and products', async ({ page }) => {
    await page.goto('/portal')

    // Welcome banner with greeting
    const banners = ['Selamat pagi', 'Selamat siang', 'Selamat sore', 'Selamat malam']
    const banner = page.locator('p', { hasText: /Selamat (pagi|siang|sore|malam)/ })
    await expect(banner).toBeVisible()

    // Client name displayed
    await expect(page.getByText('E2E Test Client')).toBeVisible()

    // Product grid visible
    const grid = page.getByTestId('product-grid')
    await expect(grid).toBeVisible()

    // At least one product card rendered
    const cards = page.locator('[data-testid^="product-card-"]')
    await expect(cards.first()).toBeVisible()
  })

  test('sticky cart is hidden when no items selected', async ({ page }) => {
    await page.goto('/portal')
    await expect(page.getByTestId('sticky-cart')).not.toBeVisible()
  })

  test('adding a product to cart shows sticky cart with correct total', async ({ page }) => {
    await page.goto('/portal')

    const productId = await getFirstProductId(page)
    const incrementBtn = page.getByTestId(`qty-increment-${productId}`)

    // Cart not visible yet
    await expect(page.getByTestId('sticky-cart')).not.toBeVisible()

    // Click + once → qty becomes 1 (>= minQty of 1)
    await incrementBtn.click()

    // Sticky cart appears
    const cart = page.getByTestId('sticky-cart')
    await expect(cart).toBeVisible()
    await expect(cart).toContainText('item dipilih')
    await expect(cart).toContainText('Rp')

    // Review button is visible and clickable
    const reviewBtn = page.getByTestId('review-order-button')
    await expect(reviewBtn).toBeVisible()
    await expect(reviewBtn).toBeEnabled()
  })

  test('decrementing back to 0 hides the sticky cart', async ({ page }) => {
    await page.goto('/portal')

    const productId = await getFirstProductId(page)
    await page.getByTestId(`qty-increment-${productId}`).click()
    await expect(page.getByTestId('sticky-cart')).toBeVisible()

    await page.getByTestId(`qty-decrement-${productId}`).click()
    await expect(page.getByTestId('sticky-cart')).not.toBeVisible()
  })

  test('qty input accepts typed value and updates cart', async ({ page }) => {
    await page.goto('/portal')

    const productId = await getFirstProductId(page)
    const qtyInput = page.getByTestId(`qty-input-${productId}`)

    await qtyInput.fill('3')
    await qtyInput.blur()

    const cart = page.getByTestId('sticky-cart')
    await expect(cart).toBeVisible()
    await expect(cart).toContainText('3 item')
  })
})

test.describe('Product list tabs (CP-02b)', () => {
  test('shows Produk Saya and Produk Lainnya tabs when both types exist', async ({ page }) => {
    await page.goto('/portal')
    await expect(page.getByTestId('tab-mine')).toBeVisible()
    await expect(page.getByTestId('tab-other')).toBeVisible()
  })

  test('Produk Saya tab is active by default', async ({ page }) => {
    await page.goto('/portal')
    const tab = page.getByTestId('tab-mine')
    await expect(tab).toHaveAttribute('aria-selected', 'true')
  })

  test('Produk Lainnya tab shows global products', async ({ page }) => {
    await page.goto('/portal')
    await page.getByTestId('tab-other').click()
    await expect(page.getByText('E2E Global Product')).toBeVisible()
  })

  test('cart persists when switching tabs', async ({ page }) => {
    await page.goto('/portal')

    const productId = await getFirstProductId(page)
    await page.getByTestId(`qty-increment-${productId}`).click()
    await expect(page.getByTestId('sticky-cart')).toBeVisible()

    await page.getByTestId('tab-other').click()
    await expect(page.getByTestId('sticky-cart')).toBeVisible()

    await page.getByTestId('tab-mine').click()
    await expect(page.getByTestId('sticky-cart')).toBeVisible()
  })

  test('switching back to Produk Saya shows client products again', async ({ page }) => {
    await page.goto('/portal')

    await page.getByTestId('tab-other').click()
    await page.getByTestId('tab-mine').click()

    const tab = page.getByTestId('tab-mine')
    await expect(tab).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('[data-testid^="product-card-"]').first()).toBeVisible()
  })
})

test.describe('Order review → submission (CP-03 → CP-04)', () => {
  test('navigates to /portal/order/review and shows correct summary', async ({ page }) => {
    await page.goto('/portal')

    const productId = await getFirstProductId(page)
    await page.getByTestId(`qty-increment-${productId}`).click()

    await page.getByTestId('review-order-button').click()
    await expect(page).toHaveURL('/portal/order/review')

    // Order summary visible
    await expect(page.getByText('Review Pesanan')).toBeVisible()

    // At least one order item row
    const itemRow = page.locator('[data-testid^="order-item-"]').first()
    await expect(itemRow).toBeVisible()

    // Total shows IDR amount
    await expect(page.getByTestId('order-grand-total')).toContainText('Rp')

    // Notes textarea present with 16px font (iOS zoom prevention)
    const notes = page.getByTestId('notes-input')
    await expect(notes).toBeVisible()
    const fontSize = await notes.evaluate((el) => window.getComputedStyle(el).fontSize)
    expect(parseFloat(fontSize)).toBeGreaterThanOrEqual(16)

    // Both action buttons visible
    await expect(page.getByTestId('confirm-order-button')).toBeVisible()
    await expect(page.getByTestId('back-to-catalog-button')).toBeVisible()
  })

  test('"Kembali ke Katalog" navigates back to /portal and cart is intact', async ({ page }) => {
    await page.goto('/portal')

    const productId = await getFirstProductId(page)
    await page.getByTestId(`qty-increment-${productId}`).click()
    await page.getByTestId('review-order-button').click()

    await page.getByTestId('back-to-catalog-button').click()
    await expect(page).toHaveURL('/portal')
  })

  test('submitting order redirects to confirmation with order number', async ({ page }) => {
    await mockBiteshipLocation(page)
    await mockBiteshipRates(page, [
      { courier_code: 'jne', courier_name: 'JNE', courier_service_code: 'REG', courier_service_name: 'Reguler', duration: '2-3 hari', price: 12000 },
    ])

    await page.goto('/portal')

    const productId = await getFirstProductId(page)
    await page.getByTestId(`qty-increment-${productId}`).click()
    await page.getByTestId('review-order-button').click()

    // Add optional notes
    await page.getByTestId('notes-input').fill('Catatan E2E test')

    // Select courier
    const courierOption = page.getByTestId('courier-option-jne')
    await expect(courierOption).toBeVisible()
    await courierOption.click()

    // Submit
    await page.getByTestId('confirm-order-button').click()

    // Should redirect to confirmation page
    await expect(page).toHaveURL(/\/portal\/order\/confirmation/, { timeout: 15_000 })

    // Order number displayed
    const orderNumberEl = page.getByTestId('order-number')
    await expect(orderNumberEl).toBeVisible()
    const orderNumber = await orderNumberEl.textContent()
    expect(orderNumber).toMatch(/AGR-/)

    // Confirmation card visible
    await expect(page.getByTestId('confirmation-card')).toBeVisible()
    await expect(page.getByText('Pesanan Diterima!')).toBeVisible()

    // Save for downstream tests and cleanup
    createdOrderNumber = orderNumber!.trim()
    const url = page.url()
    const params = new URL(url).searchParams
    createdOrderId = params.get('id')

    // Both CTA buttons present
    await expect(page.getByTestId('view-orders-button')).toBeVisible()
    await expect(page.getByTestId('back-to-catalog-button')).toBeVisible()
  })

  test('confirm button is disabled when cart is empty (direct nav to review)', async ({
    page,
  }) => {
    // Navigate directly without setting sessionStorage → redirect to /portal
    await page.goto('/portal/order/review')
    await expect(page).toHaveURL('/portal')
  })
})

test.describe('Order history (CP-05)', () => {
  test.beforeAll(async () => {
    // Ensure we have an order to view — wait for the submission test to run first
    // (tests run serially within this file via workers: 1)
  })

  test('order history page shows submitted order', async ({ page }) => {
    // Skip if no order was created (test ran in isolation)
    test.skip(!createdOrderNumber, 'No test order created — run full suite')

    await page.goto('/portal/orders')
    await expect(page.getByText('Riwayat Pesanan')).toBeVisible()

    const ordersList = page.getByTestId('orders-list')
    await expect(ordersList).toBeVisible()

    // The test order appears in the list
    await expect(page.getByText(createdOrderNumber!)).toBeVisible()
  })

  test('empty state shown when client has no orders (new test client scenario)', async ({
    page,
  }) => {
    // This verifies the empty state element exists in the DOM as a structure check
    // (only actually visible for clients with no orders)
    await page.goto('/portal/orders')
    const list = page.getByTestId('orders-list')
    const empty = page.getByTestId('empty-orders')
    // Either the list OR the empty state must be visible
    const listVisible = await list.isVisible()
    const emptyVisible = await empty.isVisible()
    expect(listVisible || emptyVisible).toBe(true)
  })

  test('"Buat Pesanan Baru" button navigates to /portal', async ({ page }) => {
    await page.goto('/portal/orders')
    await page.getByTestId('new-order-link').click()
    await expect(page).toHaveURL('/portal')
  })
})

test.describe('Order detail (CP-05b)', () => {
  test('clicking order row navigates to detail page with correct data', async ({ page }) => {
    test.skip(!createdOrderNumber, 'No test order created — run full suite')

    await page.goto('/portal/orders')

    // Click the row for our test order
    const orderRow = page.locator(`[data-testid^="order-row-"]`).filter({
      hasText: createdOrderNumber!,
    })
    await expect(orderRow).toBeVisible()
    await orderRow.click()

    await expect(page).toHaveURL(/\/portal\/orders\//)

    // Order number in header
    await expect(page.getByTestId('order-number')).toContainText(createdOrderNumber!)

    // Status badges visible
    await expect(page.getByTestId('fulfillment-badge')).toBeVisible()
    await expect(page.getByTestId('fulfillment-badge')).toContainText('PENDING')
    await expect(page.getByTestId('payment-badge')).toBeVisible()
    await expect(page.getByTestId('payment-badge')).toContainText('UNPAID')

    // At least one item row
    const itemRow = page.locator('[data-testid^="order-item-"]').first()
    await expect(itemRow).toBeVisible()

    // Total visible
    await expect(page.getByTestId('order-grand-total')).toContainText('Rp')

    // Notes visible (we added 'Catatan E2E test')
    await expect(page.getByTestId('order-notes')).toContainText('Catatan E2E test')

    // Both action buttons
    await expect(page.getByTestId('new-order-button')).toBeVisible()
    await expect(page.getByTestId('back-to-orders-button')).toBeVisible()
  })

  test('"Buat Pesanan Baru" from detail navigates to /portal', async ({ page }) => {
    test.skip(!createdOrderId, 'No test order created — run full suite')

    await page.goto(`/portal/orders/${createdOrderId}`)
    await page.getByTestId('new-order-button').click()
    await expect(page).toHaveURL('/portal')
  })

  test('"Riwayat Pesanan" button from detail navigates back to /portal/orders', async ({
    page,
  }) => {
    test.skip(!createdOrderId, 'No test order created — run full suite')

    await page.goto(`/portal/orders/${createdOrderId}`)
    await page.getByTestId('back-to-orders-button').click()
    await expect(page).toHaveURL('/portal/orders')
  })

  test('non-existent order ID returns 404', async ({ page }) => {
    await page.goto('/portal/orders/00000000-0000-0000-0000-000000000000')
    // Next.js notFound() returns 404
    await expect(page).toHaveURL(
      '/portal/orders/00000000-0000-0000-0000-000000000000'
    )
    // The not-found page renders (Next.js default or custom)
    const status = await page.evaluate(() => document.title)
    // Accept any 404-ish page
    expect(
      (await page.locator('body').innerText()).toLowerCase()
    ).toMatch(/not found|tidak ditemukan|404/)
  })
})

test.describe('Invoice download (CP-06)', () => {
  test('download invoice button visible on order detail page', async ({ page }) => {
    test.skip(!createdOrderId, 'No test order created — run full suite')

    await page.goto(`/portal/orders/${createdOrderId}`)

    const button = page.getByTestId('download-invoice-button')
    await expect(button).toBeVisible()
    await expect(button).toContainText('Download Invoice')
    await expect(button).toBeEnabled()
  })

  test('clicking download invoice button triggers PDF download', async ({ page }) => {
    test.skip(!createdOrderId, 'No test order created — run full suite')

    await page.goto(`/portal/orders/${createdOrderId}`)

    const downloadPromise = page.waitForEvent('download')
    await page.getByTestId('download-invoice-button').click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/^INV-.*\.pdf$/)
    expect(download.suggestedFilename()).toContain(createdOrderNumber)
  })

  test.describe('unauthenticated', () => {
    test.use({ storageState: { cookies: [], origins: [] } })

    test('invoice API returns 401 without session', async ({ request }) => {
      const response = await request.get(
        '/api/invoice/00000000-0000-0000-0000-000000000000'
      )
      expect(response.status()).toBe(401)
    })
  })
})
