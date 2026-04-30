# Supabase Migrations - READ ONLY

## ⚠️ CRITICAL WARNING

**NO MIGRATIONS CAN BE RUN FROM THIS REPOSITORY.**

This directory (`supabase/migrations/`) exists for **reference only**. The migration files here are copies of migrations that exist in the main agr-ops repository.

## Incident Log

### 2025-04-30 - Unauthorized Migrations Removed

**Issue**: Migration files `005_client_portal_rls.sql` and `006_auto_create_auth_user_on_client.sql` were created in this repository, violating the source-of-truth policy.

**Problems with 006_auto_create_auth_user_on_client.sql**:
1. Direct INSERT into auth.users bypasses Supabase's Auth API
2. Google OAuth won't link to pre-created rows (missing auth.identities entry)
3. Empty password + confirmed_at allows password-reset hijacking of whitelisted clients
4. Race condition in IF NOT EXISTS check

**Resolution**: Files removed. If these policies/triggers are needed, they must be:
- Authored in `/Users/muhammadilham/Documents/GitHub/agr-ops/supabase/migrations/`
- Use proper Supabase Admin API (auth.admin.createUser or inviteUserByEmail)
- Never use direct SQL INSERT into auth.users

## Where Migrations Actually Run

All database migrations must be executed from:
```
/Users/muhammadilham/Documents/GitHub/agr-ops
```

## Why This Constraint Exists

1. **Single source of truth**: The agr-ops repository is the authoritative source for all database schema changes
2. **Migration ordering**: Running migrations from multiple sources would create conflicts and ordering issues
3. **Safety**: Prevents accidental schema changes from the client portal

## What These Files Are For

The migration files in this directory serve as:
- Documentation of the current schema state
- Reference for developers writing queries
- Context for understanding RLS policies

## If You Need to Add/Change Migrations

1. Go to `/Users/muhammadilham/Documents/GitHub/agr-ops`
2. Create/edit migrations there
3. Run `supabase db push` or `supabase migration up` from the agr-ops directory only
4. Copy the new migration files here for reference (optional, but recommended for documentation)

## Technical Safeguard

This repository intentionally does NOT contain a `config.toml` file, which is required for the Supabase CLI to execute migrations. Without this file, commands like `supabase db push` or `supabase migration up` will fail.

**DO NOT create a config.toml in this repository.**
