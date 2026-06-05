/**
 * Windows build helper — stops SHKF, picks a writable output dir, runs electron-builder.
 * Usage: node scripts/electron-build.js [nsis|portable|all]
 */
import { spawnSync, execSync } from 'child_process';
import { existsSync, rmSync, renameSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout as delay } from 'timers/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const target = process.argv[2] || 'nsis';

const OUTPUT_CANDIDATES = ['release', 'out'];

function log(msg) {
  console.log('[build]', msg);
}

function stopProcesses() {
  if (process.platform !== 'win32') return;
  const cmds = [
    'taskkill /F /IM SHKF.exe /T 2>nul',
    'powershell -NoProfile -Command "Get-Process -Name SHKF -ErrorAction SilentlyContinue | Stop-Process -Force"',
    'powershell -NoProfile -Command "Get-Process -Name electron -ErrorAction SilentlyContinue | Where-Object { $_.Path -match \'figma-hotkeys|SHKF|\\\\out\\\\|\\\\release\\\\|\\\\release-build\' } | Stop-Process -Force"',
  ];
  for (const cmd of cmds) {
    try {
      execSync(cmd, { stdio: 'ignore', windowsHide: true });
    } catch {
      /* not running */
    }
  }
}

async function tryRemoveDir(dir) {
  if (!existsSync(dir)) return true;

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
      return true;
    } catch {
      await delay(500 * attempt);
      if (attempt === 2) stopProcesses();
    }
  }

  try {
    const parent = path.dirname(dir);
    const stale = path.join(parent, `${path.basename(dir)}-old-${Date.now()}`);
    renameSync(dir, stale);
    log(`Renamed locked ${path.basename(dir)} → ${path.basename(stale)}`);
    return true;
  } catch {
    return false;
  }
}

async function pickOutputDir() {
  stopProcesses();
  await delay(1000);

  for (const name of OUTPUT_CANDIDATES) {
    const outRoot = path.join(root, name);
    const winUnpacked = path.join(outRoot, 'win-unpacked');
    mkdirSync(outRoot, { recursive: true });
    const ok = await tryRemoveDir(winUnpacked);
    if (ok) {
      log(`Output folder: ${name}/`);
      return name;
    }
    log(`Folder ${name}/ is locked, trying next…`);
  }

  const fallback = `release-build-${Date.now()}`;
  log(`Using fallback: ${fallback}/`);
  return fallback;
}

function runElectronBuilder(outputDir, winTarget) {
  const args = ['electron-builder', '--win', winTarget, `-c.directories.output=${outputDir}`];
  log(`Running: npx ${args.join(' ')}`);

  const result = spawnSync('npx', args, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function main() {
  const valid = ['nsis', 'portable', 'all'];
  if (!valid.includes(target)) {
    console.error(`Unknown target "${target}". Use: nsis | portable | all`);
    process.exit(1);
  }

  const outputDir = await pickOutputDir();

  if (target === 'all') {
    runElectronBuilder(outputDir, 'nsis');
    runElectronBuilder(outputDir, 'portable');
  } else {
    runElectronBuilder(outputDir, target);
  }

  log('Done!');
  log(`Check: ${outputDir}/`);
  if (target === 'nsis' || target === 'all') {
    log('  Installer → SHKF-Setup-*.exe');
  }
  if (target === 'portable' || target === 'all') {
    log('  Portable  → SHKF-*-portable.exe');
  }
}

main().catch((err) => {
  console.error('[build] Failed:', err.message);
  process.exit(1);
});
