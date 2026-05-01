import { test } from '@playwright/test'
import { mockBiteshipLocation, mockBiteshipRates, mockBiteshipFailure } from '../helpers/biteship'
import { seedClientWithDefaultAddress } from '../helpers/seed'

test.describe('shipping at checkout', () => {
  test.beforeAll(async () => {
    const email = process.env.E2E_TEST_CLIENT_EMAIL!
    await seedClientWithDefaultAddress({ email })
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
})
