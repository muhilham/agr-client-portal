/**
 * Validation for the `?next=` post-login redirect target.
 *
 * The value originates from the URL (reflected by middleware and the auth
 * callback), so it is attacker-controlled. Policy: only same-origin paths
 * inside the `/portal` tree are honored — that is the only tree the proxy
 * matcher (`/portal/:path*`) ever captures, so anything else is spoofed.
 *
 * Pure function, no runtime deps: safe to import from edge middleware,
 * route handlers, and server components alike.
 */

const FALLBACK: string | null = null

export function safeNextTarget(raw: string | null | undefined): string | null {
  if (!raw) return FALLBACK

  // Backslash can be normalized to `/` by URL parsers
  if (raw.includes('\\')) return FALLBACK

  // Require a literal relative /portal prefix. Rejects `//host`, `https://…`,
  // and percent-encoded variants (%2F never starts the decoded string here).
  if (!raw.startsWith('/portal') || raw.startsWith('//')) return FALLBACK

  try {
    const u = new URL(raw, 'http://portal.invalid')
    // Only same-origin, and path traversal must resolve back inside /portal.
    if (u.origin !== 'http://portal.invalid') return FALLBACK
    if (u.pathname !== '/portal' && !u.pathname.startsWith('/portal/')) return FALLBACK
    return u.pathname + u.search
  } catch {
    return FALLBACK
  }
}
