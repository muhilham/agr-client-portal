#!/usr/bin/env node

/**
 * clean-railway-envs.mjs
 *
 * Deletes Railway env vars that are managed by git (via .sops.env.* files).
 * Preserves Railway auto-generated envs (RAILWAY_*).
 *
 * Usage:
 *   node scripts/clean-railway-envs.mjs --env production [--dry-run]
 *   SOPS_AGE_KEY_FILE=~/.config/sops/age/keys.txt node scripts/clean-railway-envs.mjs --env production --dry-run
 */

import { spawn } from 'child_process';
import { mkdtemp, writeFile, unlink, rmdir, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const ALLOWED_ENVS = ['production'];

// Railway auto-generated envs that must NEVER be deleted
const RAILWAY_PREFIXES = [
  'RAILWAY_',
];

function parseArgs() {
  const args = process.argv.slice(2);
  const envIndex = args.indexOf('--env');
  const env = envIndex !== -1 ? args[envIndex + 1] : null;
  const dryRun = args.includes('--dry-run');

  if (!env || !ALLOWED_ENVS.includes(env)) {
    console.error('Usage: node scripts/clean-railway-envs.mjs --env production [--dry-run]');
    process.exit(1);
  }

  return { env, dryRun };
}

function exec(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command "${command} ${args.join(' ')}" failed with code ${code}:\n${stderr || stdout}`));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

async function decryptEnvFile(env) {
  const inputFile = `.sops.env.${env}`;
  const tmpDir = await mkdtemp(join(tmpdir(), 'sops-env-'));
  const tmpFile = join(tmpDir, 'decrypted.env');

  try {
    const decrypted = await exec('sops', ['-d', inputFile]);
    await writeFile(tmpFile, decrypted);
    return { tmpFile, tmpDir };
  } catch (err) {
    await rmdir(tmpDir).catch(() => {});
    throw err;
  }
}

function parseEnvFileKeys(content) {
  const keys = new Set();
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    if (key) {
      keys.add(key);
    }
  }
  return keys;
}

async function getRailwayVars(env) {
  const output = await exec('railway', [
    'variable', 'list',
    '--service', 'agr-client-portal',
    '--environment', env,
    '--json',
  ]);
  const vars = JSON.parse(output);
  return new Set(Object.keys(vars));
}

function isGitManaged(key, gitKeys) {
  return gitKeys.has(key);
}

function isRailwayProtected(key) {
  return RAILWAY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

async function deleteRailwayVars(env, keys, dryRun) {
  if (keys.length === 0) {
    console.log('No variables to delete.');
    return;
  }

  if (dryRun) {
    console.log(`[DRY RUN] Would delete ${keys.length} variable(s) from Railway ${env}:`);
    for (const key of keys) {
      console.log(`  - ${key}`);
    }
    return;
  }

  console.log(`Deleting ${keys.length} variable(s) from Railway ${env}...`);
  for (const key of keys) {
    await exec('railway', [
      'variable', 'delete',
      '--service', 'agr-client-portal',
      '--environment', env,
      key,
    ]);
    console.log(`  ✓ Deleted ${key}`);
  }
  console.log('Done.');
}

async function main() {
  const { env, dryRun } = parseArgs();
  let tmpFile = null;
  let tmpDir = null;

  try {
    console.log(`Reading .sops.env.${env}...`);
    const { tmpFile: tf, tmpDir: td } = await decryptEnvFile(env);
    tmpFile = tf;
    tmpDir = td;

    const content = await readFile(tmpFile, 'utf-8');
    const gitKeys = parseEnvFileKeys(content);
    console.log(`Found ${gitKeys.size} git-managed env keys.`);

    console.log(`Fetching current Railway ${env} variables...`);
    const railwayKeys = await getRailwayVars(env);
    console.log(`Found ${railwayKeys.size} Railway env keys.`);

    // Find keys to delete: in Railway AND git-managed AND not Railway-protected
    const toDelete = [];
    const skippedProtected = [];
    const skippedNotInGit = [];

    for (const key of railwayKeys) {
      if (isRailwayProtected(key)) {
        skippedProtected.push(key);
      } else if (isGitManaged(key, gitKeys)) {
        toDelete.push(key);
      } else {
        skippedNotInGit.push(key);
      }
    }

    console.log(`\nSummary:`);
    console.log(`  To delete (git-managed): ${toDelete.length}`);
    console.log(`  Skipped (Railway auto): ${skippedProtected.length}`);
    console.log(`  Skipped (not in git): ${skippedNotInGit.length}`);

    if (skippedNotInGit.length > 0) {
      console.log(`\n⚠️  These Railway envs are NOT in git — they may be lost on next deploy:`);
      for (const key of skippedNotInGit) {
        console.log(`    - ${key}`);
      }
    }

    await deleteRailwayVars(env, toDelete, dryRun);
  } finally {
    if (tmpFile) await unlink(tmpFile).catch(() => {});
    if (tmpDir) await rmdir(tmpDir).catch(() => {});
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
