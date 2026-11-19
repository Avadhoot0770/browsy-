import { build } from "vite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

async function run() {
  console.log("Compiling Traversal Benchmark with Vite...");
  await build({
    root,
    build: {
      outDir: resolve(root, "dist/test"),
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, "benchmark-traversal.ts"),
        formats: ["es"],
        fileName: "benchmark-traversal-bundle",
      },
      rollupOptions: {
        external: [/^node:/, "fs", "path", "url", "events", "assert", "perf_hooks"],
      },
    },
  });

  const bundlePath = resolve(root, "dist/test/benchmark-traversal-bundle.js");
  console.log("Executing benchmark runner:", bundlePath, "\n");
  const child = spawn(process.execPath, [bundlePath], { stdio: "inherit" });
  child.on("exit", (code) => process.exit(code || 0));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
