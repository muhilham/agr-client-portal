import { describe, expect, it } from 'vitest'
import { imageDisplayState } from './image-fallback'

describe('imageDisplayState', () => {
  it('renders the image when a URL exists and has not failed', () => {
    expect(imageDisplayState('https://cdn.agroastery.com/produk/a/1.png')).toBe('image')
  })

  it('shows placeholder when no URL (pre-existing behavior)', () => {
    expect(imageDisplayState(null)).toBe('placeholder')
    expect(imageDisplayState(undefined)).toBe('placeholder')
    expect(imageDisplayState('')).toBe('placeholder')
  })

  it('shows placeholder after onError (issue #87 lost-asset case)', () => {
    expect(imageDisplayState('https://cdn.agroastery.com/products/dead/0.jpg', true)).toBe(
      'placeholder',
    )
  })

  it('does not re-fetch: failed flag wins even for a valid-looking URL', () => {
    expect(imageDisplayState('https://cdn.agroastery.com/products/x/ok.jpg', true)).toBe(
      'placeholder',
    )
  })
})
