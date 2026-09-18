import { describe, expect, it } from 'vitest'
import { safeNextTarget } from './safe-next'

describe('safeNextTarget', () => {
  it('passes through a plain /portal deep-link with query', () => {
    expect(safeNextTarget('/portal?reorder=abc-123')).toBe('/portal?reorder=abc-123')
  })

  it('passes through /portal sub-paths', () => {
    expect(safeNextTarget('/portal/orders')).toBe('/portal/orders')
    expect(safeNextTarget('/portal/orders?id=1')).toBe('/portal/orders?id=1')
  })

  it('passes through bare /portal', () => {
    expect(safeNextTarget('/portal')).toBe('/portal')
  })

  it('rejects absolute URLs (open redirect)', () => {
    expect(safeNextTarget('https://evil.test/portal')).toBeNull()
    expect(safeNextTarget('http://evil.test')).toBeNull()
    expect(safeNextTarget('/portal/../..%2Fhttps://evil.test')).toBeNull()
  })

  it('rejects protocol-relative URLs', () => {
    expect(safeNextTarget('//evil.test')).toBeNull()
    expect(safeNextTarget('//evil.test/portal')).toBeNull()
  })

  it('rejects backslash variants that parsers normalize to //', () => {
    expect(safeNextTarget('/\\evil.test')).toBeNull()
    expect(safeNextTarget('/portal\\..\\..\\evil.test')).toBeNull()
  })

  it('rejects paths outside the /portal tree', () => {
    expect(safeNextTarget('/')).toBeNull()
    expect(safeNextTarget('/dashboard')).toBeNull()
    expect(safeNextTarget('/portfolios')).toBeNull() // prefix-sibling attack
    expect(safeNextTarget('/portal/../auth/unauthorized')).toBeNull()
  })

  it('rejects empty/null', () => {
    expect(safeNextTarget('')).toBeNull()
    expect(safeNextTarget(null)).toBeNull()
    expect(safeNextTarget(undefined)).toBeNull()
  })

  it('strips fragment but keeps query', () => {
    // new URL keeps hash; we rebuild pathname+search only
    expect(safeNextTarget('/portal?reorder=x#frag')).toBe('/portal?reorder=x')
  })
})
