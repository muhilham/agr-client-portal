/**
 * address-picker.spec.ts — #101 multi-branch checkout
 *
 * Runs on a FREE-SHIPPING client on purpose: that branch returns the address
 * list without calling Biteship, so the picker behaviour, the per-order
 * selection and the order snapshot are all deterministic. (A rate re-quote for
 * a paid client needs live Biteship credentials on the dev server — browser
 * route mocks do not intercept server-action fetches.)
 *
 * The re-quote trigger itself is pinned by lib/ratesKey.test.ts: the address is
 * part of the rates key, so a branch switch can never be swallowed by the
 * 1500ms throttle.
 */

import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { seedClientAddresses } from '../helpers/seed'

const TEST_USER_EMAIL = process.env.E2E_TEST_CLIENT_EMAIL!

const BRANCH_A = {
  label: 'Cabang Kemang',
  recipient_name: 'Kemang Kitchen',
  address_line: 'Jl. Kemang Raya 1',
  postal_code: '12730',
  is_default: true,
}

const BRANCH_B = {
  label: 'Cabang Bandung',
  recipient_name: 'Bandung Kitchen',
  address_line: 'Jl. Braga 2',
  postal_code: '40115',
  is_default: false,
}

let branchAId = ''
let branchBId = ''
let clientId = ''

function adminSupabase(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
}

async function addOneItemAndGoToReview(page: Page) {
  await page.goto('/portal')
  const card = page.locator('[data-testid^="product-card-"]').first()
  await card.waitFor()
  const testId = await card.getAttribute('data-testid')
  if (!testId) throw new Error('Product card missing data-testid')
  const productId = testId.replace('product-card-', '')
  await page.getByTestId(`qty-increment-${productId}`).click()
  await page.getByTestId('review-order-button').click()
  await expect(page).toHaveURL('/portal/order/review')
}

test.describe('address picker (#101)', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    const seeded = await seedClientAddresses({
      email: TEST_USER_EMAIL,
      hasFreeShipping: true,
      addresses: [BRANCH_A, BRANCH_B],
    })
    clientId = seeded.clientId
    ;[branchAId, branchBId] = seeded.addressIds
  })

  test.afterAll(async () => {
    // Leave no addresses behind: other specs seed their own fixture with
    // seedClientWithDefaultAddress (which appends), so a leftover branch here
    // would turn their single-address flow into a picker and change the quote
    // destination. Also restores paid shipping.
    await seedClientAddresses({
      email: TEST_USER_EMAIL,
      hasFreeShipping: false,
      addresses: [],
    })
  })

  test('two branches → picker with the staff default pre-selected', async ({ page }) => {
    // Precondition: the seeded client really is on the no-Biteship branch.
    const { data: client } = await adminSupabase()
      .from('clients')
      .select('has_free_shipping')
      .eq('id', clientId)
      .single()
    expect(client?.has_free_shipping).toBe(true)

    await addOneItemAndGoToReview(page)

    await expect(page.getByTestId('address-picker')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId(`address-option-${branchAId}`)).toBeVisible()
    await expect(page.getByTestId(`address-option-${branchBId}`)).toBeVisible()

    // Staff default (branch A) is checked; the legacy single card is not used.
    await expect(page.getByTestId(`address-radio-${branchAId}`)).toBeChecked()
    await expect(page.getByTestId(`address-radio-${branchBId}`)).not.toBeChecked()
    await expect(page.getByTestId('address-card')).toHaveCount(0)
  })

  test('switching branch re-quotes and snapshots the chosen branch', async ({ page }) => {
    let actionPosts = 0
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/portal/order/review')) {
        actionPosts += 1
      }
    })

    await addOneItemAndGoToReview(page)
    await expect(page.getByTestId('address-picker')).toBeVisible({ timeout: 10_000 })

    const postsBeforeSwitch = actionPosts
    await page.getByTestId(`address-option-${branchBId}`).click()

    // The switch must trigger a fresh rates round-trip for the new destination.
    await expect.poll(() => actionPosts, { timeout: 10_000 }).toBeGreaterThan(postsBeforeSwitch)
    await expect(page.getByTestId(`address-radio-${branchBId}`)).toBeChecked()
    await expect(page.getByTestId('address-picker')).toBeVisible()

    await page.getByTestId('confirm-order-button').click()
    await expect(page).toHaveURL(/\/portal\/order\/confirmation/, { timeout: 15_000 })

    const supabase = adminSupabase()
    const { data: order } = await supabase
      .from('orders')
      .select('id, shipping_address')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    expect(order?.shipping_address).toMatchObject({
      id: branchBId,
      label: BRANCH_B.label,
      recipient_name: BRANCH_B.recipient_name,
      address_line: BRANCH_B.address_line,
      postal_code: BRANCH_B.postal_code,
    })

    // Per-order only: picking branch B must never move is_default.
    const { data: addresses } = await supabase
      .from('addresses')
      .select('id, is_default')
      .eq('client_id', clientId)
    expect(addresses?.find((a) => a.id === branchAId)?.is_default).toBe(true)
    expect(addresses?.find((a) => a.id === branchBId)?.is_default).toBe(false)
  })

  test('one address → plain card, no picker (unchanged pre-#101 flow)', async ({ page }) => {
    await seedClientAddresses({
      email: TEST_USER_EMAIL,
      hasFreeShipping: true,
      addresses: [BRANCH_A],
    })

    await addOneItemAndGoToReview(page)

    await expect(page.getByTestId('address-card')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('address-picker')).toHaveCount(0)
    await expect(page.getByTestId('address-label')).toHaveText(BRANCH_A.label)
  })
})
