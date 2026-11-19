import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist').replace(/\\/g, '/');
const testProfileDir = path.resolve(rootDir, '.browsy-site-matrix-profile');

const BRAVE_PATH = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BROWSER_PATH = fs.existsSync(BRAVE_PATH) ? BRAVE_PATH : CHROME_PATH;

const CDP_PORT = 9223;

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
  return res.result?.value;
}

const TEST_URLS = [
  { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Web_browser' },
  { name: 'Hacker News', url: 'https://news.ycombinator.com' },
  { name: 'Google Search', url: 'https://www.google.com' },
  { name: 'Python Docs', url: 'https://docs.python.org/3/' },
];

async function runSiteMatrix() {
  console.log(`\n==================================================`);
  console.log(`🌐 BROWSY REAL WEBSITE TEST MATRIX`);
  console.log(`==================================================`);

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
    TEST_URLS[0].url,
  ]);

  const results = [];

  try {
    let targets = null;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
        if (res.ok) {
          targets = await res.json();
          const page = targets.find((t) => t.type === 'page');
          if (page && page.webSocketDebuggerUrl) break;
        }
      } catch {
        // waiting
      }
    }

    const pageTarget = targets.find((t) => t.type === 'page');
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve) => ws.addEventListener('open', resolve));

    for (const site of TEST_URLS) {
      console.log(`\nTesting ${site.name}: ${site.url} ...`);
      await sendCdpCommand(ws, 'Page.navigate', { url: site.url });
      await sleep(3000);

      const inspection = await evaluate(
        ws,
        `(() => {
          const root = document.getElementById('browsy-extension-root');
          if (!root) return { mounted: false };

          // Trigger assistant open if needed
          const launcher = root.shadowRoot?.querySelector('.browsy-launcher-btn');
          if (launcher) launcher.click();

          const pill = root.shadowRoot?.querySelector('.browsy-status-pill')?.innerText || '';
          const domain = root.shadowRoot?.querySelector('.browsy-page-domain')?.innerText || '';

          // Gather stats
          const elements = document.querySelectorAll('[data-browsy-id]');
          const searchInputs = document.querySelectorAll('input[type="search"], [role="searchbox"]');
          const buttons = document.querySelectorAll('button, [role="button"]');
          const links = document.querySelectorAll('a[href]');

          return {
            mounted: true,
            domain,
            pill,
            registeredElementCount: elements.length,
            searchInputsCount: searchInputs.length,
            buttonsCount: buttons.length,
            linksCount: links.length,
          };
        })()`
      );

      console.log(`Result for ${site.name}:`, inspection);
      results.push({
        site: site.name,
        url: site.url,
        ...inspection,
      });
    }

    ws.close();

    console.log(`\n==================================================`);
    console.log(`SUMMARY MATRIX RESULTS:`);
    console.table(results);
    console.log(`==================================================`);
  } finally {
    try {
      browserProc.kill();
    } catch {
      // ignore
    }
    await sleep(800);
    try {
      if (fs.existsSync(testProfileDir)) {
        fs.rmSync(testProfileDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  }
}

runSiteMatrix().catch((err) => {
  console.error('Matrix test error:', err);
  process.exit(1);
});
