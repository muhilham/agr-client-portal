# Semantic Versioning + Release CI/CD Design

**Date:** 2026-05-05
**Status:** Approved

## Goal

Add automated semantic versioning and Railway deployment to agr-client-portal, mirroring the setup in agroastery-web.

## Architecture

```
push to main
  └─► release-please.yml
        └─► opens/updates Release PR (bumps package.json + CHANGELOG.md)
merge Release PR
  └─► release-please pushes v*.*.*  tag
        └─► deploy-prod.yml triggers
              └─► validate tag format (v[0-9]+.[0-9]+.[0-9]+)
              └─► railway up --service agr-client-portal --environment production
```

Manual rollback: trigger `deploy-prod.yml` via `workflow_dispatch` with a prior tag as input.

## Files

### `.github/workflows/release-please.yml`

Triggers on push to `main`. Runs `googleapis/release-please-action@v4` using project config and manifest files.

Secrets required: `RELEASE_PLEASE_TOKEN` (GitHub PAT with `contents:write` + `pull-requests:write`).

### `.github/workflows/deploy-prod.yml`

Triggers on `v*.*.*` tag push and `workflow_dispatch` (rollback).

Steps:
1. Validate tag format — reject anything not matching `v[0-9]+.[0-9]+.[0-9]+`
2. Checkout tag
3. Setup pnpm v10 + Node 20
4. `pnpm install --frozen-lockfile`
5. Install Railway CLI
6. `railway up --service agr-client-portal --environment production`

Secrets required: `RAILWAY_TOKEN`.

### `release-please-config.json`

- `release-type: "node"`
- `package-name: "agr-client-portal"`
- `include-v-in-tag: true`
- `include-component-in-tag: false`
- Changelog sections: feat → Features, fix → Bug Fixes, perf → Performance, refactor → Refactors, test → Tests, docs → Documentation, chore → hidden

### `.release-please-manifest.json`

```json
{ ".": "0.1.0" }
```

Tracks current version. release-please updates this on each release.

## Version Bump Rules

Driven by conventional commit prefixes (already mandated in CLAUDE.md):

| Commit prefix | Version bump |
|--------------|-------------|
| `fix:` | patch (0.1.0 → 0.1.1) |
| `feat:` | minor (0.1.0 → 0.2.0) |
| `feat!:` or `BREAKING CHANGE:` | major (0.1.0 → 1.0.0) |
| `chore:`, `test:`, `docs:` | no release PR created |

## Secrets Setup

Must exist in GitHub repo settings (`muhilham/agr-client-portal`) before first workflow run:

| Secret | Value |
|--------|-------|
| `RELEASE_PLEASE_TOKEN` | GitHub PAT — same token as agroastery-web can be reused |
| `RAILWAY_TOKEN` | Railway project token for agr-client-portal |

## Rollback Procedure

1. Go to Actions → `deploy-prod` → Run workflow
2. Enter the prior tag (e.g., `v0.1.0`)
3. Workflow validates format, checks out that tag, redeploys

## Out of Scope

- Preview/staging deployments
- PR-level CI (lint, type-check, tests) — separate concern
- Monorepo component tagging
