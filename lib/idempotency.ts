/**
 * In-memory idempotency store for order submission.
 *
 * Maps cartToken → { orderId, orderNumber, createdAt }
 * Entries expire after TTL (default 10 min).
 *
 * Warning: per-process storage. Railway workers run one process per instance,
 * so a token created on worker A is not visible on worker B.
 * Acceptable for v1; upgrade to Redis or DB unique constraint when needed.
 */

const TTL_MS = 10 * 60 * 1_000

type IdempotencyEntry = {
  orderId: string
  orderNumber: string
  createdAt: number
}

const store = new Map<string, IdempotencyEntry>()

// Periodic sweep to prevent memory leaks from expired entries
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (now - entry.createdAt > TTL_MS) {
      store.delete(key)
    }
  }
}, 60_000)

export function checkIdempotency(token: string): IdempotencyEntry | null {
  const entry = store.get(token)
  if (!entry) return null
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(token)
    return null
  }
  return entry
}

export function setIdempotency(token: string, orderId: string, orderNumber: string): void {
  store.set(token, { orderId, orderNumber, createdAt: Date.now() })
}
