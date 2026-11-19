import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const BRAVE_PATH = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const CDP_PORT = 9250;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const testSites = [
  {
    name: "Polymer Project Shop (Google Web Components)",
    url: "https://shop.polymer-project.org/detail/mens_outerwear/Men+s+Tech+Shell+Full-Zip",
  },
  {
    name: "Books to Scrape (Public E-Commerce Sandbox)",
    url: "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html",
  },
  {
    name: "OpenCart Demo Store (E-Commerce Playground)",
    url: "https://ecommerce-playground.lambdatest.io/index.php?route=product/product&product_id=28",
  },
];

async function probeSite(site, index) {
  const profileDir = path.resolve(rootDir, `.browsy-probe-${Date.now()}-${index}`);
  fs.mkdirSync(profileDir, { recursive: true });

  console.log(`\nProbing [${index + 1}/${testSites.length}]: ${site.name}\nURL: ${site.url}`);
  const proc = spawn(BRAVE_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profileDir}`,
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    site.url,
  ]);

  try {
    let targets = null;
    for (let i = 0; i < 25; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
        targets = await res.json();
        if (targets && targets.length > 0) break;
      } catch {
        await sleep(300);
      }
    }

    if (!targets) {
      console.log(`  ❌ Failed to connect to CDP for ${site.name}`);
      proc.kill();
      await sleep(1000);
      return null;
    }

    const page = targets.find((t) => t.type === "page") || targets[0];
    await sleep(4000); // Wait for page load and scripts

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

    const auditScript = `
      (() => {
        let openShadowCount = 0;
        let closedShadowCount = 0;
        const queue = [document.body || document.documentElement];
        const visited = new Set();

        while (queue.length > 0) {
          const node = queue.shift();
          if (!node || visited.has(node)) continue;
          visited.add(node);

          if (node.shadowRoot) {
            openShadowCount++;
            queue.push(node.shadowRoot);
          }
          if (node.getAttribute && (node.getAttribute("shadowrootmode") === "closed" || node.getAttribute("shadowroot") === "closed")) {
            closedShadowCount++;
          }

          if (node.querySelectorAll) {
            try {
              const all = node.querySelectorAll("*");
              for (const el of all) {
                if (el.shadowRoot) {
                  openShadowCount++;
                  queue.push(el.shadowRoot);
                }
              }
            } catch {}
          }
        }

        const sizeElements = document.querySelectorAll("button, select, [class*='size' i], [id*='size' i]");
        const title = document.title;
        const priceEl = document.querySelector(".price, .pdp-price, [class*='price' i], p.price_color");
        const priceText = priceEl ? priceEl.textContent.trim() : null;

        return {
          title,
          openShadowCount,
          closedShadowCount,
          priceText,
          lightDomSizeCandidateCount: sizeElements.length
        };
      })()
    `;

    const res = await sendCmd("Runtime.evaluate", {
      expression: auditScript,
      returnByValue: true,
    });

    console.log("  Audit Results:", JSON.stringify(res.result.value, null, 2));
    ws.close();
    proc.kill();
    await sleep(1500);
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
    return res.result.value;
  } catch (err) {
    console.log(`  ❌ Error probing ${site.name}:`, err.message);
    try { proc.kill(); } catch {}
    await sleep(1500);
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
    return null;
  }
}

async function run() {
  console.log("=================================================");
  console.log("🌐 PROBING PUBLIC STOREFRONTS FOR ARCHITECTURE");
  console.log("=================================================");
  for (let i = 0; i < testSites.length; i++) {
    await probeSite(testSites[i], i);
  }
}

run();
