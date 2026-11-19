import { build } from "vite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

async function buildBundle() {
  await build({
    root,
    build: {
      outDir: resolve(root, "dist/test"),
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, "production-verifier-entry.ts"),
        formats: ["iife"],
        name: "BrowsyProductionVerifier",
        fileName: () => "browsy-production-verifier.iife.js",
      },
    },
  });
  console.log("✓ Production verifier bundle built successfully: dist/test/browsy-production-verifier.iife.js");
}

buildBundle().catch((err) => {
  console.error(err);
  process.exit(1);
});
