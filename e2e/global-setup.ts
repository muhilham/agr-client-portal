/**
 * global-setup.ts
 *
 * Runs once before all tests (outside the browser).
 * - Ensures a test client exists in the `clients` table
 * - Ensures at least one product is assigned to that client
 * - Cleans up test orders from previous runs
 *
 * Requires env vars (copy from .env.e2e.example):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   E2E_TEST_CLIENT_EMAIL
 *   E2E_TEST_UNAUTH_EMAIL
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

export default async function globalSetup() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const clientEmail = process.env.E2E_TEST_CLIENT_EMAIL
  const unauthEmail = process.env.E2E_TEST_UNAUTH_EMAIL

  if (!supabaseUrl || !serviceRoleKey || !clientEmail || !unauthEmail) {
    throw new Error(
      'Missing required E2E env vars. Copy .env.e2e.example to .env.e2e and fill in values.'
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  // ── 1. Ensure auth users exist ──────────────────────────────────────────────

  // Test client user (should be in clients table)
  const { data: existingClientUser } = await supabase.auth.admin.listUsers()
  const clientAuthUser = existingClientUser?.users.find((u) => u.email === clientEmail)

  let clientAuthId: string
  if (!clientAuthUser) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: clientEmail,
      email_confirm: true,
    })
    if (error) throw new Error(`Failed to create auth user for ${clientEmail}: ${error.message}`)
    clientAuthId = data.user.id
    console.log(`[setup] Created auth user: ${clientEmail}`)
  } else {
    clientAuthId = clientAuthUser.id
    console.log(`[setup] Auth user already exists: ${clientEmail}`)
  }

  // Unauthorized user (NOT in clients table — just an auth user)
  const unauthAuthUser = existingClientUser?.users.find((u) => u.email === unauthEmail)
  if (!unauthAuthUser) {
    const { error } = await supabase.auth.admin.createUser({
      email: unauthEmail,
      email_confirm: true,
    })
    if (error) throw new Error(`Failed to create auth user for ${unauthEmail}: ${error.message}`)
    console.log(`[setup] Created unauth user: ${unauthEmail}`)
  }

  // ── 2. Ensure test client row exists ────────────────────────────────────────

  const { data: existingClient } = await supabase
    .from('clients')
    .select('id')
    .eq('email', clientEmail)
    .single()

  let clientId: string
  if (!existingClient) {
    const { data: newClient, error } = await supabase
      .from('clients')
      .insert({
        name: 'E2E Test Client',
        company_name: 'E2E Corp',
        email: clientEmail,
        is_active: true,
      })
      .select('id')
      .single()
    if (error) throw new Error(`Failed to insert test client: ${error.message}`)
    clientId = newClient!.id
    console.log(`[setup] Created test client row: ${clientId}`)
  } else {
    clientId = existingClient.id
    console.log(`[setup] Test client row exists: ${clientId}`)
  }

  // Write clientId to temp file so tests can reference it
  fs.mkdirSync(path.join(__dirname, '.auth'), { recursive: true })
  fs.writeFileSync(
    path.join(__dirname, '.auth', 'test-ids.json'),
    JSON.stringify({ clientId, clientEmail, unauthEmail, clientAuthId })
  )

  // ── 3. Ensure at least one active product + client assignment ────────────────

  const { data: existingProducts } = await supabase
    .from('products')
    .select('id')
    .eq('is_active', true)
    .limit(1)

  let productId: string
  if (!existingProducts || existingProducts.length === 0) {
    const { data: newProduct, error } = await supabase
      .from('products')
      .insert({
        name: 'E2E Test Product',
        description: 'Produk untuk E2E testing',
        unit: 'kg',
        sku: 'E2E-001',
        base_price: 100000,
        is_active: true,
        is_global: false,
      })
      .select('id')
      .single()
    if (error) throw new Error(`Failed to insert test product: ${error.message}`)
    productId = newProduct!.id
    console.log(`[setup] Created test product: ${productId}`)
  } else {
    productId = existingProducts[0].id
    console.log(`[setup] Using existing product: ${productId}`)
  }

  // Assign product to test client (idempotent via upsert)
  const { error: assignErr } = await supabase
    .from('client_products')
    .upsert(
      {
        client_id: clientId,
        product_id: productId,
        custom_price: 85000,
        min_qty: 1,
      },
      { onConflict: 'client_id,product_id', ignoreDuplicates: true }
    )

  if (assignErr && !assignErr.message.includes('duplicate')) {
    console.warn(`[setup] client_products upsert warning: ${assignErr.message}`)
  }

  // ── 4. Clean up test orders from previous runs ───────────────────────────────

  const { data: staleOrders } = await supabase
    .from('orders')
    .select('id')
    .eq('client_id', clientId)
    .like('order_number', 'AGR-%')

  if (staleOrders && staleOrders.length > 0) {
    const ids = staleOrders.map((o) => o.id)
    await supabase.from('order_items').delete().in('order_id', ids)
    await supabase.from('notification_logs').delete().in('order_id', ids)
    await supabase.from('orders').delete().in('id', ids)
    console.log(`[setup] Cleaned up ${staleOrders.length} stale test order(s)`)
  }

  console.log('[setup] Global setup complete.')
}
