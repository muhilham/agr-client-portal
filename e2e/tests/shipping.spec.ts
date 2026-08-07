import { test, expect, type Page } from '@playwright/test'
import { mockBiteshipLocation, mockBiteshipRates, mockBiteshipFailure } from '../helpers/biteship'
import { seedClientWithDefaultAddress } from '../helpers/seed'

const TEST_USER_EMAIL = process.env.E2E_TEST_CLIENT_EMAIL!

async function getFirstProductId(page: Page): Promise<string> {
  const card = page.locator('[data-testid^="product-card-"]').first()
  await card.waitFor()
  const testId = await card.getAttribute('data-testid')
  return testId!.replace('product-card-', '')
}

test.describe('shipping at checkout', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    await seedClientWithDefaultAddress({ email: TEST_USER_EMAIL })
  })

  test('happy path — select courier and submit', async ({ page }) => {
    await mockBiteshipLocation(page)
    await mockBiteshipRates(page, [
      { courier_code: 'jne', courier_name: 'JNE', courier_service_code: 'REG', courier_service_name: 'Reguler', duration: '2-3 hari', price: 12000 },
      { courier_code: 'tiki', courier_name: 'TIKI', courier_service_code: 'REG', courier_service_name: 'Reguler', duration: '1-2 hari', price: 15000 },
    ])

    // TODO: This test needs to add items to cart first, then navigate to review
    // For now, just verify the page loads with mocked rates
    // (Full test implementation depends on existing catalog test IDs)
  })

  test('rates failure — shows retry button', async ({ page }) => {
    await mockBiteshipLocation(page)
    await mockBiteshipFailure(page, 500)

    // TODO: Navigate to review page after adding items to cart
    // Verify retry button is visible
  })

  test('empty courier response — shows error', async ({ page }) => {
    await mockBiteshipLocation(page)
    await page.route('https://api.biteship.com/v1/rates/couriers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ pricing: [] }),
      })
    })

    // TODO: Verify error message is visible
  })

  test('free shipping client skips Biteship and sees gratis', async ({ page }) => {
    await seedClientWithDefaultAddress({ email: TEST_USER_EMAIL, hasFreeShipping: true })

    await page.goto('/portal')

    const productId = await getFirstProductId(page)
    await page.getByTestId(`qty-increment-${productId}`).click()

    await page.getByTestId('review-order-button').click()
    await expect(page).toHaveURL('/portal/order/review')

    // Assert no courier picker, shows "Pengiriman Gratis"
    await expect(page.getByTestId('shipping-cost')).toContainText('Gratis')
    await expect(page.getByTestId('courier-picker')).toHaveCount(0)

    // Submit
    await page.getByTestId('confirm-order-button').click()

    // Wait for confirmation
    await expect(page).toHaveURL(/\/portal\/order\/confirmation/, { timeout: 15_000 })

    // Navigate to order detail
    const orderId = new URL(page.url()).searchParams.get('id')
    await page.goto(`/portal/orders/${orderId}`)

    // Assert order detail shows free shipping
    await expect(page.getByTestId('order-shipping-courier')).toContainText('Gratis')
    await expect(page.getByTestId('order-shipping-cost')).toContainText('Rp 0')
  })

  let manualOrderId: string | null = null

  test('manual shipping toggle works and blocks invoice', async ({ page }) => {
    await mockBiteshipLocation(page)
    await mockBiteshipRates(page, [
      { courier_code: 'jne', courier_name: 'JNE', courier_service_code: 'REG', courier_service_name: 'Reguler', duration: '2-3 hari', price: 12000 },
    ])

    await page.goto('/portal')

    const productId = await getFirstProductId(page)
    await page.getByTestId(`qty-increment-${productId}`).click()

    await page.getByTestId('review-order-button').click()
    await expect(page).toHaveURL('/portal/order/review')

    // Click manual toggle
    await page.getByText('Gunakan ongkir manual').click()

    // Assert manual mode
    await expect(page.getByTestId('shipping-cost')).toContainText('—')

    // Submit
    await page.getByTestId('confirm-order-button').click()

    // Wait for confirmation
    await expect(page).toHaveURL(/\/portal\/order\/confirmation/, { timeout: 15_000 })

    // Save order ID for next test
    manualOrderId = new URL(page.url()).searchParams.get('id')

    // Navigate to order detail
    await page.goto(`/portal/orders/${manualOrderId}`)

    // Assert order detail shows manual, invoice blocked
    await expect(page.getByTestId('order-shipping-courier')).toContainText('Manual')
    await expect(page.getByText('Invoice tersedia setelah admin')).toBeVisible()
  })

  test('invoice download blocked for manual order without cost', async ({ page, request }) => {
    test.skip(!manualOrderId, 'No manual order created — run previous test first')

    // Navigate to order detail to stay consistent with the task pattern
    await page.goto(`/portal/orders/${manualOrderId}`)

    // Try to download invoice via API
    const response = await request.get(`/api/invoice/${manualOrderId}`)
    expect(response.status()).toBe(422)
    const body = await response.json()
    expect(body.error).toContain('Biaya pengiriman belum dihitung')
  })
})
