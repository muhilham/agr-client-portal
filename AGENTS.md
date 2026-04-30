# AGENTS.md

## Dev Commands
```bash
npm run dev      # Start dev server on localhost:3000
npm run build    # Production build
npm run lint     # ESLint (no typecheck script)
npm run test:e2e            # Playwright tests (requires .env.e2e)
npm run test:e2e:ui         # Playwright with UI mode
npm run test:e2e:debug      # Playwright debug mode
```

## Key Patterns

### Supabase
**🚫 MIGRATIONS: Never run migrations from this repo. All migrations must be executed from `/Users/muhammadilham/Documents/GitHub/agr-ops` only. The `supabase/migrations/` folder here is read-only reference.**

- Server actions in `app/portal/order/_actions/` use `createClient()` (server-side) — correct because RLS INSERT policies handle auth
- Never use anon client to SELECT from RLS tables — use `getSupabaseAdmin()` (service role key)
- Order numbers: always use `supabase.rpc('generate_order_number')` — never `COUNT(*) + 1`

### Prices
- Re-validate ALL prices server-side on order submission — never trust client-submitted prices
- Cart lives in React state only — no localStorage

### Dates
- All timestamps: Asia/Jakarta (WIB, UTC+7)
- Never use `toLocaleDateString()` without explicit `'id-ID'` locale and `'Asia/Jakarta'` timezone

### UI Constraints
- No `framer-motion`, `moment.js`, or full `lodash` imports
- All input font-size >= 16px (prevents iOS Safari zoom)
- Always use `next/image` for product images — never `<img>`

### React Compiler
- `babel-plugin-react-compiler` is enabled in devDependencies
- Next.js config has `reactCompiler: true`
- Avoid manual memoization unless compiler can't optimize

## E2E Tests
- Playwright config at `playwright.config.ts`
- Auth sessions saved in `e2e/.auth/` (gitignored)
- Test order: `auth-setup` runs first, then `portal`, then `auth` tests
- Tests require `.env.e2e` with test database credentials

## Deployment
- Build: `nixpacks.toml` (Railway)
- Start: `Procfile` → `npm run start`
- Required env vars: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ORDER_GROUP_ID`, `NEXT_PUBLIC_SITE_URL`

## Related Docs
- Full architecture: `DOCS.md`
- Detailed PR review rules: `.claude/skills/pr-review/SKILL.md`
- Commit conventions: `CLAUDE.md`
