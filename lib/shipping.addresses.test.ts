// lib/shipping.addresses.test.ts — #101: multi-branch checkout.
// The address picker's correctness lives in three pure helpers: the canonical
// order (staff default first, then oldest — mirrors agr-ops migration 029),
// the fail-closed selector (a foreign/deleted id must never fall back to the
// default), and the display fallback for label-less rows.
import { describe, expect, it } from 'vitest'

import {
  addressLabelText,
  addressToDisplay,
  selectCheckoutAddress,
  sortAddresses,
  type AddressOption,
} from './shipping'

function addr(overrides: Partial<AddressOption> & { id: string }): AddressOption {
  return {
    id: overrides.id,
    label: overrides.label ?? null,
    recipient_name: overrides.recipient_name ?? `Recipient ${overrides.id}`,
    phone: overrides.phone ?? null,
    address_line: overrides.address_line ?? `Jl. ${overrides.id}`,
    postal_code: overrides.postal_code ?? '12345',
    latitude: overrides.latitude ?? null,
    longitude: overrides.longitude ?? null,
    is_default: overrides.is_default ?? false,
    created_at: overrides.created_at ?? '2026-01-01T00:00:00Z',
  }
}

const DEFAULT_ROW = addr({ id: 'a-default', is_default: true, created_at: '2026-03-01T00:00:00Z' })
const OLD_ROW = addr({ id: 'a-old', is_default: false, created_at: '2025-01-01T00:00:00Z' })
const NEW_ROW = addr({ id: 'a-new', is_default: false, created_at: '2026-06-01T00:00:00Z' })

describe('sortAddresses', () => {
  it('puts the staff default first even when it is the newest row', () => {
    expect(sortAddresses([NEW_ROW, DEFAULT_ROW, OLD_ROW]).map((a) => a.id)).toEqual([
      'a-default',
      'a-old',
      'a-new',
    ])
  })

  it('without a default falls back to oldest-first (deterministic, no arbitrary first row)', () => {
    expect(sortAddresses([NEW_ROW, OLD_ROW]).map((a) => a.id)).toEqual(['a-old', 'a-new'])
  })

  it('treats a NULL is_default as not-default and orders it by age', () => {
    const nullDefault = addr({ id: 'a-null', is_default: null, created_at: '2024-01-01T00:00:00Z' })
    expect(sortAddresses([nullDefault, OLD_ROW, DEFAULT_ROW]).map((a) => a.id)).toEqual([
      'a-default',
      'a-null',
      'a-old',
    ])
  })

  it('breaks created_at ties on id so the order is total', () => {
    const tiedB = addr({ id: 'a-b', created_at: '2026-01-01T00:00:00Z' })
    const tiedA = addr({ id: 'a-a', created_at: '2026-01-01T00:00:00Z' })
    expect(sortAddresses([tiedB, tiedA]).map((a) => a.id)).toEqual(['a-a', 'a-b'])
  })

  it('does not mutate the caller array', () => {
    const rows = [NEW_ROW, OLD_ROW]
    sortAddresses(rows)
    expect(rows.map((a) => a.id)).toEqual(['a-new', 'a-old'])
  })
})

describe('selectCheckoutAddress', () => {
  it('returns NO_ADDRESS when the client has no rows', () => {
    expect(selectCheckoutAddress([])).toEqual({ ok: false, error: 'NO_ADDRESS' })
    expect(selectCheckoutAddress([], 'a-default')).toEqual({ ok: false, error: 'NO_ADDRESS' })
  })

  it('pre-selects the staff default when the client sent no pick', () => {
    const result = selectCheckoutAddress([NEW_ROW, DEFAULT_ROW])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.address.id).toBe('a-default')
    // The full list (already sorted) travels with the result for the picker.
    expect(result.addresses.map((a) => a.id)).toEqual(['a-default', 'a-new'])
  })

  it('honours an explicit pick over the staff default', () => {
    const result = selectCheckoutAddress([NEW_ROW, DEFAULT_ROW], NEW_ROW.id)
    expect(result.ok && result.address.id).toBe('a-new')
  })

  it('fails closed on an unknown id — it never silently falls back to the default', () => {
    // A foreign client's address id can never be returned: the picker list is
    // already scoped to this client, so the id simply does not match.
    const result = selectCheckoutAddress([NEW_ROW, DEFAULT_ROW], 'someone-elses-address')
    expect(result).toEqual({ ok: false, error: 'INVALID_ADDRESS' })
  })

  it('fails closed on an id belonging to a second branch the client does not own any more', () => {
    const result = selectCheckoutAddress([DEFAULT_ROW], 'deleted-branch')
    expect(result.ok).toBe(false)
  })
})

describe('addressToDisplay', () => {
  it('carries id/label/phone into the order snapshot', () => {
    const display = addressToDisplay(
      addr({ id: 'a-1', label: 'Cabang Kemang', phone: '081200000000', is_default: true })
    )
    expect(display).toMatchObject({
      id: 'a-1',
      label: 'Cabang Kemang',
      phone: '081200000000',
      recipient_name: 'Recipient a-1',
      postal_code: '12345',
    })
  })

  it('normalises missing GPS to null (Biteship postal lanes)', () => {
    expect(addressToDisplay(addr({ id: 'a-2' })).latitude).toBeNull()
  })
})

describe('addressLabelText', () => {
  it('uses the staff label when present', () => {
    expect(addressLabelText({ label: 'Jendela Rasa' }, 0)).toBe('Jendela Rasa')
  })

  it('falls back to a positional label for blank/missing labels', () => {
    expect(addressLabelText({ label: null }, 1)).toBe('Alamat 2')
    expect(addressLabelText({ label: '   ' }, 0)).toBe('Alamat 1')
    expect(addressLabelText({}, 2)).toBe('Alamat 3')
  })
})
