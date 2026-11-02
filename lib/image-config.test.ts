import { describe, expect, it } from 'vitest'
import nextConfig from '@/next.config'
import { matchPattern } from './image-config'

const patterns = nextConfig.images?.remotePatterns ?? []

function isAllowed(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl)
    return patterns.some((p) => matchPattern(p, u))
  } catch {
    return false
  }
}

describe('next/image remotePatterns allowlist', () => {
  it('has exactly the two CDN patterns', () => {
    expect(patterns).toHaveLength(2)
    for (const p of patterns) {
      expect(p.protocol).toBe('https')
      expect(p.hostname).toBe('cdn.agroastery.com')
    }
    expect(patterns.map((p) => p.pathname).sort()).toEqual([
      '/products/**',
      '/produk/**',
    ])
  })

  it('allows current UUID-path product images', () => {
    expect(
      isAllowed(
        'https://cdn.agroastery.com/products/10228cdc-c27e-45a4-b5f9-005a77839966/1793010601027.jpg',
      ),
    ).toBe(true)
  })

  it('allows legacy slug-path product images (issue #87 regression)', () => {
    expect(isAllowed('https://cdn.agroastery.com/produk/strawberrijen/1.jpeg')).toBe(true)
    expect(isAllowed('https://cdn.agroastery.com/produk/blackcurrant/1.png')).toBe(true)
  })

  it('rejects foreign hosts', () => {
    expect(isAllowed('https://evil.example.com/products/a/1.jpg')).toBe(false)
    expect(isAllowed('https://cdn.agroastery.com.evil.net/produk/a/1.jpg')).toBe(false)
  })

  it('rejects unapproved paths on the CDN host', () => {
    expect(isAllowed('https://cdn.agroastery.com/leads/x.jpg')).toBe(false)
    expect(isAllowed('https://cdn.agroastery.com/products')).toBe(false)
    // prefix must be a full path segment, not a string prefix
    expect(isAllowed('https://cdn.agroastery.com/produk-x/a/1.jpg')).toBe(false)
  })

  it('rejects http (non-TLS) URLs', () => {
    expect(isAllowed('http://cdn.agroastery.com/produk/a/1.jpg')).toBe(false)
  })
})
