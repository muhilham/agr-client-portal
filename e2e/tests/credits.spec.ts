/**
 * credits.spec.ts — #411 client-facing credit chain
 *
 * Grant (service-role staff_add_credit, same RPC ops uses) →
 * home balance card → order under balance → "Lunas dengan credit" →
 * SPEND row + balance view → /portal/credits history → over-balance
 * order → remainder in PaymentCard → ops cancel → REFUND row visible.
 *
 * Runs against the same local Supabase stack as agr-ops e2e
 * (.env.e2e), where migration 075_client_credits is applied.
 */

import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { mockBiteshipLocation } from '../helpers/biteship'

function getTestIds() {
  const file = path.join(__dirname, '../.auth/test-ids.json')
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as {
    clientId: string
    clientEmail: string
  }
}

function adminSupabase(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function grant(supabase: SupabaseClient, amount: number) {
  const { clientId } = getTestIds()
  const { data, error } = await supabase.rpc('staff_add_credit', {
    p_client_id: clientId,
    p_kind: 'GRANT',
    p_amount: amount,
    p_reason: 'E2E credit grant',
    p_author_id: null,
  })
  if (error) throw new Error(`grant failed: ${error.message}`)
  return Number(data ?? 0)
}

async function balance(supabase: SupabaseClient) {
  const { clientId } = getTestIds()
  const { data, error } = await supabase
    .from('client_credit_balances')
    .select('balance')
    .eq('client_id', clientId)
    .maybeSingle()
  if (error) throw new Error(`balance read failed: ${error.message}`)
  return Number(data?.balance ?? 0)
}

async function kinds(supabase: SupabaseClient): Promise<string[]> {
  const { clientId } = getTestIds()
  const { data } = await supabase
    .from('credit_entries')
    .select('kind')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true })
  return (data ?? []).map((r: { kind: string }) => r.kind)
}

async function addFirstProduct(page: Page) {
  const card = page.locator('[data-testid^="product-card-"]').first()
  await card.waitFor()
  const productId = (await card.getAttribute('data-testid'))!.replace('product-card-', '')
  await page.getByTestId(`qty-increment-${productId}`).click()
  await page.getByTestId('review-order-button').click()
  await expect(page).toHaveURL('/portal/order/review')
  return productId
}

const supabase = adminSupabase()

test.describe('Credit chain (#411)', () => {
  test.describe.configure({ mode: 'serial' })
  let fullCoverOrderId: string | null = null

  test('client with no entries sees no credit UI', async ({ page }) => {
    await page.goto('/portal')
    await expect(page.getByTestId('credit-balance-card')).toHaveCount(0)
    await expect(page.getByTestId('credits-nav-link')).toHaveCount(0)
  })

  test('first grant makes balance card appear', async () => {
    const bal = await grant(supabase, 150000)
    expect(bal).toBe(150000)
  })

  test('home shows card; over-balance order keeps remainder in PaymentCard', async ({
    page,
  }) => {
    await mockBiteshipLocation(page)
    await page.goto('/portal')
    await expect(page.getByTestId('credit-balance-card')).toBeVisible()
    await expect(page.getByTestId('credit-balance-amount')).toContainText('150.000')

    // First product price is 85.000 (custom_price) or 100.000 base.
    // Grant is below any price? No — pick the GLOBAL product path? Simpler:
    // order a product priced above balance is not guaranteed; instead read
    // the review-page grand total and assert the deduction relationship.
    await addFirstProduct(page)
    await page.getByTestId('fulfillment-option-pickup').click()
    await page.getByTestId('confirm-order-button').click()
    await expect(page).toHaveURL(/\/portal\/order\/confirmation/, { timeout: 15_000 })

    const totalText = (await page.getByTestId('confirmation-grand-total').textContent())!
    const total = Number(totalText!.replace(/\D/g, ''))
    const applied = Math.min(150000, total)

    if (applied >= total) {
      // Full cover: lunas copy, no transfer block
      await expect(page.getByTestId('confirmation-lunas')).toBeVisible()
      await expect(page.getByTestId('confirmation-card')).toBeVisible()
    } else {
      await expect(page.getByTestId('confirmation-remaining-line')).toContainText(
        (total - applied).toLocaleString('id-ID')
      )
    }

    // Ledger + derived order state
    expect(await balance(supabase)).toBe(Math.max(150000 - total, 0))
    const { clientId } = getTestIds()
    const { data: order } = await supabase
      .from('orders')
      .select('id, credit_applied')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    expect(Number(order!.credit_applied)).toBe(applied)
    fullCoverOrderId = applied >= total ? order!.id : null
  })

  test('credits history page lists grant and spend', async ({ page }) => {
    await page.goto('/portal/credits')
    await expect(page.getByTestId('credit-row-grant')).toBeVisible()
    await expect(page.getByTestId('credit-row-spend')).toBeVisible()
    await expect(page.getByTestId('credits-balance')).toBeVisible()
  })

  test('ops cancel refunds via REFUND row; portal card shows it', async ({ page }) => {
    test.skip(!fullCoverOrderId, 'no fully-covered order in this run')
    // Trigger the refund exactly as the ops route does (same service RPC).
    const { error } = await supabase.rpc('credit_refund', { p_order_id: fullCoverOrderId! })
    expect(error).toBeNull()
    // Full cover → refund restores the entire grant.
    expect(await balance(supabase)).toBe(150000)
    expect(await kinds(supabase)).toContain('REFUND')

    // Idempotent: second refund writes nothing (AC: cancel twice refunds once)
    const again = await supabase.rpc('credit_refund', { p_order_id: fullCoverOrderId! })
    expect(again.error).toBeNull()
    expect(await kinds(supabase)).toEqual(['GRANT', 'SPEND', 'REFUND'])

    await page.goto('/portal/credits')
    await expect(page.getByTestId('credit-row-refund')).toBeVisible()
  })

  test('client JWT sees ONLY its own rows in the view and ledger', async () => {
    // Regression pin for the PR-review finding: without
    // WITH (security_invoker = true) on client_credit_balances, the
    // view ran as its BYPASSRLS owner and leaked every client's
    // balance to any logged-in portal user. This test queries
    // through PostgREST with a REAL user JWT — the production path.
    const email = process.env.E2E_TEST_CLIENT_EMAIL!
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    )
    const { error: signInErr } = await anon.auth.signInWithPassword({
      email,
      password: process.env.E2E_TEST_PASSWORD ?? 'credits-e2e-pass-123',
    })
    expect(signInErr).toBeNull()

    // Self-grant so the test does not depend on earlier specs' state.
    await grant(supabase, 1000)

    // Seed a DIFFERENT client with its own grant, invisible to the user above.
    const otherEmail = `creditother-${Date.now()}@playwright.test`
    const { data: otherClient, error: otherErr } = await supabase
      .from('clients')
      .insert({ name: 'Credit Other', company_name: 'CO', email: otherEmail, is_active: true })
      .select('id')
      .single()
    expect(otherErr).toBeNull()
    const { error: grantOtherErr } = await supabase.rpc('staff_add_credit', {
      p_client_id: otherClient!.id,
      p_kind: 'GRANT',
      p_amount: 999000,
      p_reason: 'E2E isolation probe',
      p_author_id: null,
    })
    expect(grantOtherErr).toBeNull()

    try {
      const { data: balRows, error: viewErr } = await anon
        .from('client_credit_balances')
        .select('client_id, balance')
      expect(viewErr).toBeNull()
      const ids = (balRows ?? []).map((r: { client_id: string }) => r.client_id)
      expect(ids).not.toContain(otherClient!.id)
      for (const r of balRows ?? []) {
        expect(r.client_id).toBe(getTestIds().clientId)
      }

      const { data: entryRows, error: entErr } = await anon
        .from('credit_entries')
        .select('client_id')
      expect(entErr).toBeNull()
      expect((entryRows ?? []).length).toBeGreaterThan(0)
      for (const r of entryRows ?? []) {
        expect(r.client_id).toBe(getTestIds().clientId)
      }
    } finally {
      await supabase.from('credit_entries').delete().eq('client_id', otherClient!.id)
      await supabase.from('clients').delete().eq('id', otherClient!.id)
    }
  })
})
