# Environment Variables Management

This document explains how environment variables are managed in this project using **SOPS** (Secrets OPerationS) and **Age** encryption.

---

## Overview

Environment variables are stored as encrypted files in the repository:

| File | Environment | Purpose |
|---|---|---|
| `.sops.env.production` | Production | All production secrets |
| `.sops.yaml` | — | SOPS configuration (Age public key) |

**Git is the single source of truth.** On every deploy, GitHub Actions decrypts these files and syncs the values to Railway. Railway is a runtime mirror — it should not be edited directly.

---

## Prerequisites

Install the required tools:

```bash
brew install sops age
```

Ensure your Age private key is available:

```bash
# Default location
ls ~/.config/sops/age/keys.txt

# Or set explicitly
export SOPS_AGE_KEY_FILE=~/.config/sops/age/keys.txt
```

> **Note:** On macOS with Homebrew, SOPS may not find the key automatically. Always set `SOPS_AGE_KEY_FILE` or `SOPS_AGE_KEY` when working locally.

---

## Viewing Environment Variables

### View decrypted values (stdout)

```bash
sops -d .sops.env.production
```

### View specific key

```bash
sops -d .sops.env.production | grep BITESHIP_API_KEY
```

---

## Changing (Editing) Values

### Edit with your default editor

```bash
sops .sops.env.production
```

This opens the decrypted file in your `$EDITOR`. Save and exit — SOPS automatically re-encrypts.

### Change a specific key inline (no editor)

```bash
sops --set '["BITESHIP_API_KEY"] "biteship_live.eyJ..."' .sops.env.production
```

> ⚠️ **After editing, commit and push.** The next deploy will sync the new values to Railway.

---

## Adding New Environment Variables

### Add to the encrypted file

```bash
sops .sops.env.production
```

Add the new key-value pair anywhere in the file:

```bash
NEW_FEATURE_FLAG=true
ANOTHER_SECRET_KEY=hello-world
```

Save and exit. SOPS encrypts the new values.

### Commit and deploy

```bash
git add .sops.env.production
git commit -m "feat(env): add NEW_FEATURE_FLAG to production"
git push
```

The next deploy will sync the new variable to Railway.

---

## Deleting Environment Variables

### Delete from the encrypted file

```bash
sops .sops.env.production
```

Remove the line, save, and exit.

### Commit and deploy

```bash
git add .sops.env.production
git commit -m "chore(env): remove deprecated TELEGRAM_GROUP_ID"
git push
```

**Important:** Deleting from `.sops.env.*` does **NOT** automatically delete from Railway. The sync script only sets variables — it does not delete missing ones. To clean Railway, run:

```bash
# Dry run first
node scripts/clean-railway-envs.mjs --env production --dry-run

# Actually delete
node scripts/clean-railway-envs.mjs --env production
```

This script removes Railway envs that are managed in git, preserving auto-generated `RAILWAY_*` variables.

---

## Syncing to Railway (Manual)

Sometimes you want to update Railway without deploying (e.g., fixing a broken env):

```bash
# Preview what would change
node scripts/sync-env.mjs --env production --dry-run

# Actually sync
SOPS_AGE_KEY_FILE=~/.config/sops/age/keys.txt node scripts/sync-env.mjs --env production
```

> Requires `RAILWAY_TOKEN` env var or logged-in Railway CLI.

---

## How Deploy Sync Works

`deploy-prod.yml` follows this flow:

1. **Install** `sops` and `age` binaries
2. **Decrypt** `.sops.env.<env>` using `SOPS_AGE_KEY` GitHub secret
3. **Sync** all key-value pairs to Railway via `railway variable set`
4. **Deploy** with `railway up`

**Result:** Railway envs always match the git commit being deployed.

---

## Railway Auto-Generated Envs

These are created by Railway and **must not be deleted or managed in git**:

- `RAILWAY_ENVIRONMENT`
- `RAILWAY_ENVIRONMENT_ID`
- `RAILWAY_PROJECT_ID`
- `RAILWAY_PUBLIC_DOMAIN`
- `RAILWAY_PRIVATE_DOMAIN`
- `RAILWAY_SERVICE_ID`
- `RAILWAY_SERVICE_NAME`
- etc.

The `clean-railway-envs.mjs` script automatically preserves these.

---

## Troubleshooting

### SOPS cannot decrypt: "failed to create reader for decrypting sops data key"

**Cause:** Age private key not found.

**Fix:**
```bash
export SOPS_AGE_KEY_FILE=~/.config/sops/age/keys.txt
```

### Railway sync fails: "Command railway variable set failed"

**Cause:** Railway CLI not authenticated or missing token.

**Fix:**
```bash
# Option 1: Login interactively
railway login

# Option 2: Set token
export RAILWAY_TOKEN=xxx
```

### I accidentally committed plaintext secrets

**Fix immediately:**
1. Rotate the exposed secret (change API key, token, etc.)
2. Use `git filter-repo` or BFG to remove from git history
3. Force push the cleaned branch
4. Re-encrypt with SOPS and commit

---

## Key Management

### Rotate Age keypair (if compromised)

1. Generate new keypair:
   ```bash
   age-keygen -o ~/.config/sops/age/keys.txt.new
   ```

2. Update `.sops.yaml` with new public key

3. Re-encrypt all env files with the new key:
   ```bash
   sops rotate -i .sops.env.production
   ```

4. Update `SOPS_AGE_KEY` GitHub secret with new private key

5. Delete old private key

---

## Summary Cheat Sheet

| Task | Command |
|---|---|
| View production envs | `sops -d .sops.env.production` |
| Edit production envs | `sops .sops.env.production` |
| Change one key | `sops --set '["KEY"] "value"' .sops.env.production` |
| Add new key | `sops .sops.env.production` → add line |
| Delete key | `sops .sops.env.production` → remove line |
| Sync to Railway (preview) | `node scripts/sync-env.mjs --env production --dry-run` |
| Sync to Railway (apply) | `node scripts/sync-env.mjs --env production` |
| Clean Railway (preview) | `node scripts/clean-railway-envs.mjs --env production --dry-run` |
| Clean Railway (apply) | `node scripts/clean-railway-envs.mjs --env production` |

---

## Security Notes

- ✅ `.sops.env.*` files are encrypted and safe to commit
- ✅ Age private key (`keys.txt`) is **never** committed
- ✅ GitHub secret `SOPS_AGE_KEY` is the only place the private key lives outside your machine
- ✅ Temp decrypted files are created in `/tmp` and deleted immediately after sync
- ⚠️ **Backup `~/.config/sops/age/keys.txt` in your password manager.** Losing it means losing access to all encrypted envs.
