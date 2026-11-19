import { build } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fork } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

async function main() {
  console.log("Compiling Phase 5 Launch Readiness Test Suite with Vite...");
  await build({
    root: rootDir,
    build: {
      outDir: resolve(rootDir, 'dist/test'),
      emptyOutDir: false,
      lib: {
        entry: resolve(rootDir, 'scripts/validate-phase5-readiness.ts'),
        formats: ['es'],
        fileName: () => 'test-phase5-readiness-bundle.js',
      },
      rollupOptions: {
        external: ['node:perf_hooks', 'node:child_process', 'node:fs', 'node:path', 'node:assert'],
      },
    },
  });

  const bundlePath = resolve(rootDir, 'dist/test/test-phase5-readiness-bundle.js');
  console.log("Executing Phase 5 Launch Readiness Test Runner...\n");
  const child = fork(bundlePath);
  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
