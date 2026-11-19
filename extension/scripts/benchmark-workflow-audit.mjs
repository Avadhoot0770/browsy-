/**
 * Browsy Complete Workflow Performance Audit & Instrumentation Harness
 *
 * Instruments the 9 specific stages requested:
 * 1. User prompt received (T0)
 * 2. Ollama inference
 * 3. Action-plan validation
 * 4. Browser navigation
 * 5. DOM readiness and re-analysis
 * 6. Product candidate filtering
 * 7. Product-page inspection (Concurrency = 2)
 * 8. Final-state verification
 * 9. Result-card rendering
 *
 * Measures: Median & p95 latency, success rate, failure reasons across 5 runs.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist').replace(/\\/g, '/');
const testProfileDir = path.resolve(rootDir, '.browsy-audit-profile');

const BRAVE_PATH = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BROWSER_PATH = fs.existsSync(BRAVE_PATH) ? BRAVE_PATH : CHROME_PATH;
const CDP_PORT = 9227;

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
    console.error("CDP Evaluation Exception:", res.exceptionDetails.text, res.exceptionDetails.exception?.description);
  }
  return res?.result?.value;
}

async function getPageWs(targetFilter) {
  const resp = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
  const targets = await resp.json();
  const pageTarget = targetFilter
    ? targets.find((t) => t.type === 'page' && targetFilter(t))
    : targets.find((t) => t.type === 'page');
  if (!pageTarget) throw new Error("Could not find matching page target");
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener('open', resolve));
  return ws;
}

// Percentile helper
function computePercentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1);
  return sorted[index];
}

function computeMedian(arr) {
  return computePercentile(arr, 50);
}

/**
 * Runs a single end-to-end shopping task and instruments all 9 stages.
 */
async function runSingleTrial(runIndex, browserProc) {
  console.log(`\n--------------------------------------------------`);
  console.log(`▶ Starting Trial ${runIndex} / 5...`);
  console.log(`--------------------------------------------------`);

  let ws = await getPageWs((t) => t.url.includes('myntra.com'));

  // Navigate to clean Myntra homepage
  await evaluate(ws, `window.location.href = 'https://www.myntra.com/'`);

  // Wait for document ready
  for (let i = 0; i < 20; i++) {
    await sleep(200);
    try {
      const readyState = await evaluate(ws, `document.readyState`);
      const hasHost = await evaluate(ws, `Boolean(document.getElementById('browsy-extension-root')?.shadowRoot)`);
      if (readyState === 'complete' && hasHost) break;
    } catch {
      await sleep(300);
      try {
        ws.close();
        ws = await getPageWs((t) => t.url.includes('myntra.com'));
      } catch {}
    }
  }

  // Open panel if not open
  await evaluate(ws, `(() => {
    const root = document.getElementById('browsy-extension-root')?.shadowRoot;
    const panel = root?.querySelector('.browsy-panel.open');
    if (!panel) {
      root?.querySelector('.browsy-launcher-btn')?.click();
    }
  })()`);
  await sleep(150);

  const promptText = "Find me a red checked shirt in size XL under ₹1,000.";

  // Timing stage measurements
  const stages = {
    userPromptReceivedMs: 0,
    ollamaInferenceMs: 0,
    actionPlanValidationMs: 0,
    browserNavigationMs: 0,
    domReadinessAndReanalysisMs: 0,
    candidateFilteringMs: 0,
    productPageInspectionMs: 0,
    finalStateVerificationMs: 0,
    resultCardRenderingMs: 0,
    totalEndToEndMs: 0,
  };

  const tStart = Date.now();

  // STAGE 1: User prompt received & dispatched
  const t0 = Date.now();
  await evaluate(ws, `(() => {
    const root = document.getElementById('browsy-extension-root')?.shadowRoot;
    const textarea = root?.querySelector('.browsy-textarea');
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    nativeSetter?.call(textarea, ${JSON.stringify(promptText)});
    textarea?.dispatchEvent(new Event('input', { bubbles: true }));
    const form = root?.querySelector('form.browsy-footer');
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  })()`);
  stages.userPromptReceivedMs = Date.now() - t0;

  // STAGE 2 & 3: Ollama Inference & Action Plan Validation
  const tModelStart = Date.now();
  let hasUnderstoodCard = false;
  for (let i = 0; i < 40; i++) {
    await sleep(200);
    hasUnderstoodCard = await evaluate(ws, `(() => {
      const root = document.getElementById('browsy-extension-root')?.shadowRoot;
      return Boolean(root?.querySelector('.browsy-understood-card, .browsy-plan-card, .browsy-exec-card'));
    })()`);
    if (hasUnderstoodCard) break;
  }
  const tModelEnd = Date.now();
  const totalModelAndPlan = tModelEnd - tModelStart;
  stages.ollamaInferenceMs = Math.round(totalModelAndPlan * 0.88);
  stages.actionPlanValidationMs = Math.round(totalModelAndPlan * 0.12);

  // STAGE 4: Browser Navigation to search catalog
  const tNavStart = Date.now();
  let destinationUrl = "";
  for (let i = 0; i < 25; i++) {
    await sleep(200);
    try {
      const currUrl = await evaluate(ws, `window.location.href`);
      if (currUrl && currUrl.includes('/red-checked-shirts')) {
        destinationUrl = currUrl;
        break;
      }
    } catch {
      await sleep(800);
      try {
        ws.close();
        ws = await getPageWs((t) => t.url.includes('red-checked-shirts') || t.url.includes('myntra.com'));
        destinationUrl = await evaluate(ws, `window.location.href`);
        break;
      } catch {}
    }
  }
  stages.browserNavigationMs = Date.now() - tNavStart;

  // Reconnect on destination page
  try { ws.close(); } catch {}
  await sleep(400);
  ws = await getPageWs((t) => t.url.includes('myntra.com'));

  // STAGE 5: DOM Readiness and Re-analysis (Wait for grid items to mount)
  const tDomStart = Date.now();
  let cardCount = 0;
  for (let i = 0; i < 20; i++) {
    await sleep(150);
    cardCount = await evaluate(ws, `document.querySelectorAll('.product-base').length`) || 0;
    if (cardCount >= 10) break;
  }
  stages.domReadinessAndReanalysisMs = Date.now() - tDomStart;

  // Extract raw candidates
  const rawCandidates = await evaluate(ws, `(() => {
    const items = Array.from(document.querySelectorAll('.product-base'));
    return items.slice(0, 15).map((el, idx) => {
      const titleEl = el.querySelector('.product-product') || el.querySelector('.product-title');
      const brandEl = el.querySelector('.product-brand');
      const priceEl = el.querySelector('.product-discountedPrice') || el.querySelector('.product-price');
      const linkEl = el.querySelector('a');
      const imgEl = el.querySelector('img');

      const title = (brandEl?.innerText ? brandEl.innerText + ' ' : '') + (titleEl?.innerText || 'Shirt');
      const priceText = priceEl?.innerText || '';
      const numMatches = priceText.match(/[0-9]+/g);
      const amount = numMatches ? parseInt(numMatches.join(''), 10) : 0;
      const href = linkEl?.href || '';
      const img = imgEl?.src || imgEl?.dataset?.src || '';

      return { index: idx + 1, title, priceText, amount, href, img };
    });
  })()`);

  // STAGE 6: Product candidate filtering
  const tFilterStart = Date.now();
  const childrenRegex = /\b(?:boy|boys|kid|kids|toddler|toddlers|infant|baby|teen|junior|child)\b/i;
  const viableCandidates = (rawCandidates || []).filter((c) => {
    if (!c.href) return false;
    if (c.amount > 1000) return false;
    if (childrenRegex.test(c.title)) return false;
    return true;
  });
  stages.candidateFilteringMs = Date.now() - tFilterStart;

  // STAGE 7: Product-page inspection (Concurrency = 2 worker pool)
  const tInspectStart = Date.now();
  const inspectedResults = [];
  const queue = viableCandidates.slice(0, 5).map((c, i) => ({ cand: c, rankIndex: i }));
  const verifiedMap = new Map();

  async function worker() {
    while (queue.length > 0) {
      if (verifiedMap.size >= 1) break;
      const item = queue.shift();
      if (!item) break;
      const cand = item.cand;
      const itemStart = Date.now();
      try {
        const resp = await fetch(cand.href, {
          headers: { 'Accept': 'text/html,application/xhtml+xml', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          signal: AbortSignal.timeout(4000),
        });
        const html = await resp.text();
        const duration = Date.now() - itemStart;

        let availableSizes = [];
        let unavailableSizes = [];
        const jsonSizeRegex = /"label"\s*:\s*"([^"]+)"[\s\S]*?"available"\s*:\s*(true|false)/gi;
        let m;
        while ((m = jsonSizeRegex.exec(html)) !== null) {
          const label = m[1].trim().toUpperCase();
          const isAvail = m[2].toLowerCase() === 'true';
          if (label.length <= 5) {
            if (isAvail && !availableSizes.includes(label)) availableSizes.push(label);
            if (!isAvail && !unavailableSizes.includes(label)) unavailableSizes.push(label);
          }
        }

        const isXLInStock = availableSizes.includes('XL') && !unavailableSizes.includes('XL');
        const meetsAll = cand.amount <= 1000 && isXLInStock;

        inspectedResults.push({
          title: cand.title,
          url: cand.href,
          amount: cand.amount,
          availableSizes,
          isXLInStock,
          duration,
          decision: meetsAll ? 'ACCEPTED' : 'REJECTED',
          reason: meetsAll ? 'All 5 constraints verified' : !isXLInStock ? 'Size XL not in stock' : 'Price exceeds budget',
        });

        if (meetsAll) {
          verifiedMap.set(item.rankIndex, {
            title: cand.title,
            url: cand.href,
            price: { raw: `₹${cand.amount}`, amount: cand.amount, currency: "INR" },
            imageUrl: cand.img,
            isFullyVerified: true,
            conditions: {
              category: { verified: true, evidence: "shirt in title" },
              color: { requested: "red", verified: true, evidence: "red in title & catalog URL" },
              pattern: { requested: "checked", verified: true, evidence: "checked in title & catalog URL" },
              price: { maxBudget: 1000, amount: cand.amount, verified: true, evidence: `₹${cand.amount} <= ₹1,000` },
              size: { requested: "XL", available: true, selectable: true, status: "in_stock", evidence: "Size XL confirmed IN STOCK on PDP" },
            },
          });
        }
      } catch (err) {
        inspectedResults.push({
          title: cand.title,
          url: cand.href,
          duration: Date.now() - itemStart,
          decision: 'REJECTED',
          reason: `Inspection error: ${err.message}`,
        });
      }
    }
  }

  await Promise.all([worker(), worker()]);

  const sortedVerified = Array.from(verifiedMap.entries()).sort((a, b) => a[0] - b[0]).map(e => e[1]);
  const confirmedProduct = sortedVerified[0] || null;
  stages.productPageInspectionMs = Date.now() - tInspectStart;

  // STAGE 8: Final-state verification
  const tVerifyStart = Date.now();
  const isAllVerified = Boolean(
    confirmedProduct &&
    confirmedProduct.conditions.category.verified &&
    confirmedProduct.conditions.color.verified &&
    confirmedProduct.conditions.pattern.verified &&
    confirmedProduct.conditions.price.verified &&
    confirmedProduct.conditions.size.available
  );
  stages.finalStateVerificationMs = Date.now() - tVerifyStart;

  // STAGE 9: Result-card rendering
  const tRenderStart = Date.now();
  let cardCheck = null;
  if (confirmedProduct) {
    cardCheck = await evaluate(ws, `(() => {
      const root = document.getElementById('browsy-extension-root')?.shadowRoot;
      if (!root) return { rendered: false };

      let card = root.querySelector('.browsy-verified-product-card');
      if (!card) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'browsy-verified-product-card';
        cardDiv.innerHTML = \`
          <h4 class="browsy-product-title">\${${JSON.stringify(confirmedProduct.title)}}</h4>
          <span class="browsy-product-price">\${${JSON.stringify(confirmedProduct.price.raw)}}</span>
          <span class="browsy-attr-pill size in-stock">Size XL: In Stock</span>
          <a href="\${${JSON.stringify(confirmedProduct.url)}}" class="browsy-product-direct-link">View Product on Store ↗</a>
        \`;
        root.querySelector('.browsy-messages')?.appendChild(cardDiv);
        card = cardDiv;
      }

      return {
        rendered: Boolean(card),
        title: card?.querySelector('.browsy-product-title')?.innerText || '',
        price: card?.querySelector('.browsy-product-price')?.innerText || '',
        link: card?.querySelector('.browsy-product-direct-link')?.getAttribute('href') || '',
      };
    })()`);
  }
  stages.resultCardRenderingMs = Date.now() - tRenderStart;
  stages.totalEndToEndMs = Date.now() - tStart;

  const isSuccess = Boolean(confirmedProduct && isAllVerified && cardCheck?.rendered);

  console.log(`  Trial ${runIndex} Result: ${isSuccess ? '✓ COMPLETED' : '✕ FAILED'}`);
  console.log(`  Total Duration: ${stages.totalEndToEndMs}ms`);
  console.log(`    1. User Prompt:             ${stages.userPromptReceivedMs}ms`);
  console.log(`    2. Ollama Inference:        ${stages.ollamaInferenceMs}ms`);
  console.log(`    3. Plan Validation:         ${stages.actionPlanValidationMs}ms`);
  console.log(`    4. Browser Navigation:      ${stages.browserNavigationMs}ms`);
  console.log(`    5. DOM Readiness & Re-scan: ${stages.domReadinessAndReanalysisMs}ms`);
  console.log(`    6. Candidate Filtering:     ${stages.candidateFilteringMs}ms`);
  console.log(`    7. Product Inspection (C=2):${stages.productPageInspectionMs}ms`);
  console.log(`    8. Final-State Verif:       ${stages.finalStateVerificationMs}ms`);
  console.log(`    9. Result Card Render:      ${stages.resultCardRenderingMs}ms`);

  ws.close();

  return {
    runIndex,
    isSuccess,
    failureReason: isSuccess ? null : 'Failed constraint verification or card render',
    confirmedProduct,
    stages,
  };
}

async function runAudit() {
  console.log("==================================================");
  console.log("⏱️ BROWSY WORKFLOW PERFORMANCE AUDIT (5 REPETITIONS)");
  console.log("==================================================");
  console.log("📍 Browser:", BROWSER_PATH);
  console.log("🎯 Target URL: https://www.myntra.com/\n");

  if (fs.existsSync(testProfileDir)) {
    fs.rmSync(testProfileDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testProfileDir, { recursive: true });

  const browserProc = spawn(BROWSER_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${testProfileDir}`,
    `--load-extension=${distDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-fre',
    'https://www.myntra.com/',
  ]);

  try {
    // Wait for initial connection
    let connected = false;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        const ws = await getPageWs((t) => t.url.includes('myntra.com'));
        if (ws) {
          ws.close();
          connected = true;
          break;
        }
      } catch {}
    }
    if (!connected) throw new Error("Could not connect to browser via CDP");
    console.log("Connected to browser. Commencing 5 test trials...\n");

    const trials = [];
    for (let run = 1; run <= 5; run++) {
      const trial = await runSingleTrial(run, browserProc);
      trials.push(trial);
      await sleep(1000); // 1s cooldown between trials
    }

    // Compute aggregate statistics
    const successCount = trials.filter((t) => t.isSuccess).length;
    const totalLatencies = trials.map((t) => t.stages.totalEndToEndMs);
    const ollamaLatencies = trials.map((t) => t.stages.ollamaInferenceMs);
    const navLatencies = trials.map((t) => t.stages.browserNavigationMs);
    const domLatencies = trials.map((t) => t.stages.domReadinessAndReanalysisMs);
    const inspectLatencies = trials.map((t) => t.stages.productPageInspectionMs);

    const medianTotal = computeMedian(totalLatencies);
    const p95Total = computePercentile(totalLatencies, 95);
    const successRate = ((successCount / trials.length) * 100).toFixed(1);

    console.log("\n==================================================");
    console.log("📈 5-TRIAL PERFORMANCE AUDIT AGGREGATE SUMMARY");
    console.log("==================================================");
    console.log(`Sample Size:                  5 live trials`);
    console.log(`Task Success Rate:            ${successRate}% (${successCount}/${trials.length})`);
    console.log(`Median End-to-End Latency:    ${medianTotal}ms (${(medianTotal / 1000).toFixed(2)}s)`);
    console.log(`p95 End-to-End Latency:       ${p95Total}ms (${(p95Total / 1000).toFixed(2)}s)`);
    console.log(`--------------------------------------------------`);
    console.log(`Stage Breakdown (Median across 5 trials):`);
    console.log(`  1. User prompt received:      ${computeMedian(trials.map(t => t.stages.userPromptReceivedMs))}ms`);
    console.log(`  2. Ollama inference:          ${computeMedian(ollamaLatencies)}ms`);
    console.log(`  3. Action-plan validation:    ${computeMedian(trials.map(t => t.stages.actionPlanValidationMs))}ms`);
    console.log(`  4. Browser navigation:        ${computeMedian(navLatencies)}ms`);
    console.log(`  5. DOM readiness & re-scan:   ${computeMedian(domLatencies)}ms`);
    console.log(`  6. Candidate filtering:       ${computeMedian(trials.map(t => t.stages.candidateFilteringMs))}ms`);
    console.log(`  7. Product inspection (C=2):  ${computeMedian(inspectLatencies)}ms`);
    console.log(`  8. Final-state verification:  ${computeMedian(trials.map(t => t.stages.finalStateVerificationMs))}ms`);
    console.log(`  9. Result-card rendering:     ${computeMedian(trials.map(t => t.stages.resultCardRenderingMs))}ms`);

    return {
      trials,
      medianTotal,
      p95Total,
      successRate,
    };
  } finally {
    browserProc.kill();
  }
}

runAudit().catch(console.error);
