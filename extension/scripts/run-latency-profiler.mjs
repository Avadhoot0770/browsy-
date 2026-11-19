import { build } from "vite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

async function run() {
  console.log("Compiling Latency Profiler with Vite...");
  await build({
    root,
    build: {
      outDir: resolve(root, "dist/test"),
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, "profile-e2e-latency.ts"),
        formats: ["es"],
        fileName: "profile-e2e-latency-bundle",
      },
      rollupOptions: {
        external: [/^node:/, "fs", "path", "url", "events", "assert", "perf_hooks"],
      },
    },
  });

  const bundlePath = resolve(root, "dist/test/profile-e2e-latency-bundle.js");
  console.log("Executing latency profiler runner:", bundlePath, "\n");
  const child = spawn(process.execPath, [bundlePath], { stdio: "inherit" });
  child.on("exit", (code) => process.exit(code || 0));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
