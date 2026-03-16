# Agroastery Retainer Client Ordering Platform

## Documentation
- PRD: https://www.notion.so/31a5b1a36fe1812ba5dad2b547299500
- Admin Dashboard Tech Doc: https://www.notion.so/31c5b1a36fe181f3bbb7e6c6f32c9efd
- Client Portal Tech Doc: https://www.notion.so/31c5b1a36fe1811c87bef2ed7097549c
- Decisions Log: https://www.notion.so/31b5b1a36fe1816d8c3cf1ccd7867996
- Brand Colors: https://www.notion.so/31c5b1a36fe181d2874ceaf286de1e75
- Performance Spec: https://www.notion.so/31c5b1a36fe181d4b6b1d0bff44f839c
- FigJam Flow: https://www.figma.com/board/7wuulFK2WrFumJi8LfPijY/

## Tech Stack
- Next.js 14+ App Router
- Supabase (PostgreSQL + Auth + RLS)
- TailwindCSS — brand tokens in tailwind.config.ts
- Cloudflare R2 for product images
- Telegram bot for order notifications

## Key Rules
- Server actions use service role key, never anon key
- All prices re-validated server-side on order submission — never trust client
- Order number generated via generate_order_number() DB function — never COUNT(*)+1
- No localStorage anywhere — cart lives in React state only
- All timestamps in Asia/Jakarta (WIB, UTC+7)
- No framer-motion, no moment.js, no full lodash imports
- All input font-size >= 16px (prevents iOS Safari zoom)
- next/image for ALL product images, never <img>

## Commit Message Convention

Use conventional commits format:
feat(scope): short description
fix(scope): short description
chore(scope): short description
test(scope): short description
refactor(scope): short description

Scopes: clients, products, pricing, orders, notifications,
portal, auth, db, tests, config

Examples:
feat(clients): add transfer order history on deactivation
fix(products): use getSupabaseAdmin for RLS-enabled query
test(pricing): add E2E tests for assign and remove product
chore(db): write migration files to supabase/migrations/
refactor(clients): extract ClientsSection into client component

Rules:
- Max 72 characters in the subject line
- Use imperative mood ("add" not "added")
- Reference the route or feature in scope
- No period at the end