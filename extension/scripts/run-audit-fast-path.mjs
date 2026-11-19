import { build } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fork } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

async function main() {
  await build({
    root: rootDir,
    build: {
      outDir: resolve(rootDir, 'dist/test'),
      emptyOutDir: false,
      lib: {
        entry: resolve(rootDir, 'scripts/audit-fast-path-extraction.ts'),
        formats: ['es'],
        fileName: () => 'audit-fast-path-bundle.js',
      },
      rollupOptions: {
        external: ['node:perf_hooks', 'node:child_process', 'node:fs', 'node:path', 'node:assert'],
      },
    },
  });

  const bundlePath = resolve(rootDir, 'dist/test/audit-fast-path-bundle.js');
  const child = fork(bundlePath);
  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
