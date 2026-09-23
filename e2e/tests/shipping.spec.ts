import { test, expect, type Page } from '@playwright/test'
import { mockBiteshipLocation, mockBiteshipRates, mockBiteshipFailure } from '../helpers/biteship'
import { seedClientWithDefaultAddress } from '../helpers/seed'

const TEST_USER_EMAIL = process.env.E2E_TEST_CLIENT_EMAIL!

async function getFirstProductId(page: Page): Promise<string> {
  const card = page.locator('[data-testid^="product-card-"]').first()
  await card.waitFor()
  const testId = await card.getAttribute('data-testid')
  if (!testId) throw new Error('Product card missing data-testid')
  return testId.replace('product-card-', '')
}

async function addOneItemAndGoToReview(page: Page) {
  await page.goto('/portal')
  const productId = await getFirstProductId(page)
  await page.getByTestId(`qty-increment-${productId}`).click()
  await page.getByTestId('review-order-button').click()
  await expect(page).toHaveURL('/portal/order/review')
}

test.describe('shipping at checkout', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    await seedClientWithDefaultAddress({ email: TEST_USER_EMAIL })
  })

  test('happy path — add item, rates render, select courier, submit, see confirmation', async ({ page }) => {
    let capturedRatesBody: Record<string, unknown> | null = null

    await mockBiteshipLocation(page)
    await page.route('https://api.biteship.com/v1/rates/couriers', async (route) => {
      if (route.request().method() === 'POST') {
        capturedRatesBody = await route.request().postDataJSON()
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          pricing: [
            {
              courier_code: 'jne',
              courier_name: 'JNE',
              courier_service_code: 'REG',
              courier_service_name: 'Reguler',
              duration: '2-3 hari',
              price: 12000,
            },
            {
              courier_code: 'tiki',
              courier_name: 'TIKI',
              courier_service_code: 'REG',
              courier_service_name: 'Reguler',
              duration: '1-2 hari',
              price: 15000,
            },
          ],
        }),
      })
    })

    await addOneItemAndGoToReview(page)

    // Wait for courier options to appear
    await expect(page.getByTestId('courier-option-jne')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('courier-option-tiki')).toBeVisible()

    // Verify prices are shown
    await expect(page.getByTestId('courier-price-jne')).toContainText('12.000')
    await expect(page.getByTestId('courier-price-tiki')).toContainText('15.000')

    // Select JNE
    await page.getByTestId('courier-option-jne').click()

    // Submit order
    await page.getByTestId('confirm-order-button').click()

    // Land on confirmation page with order number
    await expect(page).toHaveURL(/\/portal\/order\/confirmation/, { timeout: 15_000 })
    await expect(page.getByTestId('confirmation-card')).toBeVisible()

    // Regression guard: assert Biteship received correct weight payload
    // weight should be unit_weight_grams × quantity per line
    expect(capturedRatesBody).not.toBeNull()
    const items = (capturedRatesBody as unknown as Record<string, unknown>).items as Array<Record<string, unknown>>
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      quantity: 1,
      // weight is ship_weight_grams * quantity = 1000 * 1 = 1000
      weight: 1000,
    })
  })

  test('empty cart redirects to /portal', async ({ page }) => {
    await page.goto('/portal/order/review')
    await expect(page).toHaveURL('/portal', { timeout: 5_000 })
  })

  test('no address shows AddressCardEmpty', async ({ page }) => {
    // Seed client WITHOUT an address
    await seedClientWithDefaultAddress({ email: TEST_USER_EMAIL, clearAddress: true })

    await mockBiteshipLocation(page)
    await mockBiteshipRates(page, [
      {
        courier_code: 'jne',
        courier_name: 'JNE',
        courier_service_code: 'REG',
        courier_service_name: 'Reguler',
        duration: '2-3 hari',
        price: 12000,
      },
    ])

    await addOneItemAndGoToReview(page)

    // Should show empty address state instead of address card
    await expect(page.getByTestId('address-card-empty')).toBeVisible({ timeout: 10_000 })
  })

  test('#24 skeleton loading: no full-page blank, notes stay usable, total never a fake number', async ({ page }) => {
    await mockBiteshipLocation(page)
    await mockBiteshipRates(page, [
      { courier_code: 'jne', courier_name: 'JNE', courier_service_code: 'REG', courier_service_name: 'Reguler', duration: '2-3 hari', price: 12000 },
    ])

    // Slow down the getShippingRates server-action round-trip so the loading
    // window is deterministic. Action calls are the only POSTs to this URL.
    await page.route('**/portal/order/review', async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise((r) => setTimeout(r, 1500))
      }
      await route.fallback()
    })

    await page.goto('/portal')
    const productId = await getFirstProductId(page)
    await page.getByTestId(`qty-increment-${productId}`).click()
    await page.getByTestId('review-order-button').click()
    await expect(page).toHaveURL('/portal/order/review')

    // During load: page chrome + items + notes stay rendered (no 'Memuat…' swap)
    await expect(page.getByText('Review Pesanan')).toBeVisible()
    await expect(page.getByTestId('courier-skeleton')).toBeVisible({ timeout: 5_000 })
    const notes = page.getByTestId('notes-input')
    await notes.fill('masih loading tapi bisa diketik')
    await expect(notes).toHaveValue('masih loading tapi bisa diketik')

    // Ongkir line is honest text, Total shows subtotal + explicit '+ ongkir'
    await expect(page.getByTestId('shipping-cost')).toContainText('Menghitung ongkir…')
    await expect(page.getByTestId('shipping-total')).toContainText('+ ongkir')
    await expect(page.getByTestId('shipping-total-note')).toContainText('Menghitung ongkir…')

    // After rates settle but BEFORE courier choice: still provisional
    await expect(page.getByTestId('courier-option-jne')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('courier-skeleton')).not.toBeVisible()
    await expect(page.getByTestId('shipping-total')).toContainText('+ ongkir')
    await expect(page.getByTestId('shipping-total-note')).toContainText('Pilih kurir')

    // Selecting a courier settles the total — no '+ ongkir' suffix anymore
    await page.getByTestId('courier-option-jne').click()
    await expect(page.getByTestId('shipping-cost')).toContainText('12.000')
    await expect(page.getByTestId('shipping-total')).not.toContainText('+ ongkir')
    await expect(page.getByTestId('shipping-total-note')).toHaveCount(0)

    // Notes survived the whole loading→settled transition
    await expect(notes).toHaveValue('masih loading tapi bisa diketik')
  })

  test('rates 500 error — retry button appears and refetches on click', async ({ page }) => {
    let callCount = 0

    await mockBiteshipLocation(page)
    await page.route('https://api.biteship.com/v1/rates/couriers', async (route) => {
      callCount++
      if (callCount === 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        })
      } else {
        // Second attempt succeeds
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            pricing: [
              {
                courier_code: 'jne',
                courier_name: 'JNE',
                courier_service_code: 'REG',
                courier_service_name: 'Reguler',
                duration: '2-3 hari',
                price: 12000,
              },
            ],
          }),
        })
      }
    })

    await addOneItemAndGoToReview(page)

    // Error state shown
    await expect(page.getByTestId('rates-error-message')).toBeVisible({ timeout: 10_000 })

    // Retry button visible and functional
    await expect(page.getByTestId('retry-rates-button')).toBeVisible()
    await page.getByTestId('retry-rates-button').click()

    // After retry, rates should load successfully
    await expect(page.getByTestId('courier-option-jne')).toBeVisible({ timeout: 10_000 })
  })
})
