import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist').replace(/\\/g, '/');

const BRAVE_PATH = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
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

async function main() {
  const profileDir = path.resolve(rootDir, '.browsy-debug-profile');
  if (fs.existsSync(profileDir)) fs.rmSync(profileDir, { recursive: true, force: true });
  fs.mkdirSync(profileDir, { recursive: true });

  const browserProc = spawn(BRAVE_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profileDir}`,
    `--load-extension=${distDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-fre',
    'https://www.myntra.com/',
  ]);

  try {
    let ws = null;
    for (let i = 0; i < 20; i++) {
      await sleep(400);
      try {
        ws = await getPageWs();
        if (ws) break;
      } catch {}
    }
    if (!ws) throw new Error("Could not connect CDP");

    await sleep(4000);

    // Open launcher
    await evaluate(
      ws,
      `(() => {
        const root = document.getElementById('browsy-extension-root')?.shadowRoot;
        const launcher = root?.querySelector('.browsy-launcher-btn') || root?.querySelector('.browsy-launcher');
        launcher?.click();
      })()`
    );
    await sleep(600);

    const prompt = "Find me a red checked shirt in size XL under ₹1,000.";
    console.log(`Submitting prompt: "${prompt}"`);
    await evaluate(
      ws,
      `(() => {
        const root = document.getElementById('browsy-extension-root')?.shadowRoot;
        const textarea = root?.querySelector('.browsy-textarea');
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
        nativeSetter?.call(textarea, ${JSON.stringify(prompt)});
        textarea?.dispatchEvent(new Event('input', { bubbles: true }));
        const form = root?.querySelector('form.browsy-footer');
        form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      })()`
    );

    for (let i = 0; i < 15; i++) {
      await sleep(1000);
      try {
        ws = await getPageWs();
        const curUrl = await evaluate(ws, `window.location.href`);
        const dump = await evaluate(
          ws,
          `(() => {
            const root = document.getElementById('browsy-extension-root')?.shadowRoot;
            if (!root) return { hasRoot: false };
            const cardEl = root.querySelector('.browsy-verified-product-card');
            const runBtn = root.querySelector('.browsy-run-btn');
            const planCard = root.querySelector('.browsy-plan-card');
            const execCard = root.querySelector('.browsy-exec-card');
            const badge = root.querySelector('.browsy-result-badge')?.textContent || '';
            const allHtml = root.innerHTML;
            return {
              hasRoot: true,
              hasVerifiedCard: Boolean(cardEl),
              hasRunBtn: Boolean(runBtn),
              hasPlanCard: Boolean(planCard),
              hasExecCard: Boolean(execCard),
              badge,
              cardText: cardEl?.textContent?.replace(/\\s+/g, ' ') || null,
              planText: planCard?.textContent?.replace(/\\s+/g, ' ') || null,
              htmlSnippet: allHtml.slice(allHtml.indexOf('<div class="browsy-'), allHtml.indexOf('<div class="browsy-') + 600),
            };
          })()`
        );
        console.log(`[T+${i + 1}s] URL: ${curUrl}`, JSON.stringify(dump));
        if (dump?.hasVerifiedCard) {
          console.log("🎉 SUCCESS! Verified product card mounted:", dump.cardText);
          break;
        }
      } catch (e) {
        console.log(`[T+${i + 1}s] Loop err:`, e.message);
      }
    }
  } finally {
    browserProc.kill();
  }
}

main();
