# Dynamic Biteship Courier Fetch — Design Spec

**Status:** Approved  
**Date:** 2026-05-03  
**Repo:** `agr-client-portal`  
**Related:** `docs/superpowers/specs/2026-05-01-portal-shipping-cost-design.md`

## Goal

Replace the hardcoded `BITESHIP_COURIERS` env var with a dynamic fetch from Biteship's `GET /v1/couriers` endpoint, cached for 1 hour with graceful fallback to the env var / hardcoded default.

## Motivation

The original shipping-cost design used `couriers: ''` (intending "all enabled couriers"), but Biteship's `/rates/couriers` endpoint requires a comma-separated `couriers` parameter. Commit `29fbeba` attempted to omit the parameter, which caused `40001002` — *"missing parameter(s)"*. A hardcoded env var fixes the error but requires manual updates when couriers are enabled/disabled in the Biteship dashboard. Dynamic fetch keeps the portal in sync automatically.

## Architecture

### Components

| Component | File | Responsibility |
|---|---|---|
| `getBiteshipCouriers()` | `lib/biteship.ts` | Fetches `GET /v1/couriers`, extracts `courier_code`, returns `string[]` |
| Module-level cache | `lib/biteship.ts` | `Map` keyed by `BITESHIP_API_KEY` with 1-hour TTL |
| `loadShippingContext` | `lib/shipping.ts` | Calls `getBiteshipCouriers()`, joins codes with commas, passes to `getBiteshipRates` |
| Fallback logic | `lib/shipping.ts` | Falls back to `BITESHIP_COURIERS` env var if API fails or returns empty |

### Data Flow

```
loadShippingContext (review mount / submit)
  → getBiteshipCouriers()
      → Check module cache (1h TTL)
        → Hit → return cached string[]
        → Miss → GET /v1/couriers
          → Parse response, extract courier_code[]
          → Store in cache with timestamp
          → Return codes
      → (fallback) API fails or empty → return null
  → If codes returned: join(',') and pass to getBiteshipRates
  → If null: use process.env.BITESHIP_COURIERS ?? default
```

### Biteship `/v1/couriers` Response Shape (expected)

```json
{
  "success": true,
  "object": "couriers",
  "couriers": [
    { "courier_code": "jne", "courier_name": "JNE", ... },
    { "courier_code": "tiki", "courier_name": "TIKI", ... }
  ]
}
```

We only need `courier_code` from each entry.

## Types

```typescript
// lib/biteship.ts

interface BiteshipCourier {
  courier_code: string
  courier_name: string
  // ... other fields ignored
}

interface BiteshipCouriersResponse {
  success?: boolean
  couriers?: BiteshipCourier[]
}
```

## Implementation Details

### Cache Design

- **Storage:** Module-level `Map<string, { codes: string[]; fetchedAt: number }>`
- **Key:** `BITESHIP_API_KEY` (so key rotation invalidates cache)
- **TTL:** 1 hour (`3_600_000` ms)
- **Rationale:** Server actions reset per request, so `React.cache` won't help here. A module-level `Map` survives across requests in the same process (V8 isolate). In serverless environments the cache resets on cold start, which is acceptable.

### Error Handling

| Scenario | Behavior |
|---|---|
| Biteship API 4xx/5xx | Log error, return `null`, fallback to env var |
| Network timeout / Abort | Log error, return `null`, fallback to env var |
| Empty `couriers` array | Return `null`, fallback to env var |
| Env var not set | Use hardcoded default (`jne,tiki,sicepat,anteraja,jnt,ninja`) |

### Fallback Chain

```
getBiteshipCouriers() → codes?
  Yes → join(',') → pass to rates API
  No  → process.env.BITESHIP_COURIERS?
          Yes → use it
          No  → use default string
```

## Files to Modify

| File | Action | Description |
|---|---|---|
| `lib/biteship.ts` | Modify | Add `getBiteshipCouriers()` + cache + types |
| `lib/shipping.ts` | Modify | Replace hardcoded `couriers` with dynamic fetch + fallback |
| `.env.local.example` | Modify | Update `BITESHIP_COURIERS` comment to indicate it's now optional (fallback only) |

## Out of Scope

- No UI changes
- No server action signature changes
- No database changes
- No E2E test changes (existing mocks still work because they intercept `/rates/couriers`, not `/couriers`)

## Testing

- Unit: Not applicable (repo has no unit test layer)
- E2E: Existing tests continue to work because `/couriers` is not mocked — the fallback path (env var) will be used during test runs unless we also mock `/couriers`
- Manual: Verify that disabling a courier in Biteship dashboard is reflected in checkout within 1 hour

## Rollback Plan

If dynamic fetch causes issues:
1. Set `BITESHIP_COURIERS` env var to desired list
2. The fallback will immediately take effect on next cache miss or API failure
3. Optionally set cache TTL to `0` to force immediate fallback
