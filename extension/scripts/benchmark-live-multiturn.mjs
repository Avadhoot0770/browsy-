/**
 * Live Real-Browser Multi-Turn Shopping Benchmark for Browsy
 *
 * Exercises an authentic multi-turn shopping session on Myntra using CDP:
 * Turn 1: "Find me a red checked shirt in size XL under ₹1,000."
 * Turn 2: "Show me only black ones" (context preservation test)
 * Turn 3: "Increase the budget to ₹1,500" (constraint update test)
 * Turn 4: "Sort the verified results by lowest price" (sorting test)
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist').replace(/\\/g, '/');

const BRAVE_PATH = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BROWSER_PATH = fs.existsSync(BRAVE_PATH) ? BRAVE_PATH : CHROME_PATH;
const CDP_PORT = 9228;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendCdpCommand(ws, method, params = {}) {
  const id = Math.floor(Math.random() * 1000000);
  return new Promise((resolve, reject) => {
    const handler = (event) => {
      const data = JSON.parse(event.data);
      if (data.id === id) {
        ws.removeEventListener('message', handler);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(ws, expression) {
  const res = await sendCdpCommand(ws, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (res?.exceptionDetails) {
    console.error("CDP Exception:", res.exceptionDetails.text, res.exceptionDetails.exception?.description);
  }
  return res?.result?.value;
}

async function getPageWs() {
  const resp = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
  const targets = await resp.json();
  const pageTarget =
    targets.find((t) => t.type === 'page' && t.url.includes('myntra.com')) ||
    targets.find((t) => t.type === 'page');
  if (!pageTarget) throw new Error("Could not find Myntra page target");
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener('open', resolve));
  return ws;
}

async function ensurePanelOpen(ws) {
  for (let i = 0; i < 25; i++) {
    try {
      const isReady = await evaluate(
        ws,
        `(() => {
          const root = document.getElementById('browsy-extension-root')?.shadowRoot;
          if (!root) return false;
          const panel = root.querySelector('.browsy-panel');
          const textarea = root.querySelector('.browsy-textarea');
          if (panel && textarea) return true;
          const launcher = root.querySelector('.browsy-launcher-btn') || root.querySelector('.browsy-launcher');
          launcher?.click();
          return false;
        })()`
      );
      if (isReady) return true;
    } catch {}
    await sleep(200);
  }
  return false;
}

async function submitPrompt(ws, promptText) {
  await ensurePanelOpen(ws);
  return evaluate(
    ws,
    `(() => {
      const root = document.getElementById('browsy-extension-root')?.shadowRoot;
      const textarea = root?.querySelector('.browsy-textarea');
      if (!textarea) return false;
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      nativeSetter?.call(textarea, ${JSON.stringify(promptText)});
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      const form = root?.querySelector('form.browsy-footer');
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      return true;
    })()`
  );
}

async function runLiveMultiTurnBenchmark() {
  console.log("======================================================================");
  console.log("🛒 BROWSY REAL-BROWSER MULTI-TURN SHOPPING BENCHMARK");
  console.log(`Target: Myntra (Live Site) via CDP Port ${CDP_PORT}`);
  console.log(`Browser: ${BROWSER_PATH}`);
  console.log(`Extension Dist: ${distDir}`);
  console.log("======================================================================");

  const profileDir = path.resolve(rootDir, `.browsy-multiturn-profile`);
  if (fs.existsSync(profileDir)) {
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
  fs.mkdirSync(profileDir, { recursive: true });

  const browserProc = spawn(BROWSER_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profileDir}`,
    `--load-extension=${distDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-fre',
    'https://www.myntra.com/',
  ]);

  let ws = null;
  const turnsResults = [];

  try {
    console.log("\n⏳ Connecting to browser CDP session...");
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      try {
        ws = await getPageWs();
        if (ws) break;
      } catch {}
    }
    if (!ws) throw new Error("Could not connect to browser CDP socket");
    console.log("✓ Connected to browser CDP socket successfully!");

    // Wait for Myntra to stabilize
    await sleep(4000);

    // Verify extension injection
    const hasExtension = await evaluate(ws, `Boolean(document.getElementById('browsy-extension-root'))`);
    if (!hasExtension) throw new Error("Browsy extension not injected into Myntra DOM");
    console.log("✓ Browsy extension container detected in Myntra DOM.");

    // Open Browsy panel
    await evaluate(
      ws,
      `(() => {
        const root = document.getElementById('browsy-extension-root')?.shadowRoot;
        const launcher = root?.querySelector('.browsy-launcher-btn') || root?.querySelector('.browsy-launcher');
        launcher?.click();
      })()`
    );
    await sleep(500);

    // ======================================================================
    // TURN 1: Initial Shopping Query
    // ======================================================================
    console.log("\n----------------------------------------------------------------------");
    console.log("TURN 1: 'Find me a red checked shirt in size XL under ₹1,000.'");
    console.log("----------------------------------------------------------------------");
    const t1Start = performance.now();
    await submitPrompt(ws, "Find me a red checked shirt in size XL under ₹1,000.");

    // Wait for response / verified product card
    let t1CardFound = false;
    let t1CardData = null;
    for (let i = 0; i < 60; i++) {
      await sleep(300);
      try {
        // Re-acquire WS if page navigated
        ws = await getPageWs();
        const poll = await evaluate(
          ws,
          `(() => {
            const root = document.getElementById('browsy-extension-root')?.shadowRoot;
            if (!root) return null;
            const card = root.querySelector('.browsy-verified-product-card');
            const title = card?.querySelector('.browsy-product-title')?.textContent || '';
            const price = card?.querySelector('.browsy-product-price')?.textContent || '';
            const statusPill = card?.querySelector('.browsy-product-status-pill')?.textContent || '';
            const badge = root.querySelector('.browsy-result-badge')?.textContent || '';
            const text = root.querySelector('.browsy-message-text')?.textContent || '';
            return {
              hasCard: Boolean(card),
              title,
              price,
              statusPill,
              badge,
              text,
            };
          })()`
        );
        if (poll?.hasCard || poll?.badge?.includes("COMPLETED") || poll?.text?.includes("matching")) {
          t1CardFound = true;
          t1CardData = poll;
          break;
        }
      } catch {}
    }
    const t1Elapsed = Math.round(performance.now() - t1Start);
    console.log(`✓ Turn 1 finished in ${t1Elapsed} ms. Card found: ${t1CardFound}`);
    if (t1CardData) {
      console.log(`  Product: ${t1CardData.title || "(catalog match)"}`);
      console.log(`  Price: ${t1CardData.price || "within budget"}`);
      console.log(`  Status: ${t1CardData.statusPill || t1CardData.badge}`);
    }
    turnsResults.push({ turn: 1, prompt: "Find me a red checked shirt in size XL under ₹1,000.", elapsedMs: t1Elapsed, success: t1CardFound, data: t1CardData });

    // ======================================================================
    // TURN 2: Multi-Turn Color Update ("Show me only black ones")
    // ======================================================================
    console.log("\n----------------------------------------------------------------------");
    console.log("TURN 2: 'Show me only black ones'");
    console.log("----------------------------------------------------------------------");
    await sleep(2000);
    ws = await getPageWs();
    const t2Start = performance.now();
    await submitPrompt(ws, "Show me only black ones");

    let t2Ack = false;
    let t2CardData = null;
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      try {
        ws = await getPageWs();
        const poll = await evaluate(
          ws,
          `(() => {
            const root = document.getElementById('browsy-extension-root')?.shadowRoot;
            if (!root) return null;
            const messages = Array.from(root.querySelectorAll('.browsy-message-wrap.assistant'));
            const allText = messages.map(m => m.textContent || '').join(' ');
            const card = root.querySelector('.browsy-verified-product-card');
            const title = card?.querySelector('.browsy-product-title')?.textContent || '';
            const price = card?.querySelector('.browsy-product-price')?.textContent || '';
            const statusPill = card?.querySelector('.browsy-product-status-pill')?.textContent || '';
            return {
              hasBlackAck: allText.toLowerCase().includes('black'),
              lastMsg: messages[messages.length - 1]?.textContent || '',
              hasCard: Boolean(card),
              title,
              price,
              statusPill,
            };
          })()`
        );
        if (poll?.hasBlackAck || poll?.hasCard) {
          t2Ack = true;
          t2CardData = poll;
          break;
        }
      } catch {}
    }
    const t2Elapsed = Math.round(performance.now() - t2Start);
    console.log(`✓ Turn 2 finished in ${t2Elapsed} ms. Acknowledged: ${t2Ack}`);
    if (t2CardData?.hasBlackAck) {
      console.log(`  Context update message: ${t2CardData.lastMsg.slice(0, 100)}...`);
    }
    turnsResults.push({ turn: 2, prompt: "Show me only black ones", elapsedMs: t2Elapsed, success: t2Ack, data: t2CardData });

    // ======================================================================
    // TURN 3: Multi-Turn Budget Update ("Increase the budget to ₹1,500")
    // ======================================================================
    console.log("\n----------------------------------------------------------------------");
    console.log("TURN 3: 'Increase the budget to ₹1,500'");
    console.log("----------------------------------------------------------------------");
    await sleep(2000);
    ws = await getPageWs();
    const t3Start = performance.now();
    await submitPrompt(ws, "Increase the budget to ₹1,500");

    let t3Ack = false;
    let t3CardData = null;
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      try {
        ws = await getPageWs();
        const poll = await evaluate(
          ws,
          `(() => {
            const root = document.getElementById('browsy-extension-root')?.shadowRoot;
            if (!root) return null;
            const messages = Array.from(root.querySelectorAll('.browsy-message-wrap.assistant'));
            const allText = messages.map(m => m.textContent || '').join(' ');
            const card = root.querySelector('.browsy-verified-product-card');
            return {
              hasBudgetAck: allText.includes('1,500') || allText.includes('1500'),
              lastMsg: messages[messages.length - 1]?.textContent || '',
              hasCard: Boolean(card),
            };
          })()`
        );
        if (poll?.hasBudgetAck) {
          t3Ack = true;
          t3CardData = poll;
          break;
        }
      } catch {}
    }
    const t3Elapsed = Math.round(performance.now() - t3Start);
    console.log(`✓ Turn 3 finished in ${t3Elapsed} ms. Acknowledged: ${t3Ack}`);
    turnsResults.push({ turn: 3, prompt: "Increase the budget to ₹1,500", elapsedMs: t3Elapsed, success: t3Ack, data: t3CardData });

    // ======================================================================
    // TURN 4: Sorting Results ("Sort the verified results by lowest price")
    // ======================================================================
    console.log("\n----------------------------------------------------------------------");
    console.log("TURN 4: 'Sort the verified results by lowest price'");
    console.log("----------------------------------------------------------------------");
    await sleep(2000);
    ws = await getPageWs();
    const t4Start = performance.now();
    await submitPrompt(ws, "Sort the verified results by lowest price");

    let t4Ack = false;
    let t4Data = null;
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      try {
        ws = await getPageWs();
        const poll = await evaluate(
          ws,
          `(() => {
            const root = document.getElementById('browsy-extension-root')?.shadowRoot;
            if (!root) return null;
            const messages = Array.from(root.querySelectorAll('.browsy-message-wrap.assistant'));
            const allText = messages.map(m => m.textContent || '').join(' ');
            return {
              hasSortAck: allText.toLowerCase().includes('sort') || allText.toLowerCase().includes('lowest first'),
              lastMsg: messages[messages.length - 1]?.textContent || '',
            };
          })()`
        );
        if (poll?.hasSortAck) {
          t4Ack = true;
          t4Data = poll;
          break;
        }
      } catch {}
    }
    const t4Elapsed = Math.round(performance.now() - t4Start);
    console.log(`✓ Turn 4 finished in ${t4Elapsed} ms. Sort acknowledged: ${t4Ack}`);
    turnsResults.push({ turn: 4, prompt: "Sort the verified results by lowest price", elapsedMs: t4Elapsed, success: t4Ack, data: t4Data });

    console.log("\n======================================================================");
    console.log("📊 MULTI-TURN BENCHMARK SUMMARY");
    console.log("======================================================================");
    for (const r of turnsResults) {
      console.log(`Turn ${r.turn}: "${r.prompt}" -> ${r.success ? "PASS" : "FAIL"} (${r.elapsedMs} ms)`);
    }

    // Write results JSON
    fs.writeFileSync(
      path.resolve(rootDir, "benchmark-multiturn-results.json"),
      JSON.stringify(turnsResults, null, 2),
      "utf8"
    );
    console.log("\n✓ Results written to benchmark-multiturn-results.json");

  } finally {
    if (ws) {
      try {
        ws.close();
      } catch {}
    }
    browserProc.kill('SIGKILL');
  }
}

runLiveMultiTurnBenchmark().catch((err) => {
  console.error("Live multi-turn benchmark encountered error:", err);
  process.exit(1);
});
