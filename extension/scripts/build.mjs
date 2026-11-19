import { build } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

const isWatch = process.argv.includes('--watch');

async function copyStaticAssets() {
  // Ensure dist directories exist
  fs.mkdirSync(distDir, { recursive: true });
  fs.mkdirSync(path.join(distDir, 'icons'), { recursive: true });

  // 1. Copy manifest.json
  const manifestSrc = path.join(rootDir, 'public/manifest.json');
  const manifestDest = path.join(distDir, 'manifest.json');
  if (fs.existsSync(manifestSrc)) {
    fs.copyFileSync(manifestSrc, manifestDest);
    console.log('✓ Copied manifest.json');
  }

  // 2. Copy icons
  const iconsSrcDir = path.join(rootDir, 'public/icons');
  if (fs.existsSync(iconsSrcDir)) {
    for (const file of fs.readdirSync(iconsSrcDir)) {
      fs.copyFileSync(path.join(iconsSrcDir, file), path.join(distDir, 'icons', file));
    }
    console.log('✓ Copied extension icons');
  }
}

async function runBuild() {
  console.log(`\n📦 Building Browsy Extension (Manifest V3)...`);
  const startTime = Date.now();

  // Clear dist if not watching
  if (!isWatch && fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }

  // 1. Build Content Script (IIFE - completely self-contained)
  console.log('\n[1/3] Bundling Content Script (Shadow DOM & React UI)...');
  await build({
    root: rootDir,
    publicDir: false,
    plugins: [react()],
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    build: {
      outDir: path.join(distDir, 'content'),
      emptyOutDir: false,
      watch: isWatch ? {} : null,
      lib: {
        entry: path.resolve(rootDir, 'src/content/content-script.tsx'),
        name: 'BrowsyContentScript',
        formats: ['iife'],
        fileName: () => 'content-script.js',
      },
      rollupOptions: {
        output: {
          extend: true,
          inlineDynamicImports: true,
        },
      },
      sourcemap: isWatch,
      minify: !isWatch,
    },
  });

  // 2. Build Background Service Worker (ES module)
  console.log('\n[2/3] Bundling Background Service Worker...');
  await build({
    root: rootDir,
    publicDir: false,
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    build: {
      outDir: path.join(distDir, 'background'),
      emptyOutDir: false,
      watch: isWatch ? {} : null,
      lib: {
        entry: path.resolve(rootDir, 'src/background/service-worker.ts'),
        formats: ['es'],
        fileName: () => 'service-worker.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
      sourcemap: isWatch,
      minify: !isWatch,
    },
  });

  // 3. Build Action Popup
  console.log('\n[3/3] Bundling Extension Popup...');
  await build({
    root: path.resolve(rootDir, 'src/popup'),
    publicDir: false,
    plugins: [react()],
    base: './',
    build: {
      outDir: path.join(distDir, 'popup'),
      emptyOutDir: false,
      watch: isWatch ? {} : null,
      rollupOptions: {
        input: path.resolve(rootDir, 'src/popup/index.html'),
      },
      sourcemap: isWatch,
      minify: !isWatch,
    },
  });

  // Copy manifest and icons
  await copyStaticAssets();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✨ Browsy Extension built successfully in ${elapsed}s!`);
  console.log(`📍 Output Directory: ${distDir}`);
}

runBuild().catch((err) => {
  console.error('\n❌ Build failed:', err);
  process.exit(1);
});
