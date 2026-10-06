import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ORIGINAL_ENV = process.env

describe('getBiteshipLocation coordinate parsing', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env = { ...ORIGINAL_ENV, BITESHIP_API_KEY: 'test-key' }
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('extracts lat/lng from nested coordinate object (live API shape)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'loc-1',
        name: 'AGROASTERY',
        contact_name: 'Agr',
        contact_phone: '081234567890',
        address: 'Jl. Kemang Barat No.7i',
        postal_code: '12730',
        coordinate: { latitude: -6.2636835, longitude: 106.8194514 },
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { getBiteshipLocation } = await import('./biteship')
    const loc = await getBiteshipLocation('loc-1')

    expect(loc?.latitude).toBe(-6.2636835)
    expect(loc?.longitude).toBe(106.8194514)
  })

  it('falls back to top-level lat/lng (legacy/mock shape)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'loc-2',
        name: 'Test Origin',
        contact_name: 'Test',
        contact_phone: '081234567890',
        address: 'Jl. Test No. 1',
        postal_code: '12345',
        latitude: -6.2,
        longitude: 106.8,
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { getBiteshipLocation } = await import('./biteship')
    const loc = await getBiteshipLocation('loc-2')

    expect(loc?.latitude).toBe(-6.2)
    expect(loc?.longitude).toBe(106.8)
  })

  it('returns null coords when neither shape is present', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'loc-3',
        name: 'No GPS',
        contact_name: 'Test',
        contact_phone: '081234567890',
        address: 'Jl. Nowhere',
        postal_code: '11111',
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { getBiteshipLocation } = await import('./biteship')
    const loc = await getBiteshipLocation('loc-3')

    expect(loc?.latitude).toBeNull()
    expect(loc?.longitude).toBeNull()
  })
})
