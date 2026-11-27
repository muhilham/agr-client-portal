// lib/shipping.addressResolution.test.ts — #101: the DB-facing half of the
// address picker. These tests pin two things the pure helpers cannot:
//   1. the address query is ALWAYS scoped by client_id (ownership), and
//   2. the free-shipping branch (no Biteship call) returns the picked address
//      plus the full list for the picker.
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = {
  id: string
  label: string | null
  recipient_name: string
  phone: string | null
  address_line: string
  postal_code: string
  latitude: number | null
  longitude: number | null
  is_default: boolean | null
  created_at: string
}

const state: {
  rows: Row[]
  filters: [string, unknown][]
  hasFreeShipping: boolean
} = { rows: [], filters: [], hasFreeShipping: false }

const addressQuery = {
  select: vi.fn(() => addressQuery),
  eq: vi.fn((column: string, value: unknown) => {
    state.filters.push([column, value])
    return addressQuery
  }),
  then: (resolve: (value: { data: Row[]; error: null }) => unknown) =>
    Promise.resolve({ data: state.rows, error: null }).then(resolve),
}

const clientQuery = {
  select: vi.fn(() => clientQuery),
  eq: vi.fn(() => clientQuery),
  single: vi.fn(async () => ({ data: { has_free_shipping: state.hasFreeShipping }, error: null })),
}

const from = vi.fn((table: string) => (table === 'addresses' ? addressQuery : clientQuery))

vi.mock('@/lib/supabase/admin', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSupabaseAdmin: () => ({ from } as any),
}))

import { loadShippingContext, resolveCheckoutAddress } from './shipping'

const BRANCH_A: Row = {
  id: 'a-default',
  label: 'Cabang Kemang',
  recipient_name: 'Kemang Kitchen',
  phone: '081200000001',
  address_line: 'Jl. Kemang Raya 1',
  postal_code: '12730',
  latitude: -6.26,
  longitude: 106.81,
  is_default: true,
  created_at: '2026-01-02T00:00:00Z',
}

const BRANCH_B: Row = {
  id: 'a-bandung',
  label: 'Cabang Bandung',
  recipient_name: 'Bandung Kitchen',
  phone: '081200000002',
  address_line: 'Jl. Braga 2',
  postal_code: '40115',
  latitude: -6.91,
  longitude: 107.6,
  is_default: false,
  created_at: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
  state.rows = [BRANCH_B, BRANCH_A]
  state.filters = []
  state.hasFreeShipping = true
  from.mockClear()
  addressQuery.eq.mockClear()
})

describe('resolveCheckoutAddress — ownership scoping', () => {
  it('scopes every address read by client_id (foreign rows are never visible)', async () => {
    await resolveCheckoutAddress('client-1')
    expect(state.filters).toContainEqual(['client_id', 'client-1'])
    expect(addressQuery.eq).toHaveBeenCalledWith('client_id', 'client-1')
  })

  it('pre-selects the staff default and returns the whole list', async () => {
    const result = await resolveCheckoutAddress('client-1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.address.id).toBe('a-default')
    expect(result.addresses.map((a) => a.id)).toEqual(['a-default', 'a-bandung'])
  })

  it('returns the explicitly picked branch', async () => {
    const result = await resolveCheckoutAddress('client-1', 'a-bandung')
    expect(result.ok && result.address.id).toBe('a-bandung')
  })

  it('fails closed for an id that is not in this client\'s rows', async () => {
    const result = await resolveCheckoutAddress('client-1', 'foreign-address')
    expect(result).toEqual({ ok: false, error: 'INVALID_ADDRESS' })
  })

  it('reports NO_ADDRESS when the client has no rows', async () => {
    state.rows = []
    const result = await resolveCheckoutAddress('client-1')
    expect(result).toEqual({ ok: false, error: 'NO_ADDRESS' })
    expect(await resolveCheckoutAddress('client-1', 'anything')).toEqual({
      ok: false,
      error: 'NO_ADDRESS',
    })
  })
})

describe('loadShippingContext — free shipping branch (#101)', () => {
  it('returns the picked address and the full list without quoting rates', async () => {
    // No BITESHIP_ORIGIN_LOCATION_ID in the test env: if this branch ever fell
    // through to quoting it would return ORIGIN_NOT_CONFIGURED.
    const ctx = await loadShippingContext('client-1', [], 'a-bandung')
    expect(ctx.ok).toBe(true)
    if (!ctx.ok) return
    expect(ctx.kind).toBe('free_shipping')
    expect(ctx.address).toMatchObject({
      id: 'a-bandung',
      label: 'Cabang Bandung',
      phone: '081200000002',
      postal_code: '40115',
    })
    expect(ctx.addresses).toHaveLength(2)
  })

  it('uses the staff default when no branch was picked', async () => {
    const ctx = await loadShippingContext('client-1', [])
    expect(ctx.ok).toBe(true)
    if (!ctx.ok) return
    expect(ctx.address.id).toBe('a-default')
  })

  it('propagates INVALID_ADDRESS instead of falling back to the default', async () => {
    const ctx = await loadShippingContext('client-1', [], 'foreign-address')
    expect(ctx).toEqual({ ok: false, error: 'INVALID_ADDRESS' })
  })
})
