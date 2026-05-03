# Dynamic Biteship Courier Fetch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded `BITESHIP_COURIERS` env var with a dynamic fetch from Biteship's `GET /v1/couriers` endpoint, cached for 1 hour with graceful fallback.

**Architecture:** A module-level `Map` cache in `lib/biteship.ts` stores courier codes with a 1-hour TTL. `getBiteshipCouriers()` checks cache, hits the API on miss, extracts `courier_code` values, and returns them. `lib/shipping.ts` calls this function and falls back to `process.env.BITESHIP_COURIERS` or a hardcoded default on any failure.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Biteship REST API.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `lib/biteship.ts` | Modify | Add `getBiteshipCouriers()`, cache, and response types |
| `lib/shipping.ts` | Modify | Replace hardcoded `couriers` with dynamic fetch + fallback chain |
| `.env.local.example` | Modify | Update `BITESHIP_COURIERS` comment to indicate optional fallback |

---

## Task 1: Add `getBiteshipCouriers()` to `lib/biteship.ts`

**Files:**
- Modify: `lib/biteship.ts`

- [ ] **Step 1: Add response types and module-level cache**

Insert the following after the `BiteshipRate` interface (before the `getBiteshipRates` function):

```typescript
interface BiteshipCourier {
  courier_code: string
  courier_name: string
}

interface BiteshipCouriersResponse {
  success?: boolean
  couriers?: BiteshipCourier[]
}

const CACHE_TTL_MS = 3_600_000 // 1 hour
const courierCache = new Map<string, { codes: string[]; fetchedAt: number }>()
```

- [ ] **Step 2: Add `getBiteshipCouriers()` function**

Insert the following after the cache declaration:

```typescript
export async function getBiteshipCouriers(): Promise<string[] | null> {
  const apiKey = getApiKey()
  const cached = courierCache.get(apiKey)

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.codes
  }

  try {
    const res = await fetchWithTimeout(`${BITESHIP_BASE_URL}/couriers`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!res.ok) {
      console.error('[Biteship] couriers error:', res.status, await res.text())
      return null
    }

    const json = (await res.json()) as BiteshipCouriersResponse
    const codes = (json.couriers ?? [])
      .map((c) => c.courier_code)
      .filter(Boolean)

    if (codes.length === 0) {
      console.warn('[Biteship] couriers response empty')
      return null
    }

    courierCache.set(apiKey, { codes, fetchedAt: Date.now() })
    return codes
  } catch (err) {
    console.error('[Biteship] getBiteshipCouriers failed:', err)
    return null
  }
}
```

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No errors in `lib/biteship.ts`.

- [ ] **Step 4: Commit**

```bash
git add lib/biteship.ts
git commit -m "feat(biteship): add getBiteshipCouriers with 1h cache"
```

---

## Task 2: Update `lib/shipping.ts` to Use Dynamic Couriers

**Files:**
- Modify: `lib/shipping.ts`

- [ ] **Step 1: Update imports**

Replace the existing import from `@/lib/biteship`:

```typescript
import { getBiteshipLocation, getBiteshipRates, getBiteshipCouriers, type BiteshipLocation, type BiteshipRate } from '@/lib/biteship'
```

- [ ] **Step 2: Replace hardcoded couriers with dynamic fetch + fallback**

Replace the existing comment and `getBiteshipRates` call (lines 120-129):

```typescript
  // 5. Call rates (dynamic couriers with fallback)
  const dynamicCouriers = await getBiteshipCouriers()
  const couriers = dynamicCouriers?.join(',')
    ?? process.env.BITESHIP_COURIERS
    ?? 'jne,tiki,sicepat,anteraja,jnt,ninja'

  const rates = await getBiteshipRates({
    origin_postal_code: origin.postal_code,
    origin_latitude: origin.latitude,
    origin_longitude: origin.longitude,
    destination_postal_code: address.postal_code,
    couriers,
    items: biteshipItems,
  })
```

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No errors in `lib/shipping.ts`.

- [ ] **Step 4: Commit**

```bash
git add lib/shipping.ts
git commit -m "feat(shipping): use dynamic courier fetch with env fallback"
```

---

## Task 3: Update `.env.local.example`

**Files:**
- Modify: `.env.local.example`

- [ ] **Step 1: Update comment for `BITESHIP_COURIERS`**

Replace the Biteship section:

```bash
# Biteship (shipping rates & courier integration)
BITESHIP_API_KEY=
BITESHIP_ORIGIN_LOCATION_ID=
# Optional: override dynamically fetched couriers (fallback if API fails)
# BITESHIP_COURIERS=jne,tiki,sicepat,anteraja,jnt,ninja
```

- [ ] **Step 2: Commit**

```bash
git add .env.local.example
git commit -m "docs(env): mark BITESHIP_COURIERS as optional fallback"
```

---

## Task 4: Final Verification

- [ ] **Step 1: Run full lint**

Run: `npm run lint`
Expected: No errors (only existing warnings).

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Build succeeds with no TypeScript or compilation errors.

- [ ] **Step 3: Final commit (if any uncommitted changes)**

```bash
git add -A
git commit -m "feat(shipping): dynamic Biteship courier fetch with 1h cache" || echo "Nothing to commit"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] `getBiteshipCouriers()` added — Task 1
- [x] Module-level cache with 1h TTL — Task 1
- [x] Graceful fallback on API failure — Task 2
- [x] Fallback to env var — Task 2
- [x] Fallback to hardcoded default — Task 2
- [x] No UI/server-action changes — no tasks needed
- [x] `.env.local.example` updated — Task 3

**Placeholder scan:**
- [x] No "TBD", "TODO", or vague instructions
- [x] All code blocks contain complete, copy-pasteable code
- [x] All commands have expected output specified

**Type consistency:**
- [x] `getBiteshipCouriers` returns `Promise<string[] | null>` in both definition and usage
- [x] `BiteshipCourier` interface matches expected API response shape
- [x] Cache key is `string` (API key), value shape matches usage
