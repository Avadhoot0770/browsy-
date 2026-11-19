/**
 * Real-Browser End-to-End Validation against Polymer Shop Storefront
 * URL: https://shop.polymer-project.org/detail/mens_outerwear/Men+s+Tech+Shell+Full-Zip
 *
 * Verifies live in Brave via CDP using the ACTUAL production compiled bundle:
 * dist/test/browsy-production-verifier.iife.js (compiled from src/execution/product-verifier.ts)
 */

import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const profileDir = path.resolve(rootDir, `.browsy-polymer-${Date.now()}`);

const BRAVE_PATH = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const CDP_PORT = 9248;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("==================================================================");
  console.log("🌐 BROWSY REAL STOREFRONT SHADOW DOM VALIDATION (PRODUCTION CODE)");
  console.log("   Storefront: Polymer Shop (Official Google Polymer Demo)");
  console.log("   Product: Men's Tech Shell Full-Zip");
  console.log("==================================================================");

  const bundlePath = path.resolve(rootDir, "dist/test/browsy-production-verifier.iife.js");
  if (!fs.existsSync(bundlePath)) {
    throw new Error(`Production verifier bundle not found at ${bundlePath}. Run build-verifier-bundle.mjs first.`);
  }
  const productionBundleCode = fs.readFileSync(bundlePath, "utf8");
  console.log(`✓ Loaded compiled production verifier bundle (${(productionBundleCode.length / 1024).toFixed(1)} kB)`);

  if (fs.existsSync(profileDir)) {
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
  fs.mkdirSync(profileDir, { recursive: true });

  const targetUrl = "https://shop.polymer-project.org/detail/mens_outerwear/Men+s+Tech+Shell+Full-Zip";
  console.log(`\nNavigating Brave to real storefront: ${targetUrl}`);

  const proc = spawn(BRAVE_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profileDir}`,
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    targetUrl,
  ]);

  try {
    let targets = null;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
        targets = await res.json();
        if (targets && targets.length > 0) break;
      } catch {
        await sleep(300);
      }
    }

    if (!targets) throw new Error("Browser did not respond on CDP");

    const page = targets.find((t) => t.type === "page" && t.url.includes("polymer-project.org")) || targets[0];
    console.log(`✓ Connected to real storefront page tab: ${page.title || page.url}`);

    // Allow Polymer Web Components to mount their shadow roots
    await sleep(4000);

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    const sendCmd = (method, params) => {
      return new Promise((resolve, reject) => {
        const id = Math.floor(Math.random() * 100000);
        const onMsg = (event) => {
          const d = JSON.parse(event.data);
          if (d.id === id) {
            ws.removeEventListener("message", onMsg);
            if (d.error) reject(new Error(d.error.message));
            else resolve(d.result);
          }
        };
        ws.addEventListener("message", onMsg);
        ws.send(JSON.stringify({ id, method, params }));
      });
    };

    // Inject the actual compiled production verifier into the live browser context
    await sendCmd("Runtime.evaluate", {
      expression: productionBundleCode,
      returnByValue: true,
    });
    console.log("✓ Injected actual production verification functions (__browsyProductionVerifier)");

    // Execute the actual production verification functions on the live document
    const evalScript = `
      (() => {
        const pv = window.__browsyProductionVerifier;
        if (!pv) throw new Error("__browsyProductionVerifier not initialized on window");

        // 1. Production collectAccessibleRoots
        const traversal = pv.collectAccessibleRoots(document);

        // 2. Production extractPdpSizeOptions
        const sizeExtraction = pv.extractPdpSizeOptions(document);

        // 3. Production parseSizeAvailability for "XL"
        const xlAvailability = pv.parseSizeAvailability(document, "XL");

        // 4. Production parseProductSellingPrice
        const price = pv.parseProductSellingPrice(document);

        // Extract title across scopes
        let extractedTitle = null;
        for (const scope of traversal.scopes) {
          if (!("querySelector" in scope.rootNode)) continue;
          if (!extractedTitle) {
            const h1 = scope.rootNode.querySelector("h1, .pdp-title");
            if (h1 && h1.textContent?.trim()) extractedTitle = h1.textContent.trim();
          }
        }

        // 5. Production verifyProductAttributes
        const mockIntent = {
          id: "intent-polymer-live",
          intent: "find",
          target: "products",
          entities: { category: "shell" },
          filters: { size: "XL" },
          constraints: { maxPrice: 100 },
          confidence: 0.95,
          timestamp: Date.now()
        };

        const verificationResult = pv.verifyProductAttributes(
          document,
          mockIntent,
          extractedTitle || "Men's Tech Shell Full-Zip",
          price,
          "polymer-tech-shell",
          window.location.href
        );

        return {
          totalScopes: traversal.scopes.length,
          shadowRootsEncountered: traversal.shadowRootsEncountered,
          inaccessibleRootsEncountered: traversal.inaccessibleRootsEncountered,
          extractedTitle,
          price,
          sizeExtraction,
          xlAvailability,
          verificationResult
        };
      })()
    `;

    const res = await sendCmd("Runtime.evaluate", {
      expression: evalScript,
      returnByValue: true,
      awaitPromise: true,
    });

    const data = res.result.value;

    console.log("\n------------------------------------------------------------------");
    console.log("📍 REAL-BROWSER STOREFRONT RESULTS (Polymer Shop)");
    console.log("   Exercising ACTUAL production functions from src/execution/product-verifier.ts");
    console.log("------------------------------------------------------------------");
    console.log(`  Document Title:            ${page.title}`);
    console.log(`  Product Title Grounded:    "${data.extractedTitle}"`);
    console.log(`  Selling Price Grounded:    ${data.price ? "$" + data.price.amount : "null"}`);
    console.log(`  Total Scopes Traversed:    ${data.totalScopes}`);
    console.log(`  Open Shadow Roots Found:   ${data.shadowRootsEncountered}`);
    console.log(`  All Detected Sizes:        ${data.sizeExtraction.availableSizes.join(", ")}`);
    console.log(`  Requested Size ("XL"):     ${data.xlAvailability.status}`);
    console.log(`  Size XL Source:            ${data.xlAvailability.source}`);
    console.log(`  Size XL Available:         ${data.xlAvailability.isAvailable}`);
    console.log(`  Size XL Selectable:        ${data.xlAvailability.isSelectable}`);
    console.log(`  Full Verification Result:  ${data.verificationResult.isFullyVerified ? "VERIFIED MATCH" : "REJECTED"}`);
    console.log(`  Verified Evidence:         "${data.xlAvailability.evidence}"`);
    console.log("------------------------------------------------------------------");

    if (
      data.xlAvailability.status === "in_stock" &&
      data.xlAvailability.source === "shadow_dom" &&
      data.sizeExtraction.availableSizes.includes("XL") &&
      data.verificationResult.isFullyVerified
    ) {
      console.log("🎉 REAL LIVE STOREFRONT VALIDATION SUCCEEDED 100%!");
      console.log("   Confirmed: Actual production verification code executes on live Web Component Shadow DOM.");
    } else {
      console.error("Validation mismatch:", data);
      throw new Error("Live verification did not meet expected criteria");
    }

    ws.close();
  } finally {
    proc.kill();
    await sleep(1500);
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  console.error("Validation failure:", err);
  process.exit(1);
});
