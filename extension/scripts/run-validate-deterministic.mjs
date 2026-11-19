import { build } from 'vite';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'dist/test');

async function main() {
  console.log('Compiling deterministic mode validation suite with Vite...');
  fs.mkdirSync(outDir, { recursive: true });

  await build({
    root: rootDir,
    publicDir: false,
    build: {
      outDir,
      emptyOutDir: false,
      lib: {
        entry: path.resolve(rootDir, 'scripts/validate-deterministic-mode.ts'),
        formats: ['es'],
        fileName: () => 'validate-deterministic-bundle.js',
      },
      rollupOptions: {
        external: ['node:assert', 'assert'],
        output: {
          inlineDynamicImports: true,
        },
      },
      minify: false,
    },
  });

  const bundlePath = path.join(outDir, 'validate-deterministic-bundle.js');
  console.log(`\nExecuting runner: ${bundlePath}\n`);

  const res = spawnSync('node', [bundlePath], { stdio: 'inherit' });
  if (res.status !== 0) {
    process.exit(res.status || 1);
  }
}

main().catch((err) => {
  console.error('Test compilation failed:', err);
  process.exit(1);
});
