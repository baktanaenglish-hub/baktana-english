// Runs `npm --prefix server <args>` only when server/package.json exists, so root scripts work
// before (and after) the backend package is added. Exits with npm's exit code.
//
//   node tools/if-server.mjs test
//   node tools/if-server.mjs run typecheck --if-present
//   node tools/if-server.mjs install   (skipped when SKIP_SERVER_INSTALL=1, e.g. in Docker/CI)
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = join(root, 'server');
const args = process.argv.slice(2);

if (!existsSync(join(serverDir, 'package.json'))) {
  console.log(`[if-server] server/package.json not found – skipping "npm ${args.join(' ')}"`);
  process.exit(0);
}
if (args[0] === 'install' && process.env.SKIP_SERVER_INSTALL === '1') {
  console.log('[if-server] SKIP_SERVER_INSTALL=1 – skipping server install');
  process.exit(0);
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npm, ['--prefix', serverDir, ...args], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
