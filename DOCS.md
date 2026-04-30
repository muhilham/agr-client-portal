# AGR Client Portal — Technical Overview

This document provides a high-level technical summary of the AGR Client Portal codebase for future AI agents and developers.

## 🏗️ Core Architecture

*   **Framework:** [Next.js 16 (App Router)](https://nextjs.org/docs) with [React 19](https://react.dev).
*   **Language:** TypeScript.
*   **Styling:** Tailwind CSS 4.
*   **Backend & Auth:** [Supabase](https://supabase.com) (PostgreSQL, Auth, SSR).
*   **State Management:** Server-side fetching with standard React hooks for client-side interactivity.

## 🔐 Authentication & Security

The application uses a "Whitelist-based" authentication flow:

1.  **Middleware (`lib/supabase/middleware.ts`):** Protects all `/portal/**` routes. If no session is found, it redirects to the root (`/`).
2.  **Callback Route (`app/auth/callback/route.ts`):** After Supabase Auth (OAuth/Magic Link), this route validates the user's email against the `clients` table.
    *   If the email is missing or `is_active` is false, the user is redirected to `/auth/unauthorized`.
3.  **RLS (Row-Level Security):** Defined in `supabase/migrations/`, ensuring that clients can only read/write their own orders and profile data based on their `auth.jwt()`.

## 📦 Data & Business Logic

### 1. Catalog System (`lib/catalog.ts`)
The product catalog is dynamically generated per client:
*   **Global Products:** Products marked `is_global = true` are available to everyone at their `base_price`.
*   **Client Overrides:** The `client_products` table allows for custom pricing or minimum order quantities (`min_qty`) for specific clients, overriding global defaults.

### 2. Order Processing (`app/portal/order/_actions/createOrder.ts`)
Orders are handled via Next.js Server Actions:
*   **Validation:** Prices are re-validated server-side (using `getCatalogForClient`) to prevent client-side tampering.
*   **Order Numbers:** Generated via a database RPC `generate_order_number`.
*   **Notifications:** After a successful database commit, a Telegram notification is sent via `lib/telegram.ts`.

## 📂 Key Directory Structure

```text
├── app/
│   ├── auth/           # Auth callbacks and unauthorized pages
│   ├── portal/         # Main application logic (Authenticated)
│   │   ├── order/      # Checkout and order creation (Server Actions)
│   │   └── orders/     # Order history and details
│   └── layout.tsx      # Root layout (Providers, Global CSS)
├── lib/
│   ├── supabase/       # Supabase client/server/middleware config
│   ├── catalog.ts      # Catalog merging logic (Global + Client)
│   └── telegram.ts     # Telegram Bot API integration
├── components/         # Shared UI components
├── e2e/                # Playwright end-to-end tests
└── supabase/
    └── migrations/     # Database schema and RLS policies
```

## 🚀 Deployment & Infrastructure

*   **Build System:** Nixpacks (configured in `nixpacks.toml`).
*   **Process Management:** `Procfile` for production execution.
*   **Environment Variables:**
    *   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase connection.
    *   `TELEGRAM_BOT_TOKEN` / `TELEGRAM_ORDER_GROUP_ID`: Notification routing.
    *   `NEXT_PUBLIC_SITE_URL`: Base URL for auth redirects.

## 🧪 Testing

End-to-end tests are located in `e2e/` and use **Playwright**.
*   Tests cover: Login flow, unauthorized access, and portal navigation.
*   Configuration: `playwright.config.ts`.
