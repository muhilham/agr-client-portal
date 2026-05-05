# Semantic Versioning + Release CI/CD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add release-please automated versioning and Railway production deployment triggered by semver git tags.

**Architecture:** Four new files only — two GitHub Actions workflows and two release-please config files. No existing files are modified. On every push to `main`, release-please opens/updates a Release PR. Merging that PR bumps `package.json`, appends `CHANGELOG.md`, and pushes a `v*.*.*` tag which triggers Railway deployment.

**Tech Stack:** GitHub Actions, googleapis/release-please-action@v4, Railway CLI, npm, Node 20

---

### Task 1: Create release-please config files

**Files:**
- Create: `release-please-config.json`
- Create: `.release-please-manifest.json`

- [ ] **Step 1: Create `release-please-config.json`**

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "release-type": "node",
  "include-component-in-tag": false,
  "include-v-in-tag": true,
  "bump-minor-pre-major": false,
  "bump-patch-for-minor-pre-major": false,
  "packages": {
    ".": {
      "package-name": "agr-client-portal",
      "changelog-sections": [
        { "type": "feat", "section": "Features" },
        { "type": "fix", "section": "Bug Fixes" },
        { "type": "perf", "section": "Performance" },
        { "type": "refactor", "section": "Refactors" },
        { "type": "test", "section": "Tests" },
        { "type": "docs", "section": "Documentation" },
        { "type": "chore", "hidden": true }
      ]
    }
  }
}
```

- [ ] **Step 2: Create `.release-please-manifest.json`**

```json
{
  ".": "0.1.0"
}
```

This pins the starting version to match `package.json`. release-please will update this file on each release.

- [ ] **Step 3: Validate JSON syntax**

```bash
node -e "JSON.parse(require('fs').readFileSync('release-please-config.json','utf8')); console.log('config OK')"
node -e "JSON.parse(require('fs').readFileSync('.release-please-manifest.json','utf8')); console.log('manifest OK')"
```

Expected output:
```
config OK
manifest OK
```

- [ ] **Step 4: Commit**

```bash
git add release-please-config.json .release-please-manifest.json
git commit -m "chore(config): add release-please config and manifest"
```

---

### Task 2: Create release-please workflow

**Files:**
- Create: `.github/workflows/release-please.yml`

- [ ] **Step 1: Create `.github/workflows/` directory and workflow file**

```bash
mkdir -p .github/workflows
```

File content for `.github/workflows/release-please.yml`:

```yaml
name: release-please

on:
  push:
    branches:
      - main

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - uses: googleapis/release-please-action@v4
        with:
          token: ${{ secrets.RELEASE_PLEASE_TOKEN }}
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json
```

- [ ] **Step 2: Validate YAML syntax**

```bash
node -e "
const fs = require('fs');
const content = fs.readFileSync('.github/workflows/release-please.yml', 'utf8');
// Basic checks
if (!content.includes('googleapis/release-please-action@v4')) throw new Error('action missing');
if (!content.includes('RELEASE_PLEASE_TOKEN')) throw new Error('secret missing');
if (!content.includes('release-please-config.json')) throw new Error('config-file missing');
console.log('release-please.yml OK');
"
```

Expected output:
```
release-please.yml OK
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release-please.yml
git commit -m "chore(config): add release-please GitHub Actions workflow"
```

---

### Task 3: Create deploy-prod workflow

**Files:**
- Create: `.github/workflows/deploy-prod.yml`

- [ ] **Step 1: Create `.github/workflows/deploy-prod.yml`**

```yaml
name: deploy-prod

on:
  push:
    tags:
      - 'v*.*.*'
  workflow_dispatch:
    inputs:
      ref:
        description: 'Tag to deploy (e.g. v1.0.0). Used for rollback re-deploys.'
        required: true
        type: string

jobs:
  validate-tag:
    runs-on: ubuntu-latest
    steps:
      - name: Validate tag format
        run: |
          REF="${{ github.event.inputs.ref || github.ref_name }}"
          if [[ ! "$REF" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo "Invalid tag format: $REF (must match v[0-9]+.[0-9]+.[0-9]+)"
            exit 1
          fi
          echo "Tag format valid: $REF"

  deploy:
    needs: validate-tag
    runs-on: ubuntu-latest
    environment: production
    timeout-minutes: 15
    steps:
      - name: Checkout tag
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.inputs.ref || github.ref }}

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Railway CLI
        run: npm install -g @railway/cli

      - name: Deploy to production
        run: railway up --service agr-client-portal --environment production
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

Note: uses `npm ci` (not pnpm) — agr-client-portal uses npm (has `package-lock.json`).

- [ ] **Step 2: Validate YAML content**

```bash
node -e "
const fs = require('fs');
const content = fs.readFileSync('.github/workflows/deploy-prod.yml', 'utf8');
if (!content.includes('agr-client-portal')) throw new Error('service name missing');
if (!content.includes('RAILWAY_TOKEN')) throw new Error('RAILWAY_TOKEN missing');
if (!content.includes('npm ci')) throw new Error('npm ci missing');
if (!content.includes('validate-tag')) throw new Error('validate-tag job missing');
if (!content.includes('workflow_dispatch')) throw new Error('rollback input missing');
console.log('deploy-prod.yml OK');
"
```

Expected output:
```
deploy-prod.yml OK
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy-prod.yml
git commit -m "chore(config): add deploy-prod GitHub Actions workflow"
```

---

### Task 4: Verify GitHub secrets are configured

This task is **manual** — GitHub secrets cannot be set via git. Do this in the GitHub UI or via `gh` CLI before merging to main.

- [ ] **Step 1: Check existing secrets**

```bash
gh secret list --repo muhilham/agr-client-portal
```

Expected: see `RELEASE_PLEASE_TOKEN` and `RAILWAY_TOKEN` listed. If missing, proceed to next steps.

- [ ] **Step 2: Set `RELEASE_PLEASE_TOKEN` if missing**

The token needs scopes: `contents:write` and `pull-requests:write`. Reuse the same PAT from agroastery-web if it has those scopes.

```bash
gh secret set RELEASE_PLEASE_TOKEN --repo muhilham/agr-client-portal
# Paste the token value when prompted
```

- [ ] **Step 3: Set `RAILWAY_TOKEN` if missing**

Get the Railway project token from the Railway dashboard → Project → Settings → Tokens.

```bash
gh secret set RAILWAY_TOKEN --repo muhilham/agr-client-portal
# Paste the token value when prompted
```

- [ ] **Step 4: Verify both secrets exist**

```bash
gh secret list --repo muhilham/agr-client-portal
```

Expected output includes:
```
RELEASE_PLEASE_TOKEN  ...
RAILWAY_TOKEN         ...
```

- [ ] **Step 5: Commit nothing** — secrets are stored in GitHub, not in git.

---

### Task 5: Smoke test the release flow

Verify end-to-end after pushing to main.

- [ ] **Step 1: Push all commits to main**

```bash
git push origin main
```

- [ ] **Step 2: Verify release-please workflow runs**

```bash
gh run list --repo muhilham/agr-client-portal --workflow release-please.yml --limit 3
```

Expected: first run shows `completed` / `success`. If `failure`, check logs:
```bash
gh run view --repo muhilham/agr-client-portal <run-id> --log-failed
```

Common failure: `RELEASE_PLEASE_TOKEN` missing or wrong scopes — verify Task 4.

- [ ] **Step 3: Check if Release PR was opened**

```bash
gh pr list --repo muhilham/agr-client-portal --label "autorelease: pending"
```

If no commits that trigger a release (feat/fix) have landed since v0.1.0, no PR appears yet — that is expected. Make one `fix:` commit and push to trigger it:

```bash
git commit --allow-empty -m "fix(config): trigger initial release-please PR"
git push origin main
```

- [ ] **Step 4: Merge the Release PR and watch deploy**

Once release-please opens a PR, merge it via GitHub UI or:
```bash
gh pr merge --repo muhilham/agr-client-portal --squash <pr-number>
```

After merge, release-please pushes a `v0.1.1` tag (or appropriate bump). Watch deploy trigger:

```bash
gh run list --repo muhilham/agr-client-portal --workflow deploy-prod.yml --limit 3
```

Expected: run appears and completes successfully with Railway deploy output.
