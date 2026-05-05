#!/usr/bin/env node

import { spawn } from 'child_process';
import { mkdtemp, writeFile, unlink, rmdir, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const ALLOWED_ENVS = ['production', 'staging'];

function parseArgs() {
  const args = process.argv.slice(2);
  const envIndex = args.indexOf('--env');
  const env = envIndex !== -1 ? args[envIndex + 1] : null;
  const dryRun = args.includes('--dry-run');

  if (!env || !ALLOWED_ENVS.includes(env)) {
    console.error('Usage: node scripts/sync-env.mjs --env <production|staging> [--dry-run]');
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

function parseEnvFile(content) {
  const vars = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key) {
      vars[key] = value;
    }
  }
  return vars;
}

async function syncToRailway(env, vars, dryRun) {
  const entries = Object.entries(vars);
  if (entries.length === 0) {
    console.log('No variables to sync.');
    return;
  }

  const args = entries.map(([k, v]) => `${k}=${v}`);

  if (dryRun) {
    console.log(`[DRY RUN] Would set ${entries.length} variable(s) in Railway ${env}:`);
    for (const [k, v] of entries) {
      const display = v.length > 40 ? v.slice(0, 40) + '...' : v;
      console.log(`  ${k}=${display}`);
    }
    return;
  }

  console.log(`Syncing ${entries.length} variable(s) to Railway ${env}...`);
  await exec('railway', [
    'variable', 'set',
    '--service', 'agr-client-portal',
    '--environment', env,
    ...args,
  ]);
  console.log('Done.');
}

async function main() {
  const { env, dryRun } = parseArgs();
  let tmpFile = null;
  let tmpDir = null;

  try {
    console.log(`Decrypting .sops.env.${env}...`);
    const { tmpFile: tf, tmpDir: td } = await decryptEnvFile(env);
    tmpFile = tf;
    tmpDir = td;

    const content = await readFile(tmpFile, 'utf-8');
    const vars = parseEnvFile(content);

    await syncToRailway(env, vars, dryRun);
  } finally {
    if (tmpFile) await unlink(tmpFile).catch(() => {});
    if (tmpDir) await rmdir(tmpDir).catch(() => {});
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
