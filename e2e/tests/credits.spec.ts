/**
 * credits.spec.ts — #411 client-facing credit chain
 *
 * Grant (service-role staff_add_credit, same RPC ops uses) →
 * home balance card → full-cover order → "Lunas dengan credit" →
 * SPEND row + balance view → over-balance order → clamped SPEND +
 * remainder in PaymentCard → /portal/credits history → ops cancel →
 * REFUND row visible → user-JWT RLS isolation pin.
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
  let fullCoverTotal = 0
  let overBalanceBaseline = 0

  test('client with no entries sees no credit UI', async ({ page }) => {
    await page.goto('/portal')
    await expect(page.getByTestId('credit-balance-card')).toHaveCount(0)
    await expect(page.getByTestId('credits-nav-link')).toHaveCount(0)
  })

  test('first grant makes balance card appear', async () => {
    const bal = await grant(supabase, 150000)
    expect(bal).toBe(150000)
  })

  test('full-cover order: lunas copy, SPEND row, balance derived', async ({
    page,
  }) => {
    await mockBiteshipLocation(page)
    await page.goto('/portal')
    await expect(page.getByTestId('credit-balance-card')).toBeVisible()
    await expect(page.getByTestId('credit-balance-amount')).toContainText('150.000')

    await addFirstProduct(page)
    await page.getByTestId('fulfillment-option-pickup').click()
    await page.getByTestId('confirm-order-button').click()
    await expect(page).toHaveURL(/\/portal\/order\/confirmation/, { timeout: 15_000 })

    const totalText = (await page.getByTestId('confirmation-grand-total').textContent())!
    const total = Number(totalText.replace(/\D/g, ''))
    // Balance is 150.000 and the seeded product is 85.000 — full cover.
    expect(total).toBeLessThanOrEqual(150000)
    await expect(page.getByTestId('confirmation-lunas')).toBeVisible()
    await expect(page.getByTestId('confirmation-card')).toBeVisible()

    expect(await balance(supabase)).toBe(150000 - total)
    const { clientId } = getTestIds()
    const { data: order } = await supabase
      .from('orders')
      .select('id, credit_applied')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    expect(Number(order!.credit_applied)).toBe(total)
    fullCoverOrderId = order!.id
    fullCoverTotal = total
    overBalanceBaseline = 150000 - total
  })

  test('over-balance order: SPEND = remaining balance, PaymentCard shows remainder', async ({
    page,
  }) => {
    // AC 'Portal order > balance': deduction clamps to the balance
    // and the transfer amount is the remainder. The 85k product above
    // left the balance below one unit price, so this order is
    // genuinely over-balance. (Pass-3 reviewer F7: the previous test
    // named this case but never exercised PaymentCard — F8's duplicate
    // credit line slipped through exactly because of that.)
    const balBefore = overBalanceBaseline
    expect(balBefore).toBeGreaterThan(0)

    await mockBiteshipLocation(page)
    await page.goto('/portal')
    await addFirstProduct(page)
    await page.getByTestId('fulfillment-option-pickup').click()
    await page.getByTestId('confirm-order-button').click()
    await expect(page).toHaveURL(/\/portal\/order\/confirmation/, { timeout: 15_000 })

    const total = Number(
      (await page.getByTestId('confirmation-grand-total').textContent())!.replace(/\D/g, '')
    )
    expect(total).toBeGreaterThan(balBefore) // precondition: over-balance

    await expect(page.getByTestId('confirmation-remaining-line')).toContainText(
      (total - balBefore).toLocaleString('id-ID')
    )
    // SPEND clamps to the balance (contract), draining it to zero.
    expect(await balance(supabase)).toBe(0)

    const { clientId } = getTestIds()
    const { data: order } = await supabase
      .from('orders')
      .select('id, credit_applied')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    expect(Number(order!.credit_applied)).toBe(balBefore)

    // PaymentCard (UNPAID order detail): exactly ONE credit line,
    // grand total is the remainder.
    await page.goto(`/portal/orders/${order!.id}`)
    const creditLine = page.getByTestId('payment-credit-line')
    await expect(creditLine).toHaveCount(1)
    await expect(creditLine).toContainText(balBefore.toLocaleString('id-ID'))
    await expect(page.getByTestId('payment-grand-total')).toContainText(
      (total - balBefore).toLocaleString('id-ID')
    )
  })

  test('credits history page lists grant and spend', async ({ page }) => {
    await page.goto('/portal/credits')
    // Rows carry no data-testid; assert on the rendered labels:
    // exactly one grant row and two spend rows (full-cover + the
    // over-balance order), newest first, and the drained Rp 0 balance
    // (contract: card permanent once ≥1 entry, even at Rp 0).
    await expect(page.getByText('Pemberian kredit')).toHaveCount(1)
    await expect(page.getByText('Dipakai untuk pesanan')).toHaveCount(2)
    await expect(page.getByText('+Rp 150.000')).toBeVisible()
    await expect(page.getByText('-Rp 85.000')).toBeVisible()
    await expect(page.getByText('-Rp 65.000')).toBeVisible()
    await expect(page.getByTestId('credits-balance')).toContainText('Rp 0')
  })

  test('ops cancel refunds via REFUND row; portal card shows it', async ({ page }) => {
    test.skip(!fullCoverOrderId, 'no fully-covered order in this run')
    // Trigger the refund exactly as the ops route does (same service RPC).
    const { error } = await supabase.rpc('credit_refund', { p_order_id: fullCoverOrderId! })
    expect(error).toBeNull()
    // Refund restores exactly the full-cover order's applied amount
    // (the over-balance order's SPEND of the leftover balance stays).
    expect(await balance(supabase)).toBe(fullCoverTotal)
    expect(await kinds(supabase)).toContain('REFUND')

    // Idempotent: second refund writes nothing (AC: cancel twice refunds once)
    const again = await supabase.rpc('credit_refund', { p_order_id: fullCoverOrderId! })
    expect(again.error).toBeNull()
    expect(await kinds(supabase)).toEqual(['GRANT', 'SPEND', 'SPEND', 'REFUND'])

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
