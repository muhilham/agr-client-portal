import { Page } from '@playwright/test'

export async function mockBiteshipLocation(page: Page) {
  await page.route('https://api.biteship.com/v1/locations/*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'loc-test',
        name: 'Test Origin',
        contact_name: 'Test',
        contact_phone: '081234567890',
        address: 'Jl. Test No. 1',
        postal_code: '12345',
        latitude: -6.2,
        longitude: 106.8,
      }),
    })
  })
}

export async function mockBiteshipRates(
  page: Page,
  rates: Array<{
    courier_code: string
    courier_name: string
    courier_service_code: string
    courier_service_name: string
    duration: string
    price: number
  }>
) {
  await page.route('https://api.biteship.com/v1/rates/couriers', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pricing: rates }),
    })
  })
}

export async function mockBiteshipFailure(page: Page, status = 500) {
  await page.route('https://api.biteship.com/v1/rates/couriers', async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Internal Server Error' }),
    })
  })
}
