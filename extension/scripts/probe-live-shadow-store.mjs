import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const profileDir = path.resolve(rootDir, '.browsy-probe-profile');

const BRAVE_PATH = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
const CDP_PORT = 9245;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('==================================================================');
  console.log('🔍 PROBING REAL STOREFRONT: https://shop.polymer-project.org/');
  console.log('==================================================================');

  if (fs.existsSync(profileDir)) {
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
  fs.mkdirSync(profileDir, { recursive: true });

  const url = 'https://shop.polymer-project.org/detail/mens_outerwear/Men+s+Tech+Shell+Full-Zip';
  console.log('Navigating Brave to:', url);

  const proc = spawn(BRAVE_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profileDir}`,
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    url,
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

    if (!targets) throw new Error('Browser did not respond on CDP');

    const page = targets.find((t) => t.type === 'page' && t.url.includes('polymer-project.org')) || targets[0];
    console.log('✓ Connected to page tab:', page.title || page.url);

    // Wait for Polymer components to register and render
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
            ws.removeEventListener('message', onMsg);
            if (d.error) reject(new Error(d.error.message));
            else resolve(d.result);
          }
        };
        ws.addEventListener('message', onMsg);
        ws.send(JSON.stringify({ id, method, params }));
      });
    };

    const evalResult = await sendCmd('Runtime.evaluate', {
      expression: `
        (() => {
          const app = document.querySelector('shop-app');
          const hasAppShadow = Boolean(app && app.shadowRoot);

          let detailEl = null;
          let hasDetailShadow = false;
          let sizeOptions = [];
          let priceText = null;
          let titleText = null;
          let totalShadowRoots = 0;

          // Recursive collector matching Browsy's collectAccessibleRoots
          function walk(root, depth = 0) {
            if (!root) return;
            if (root.shadowRoot) {
              totalShadowRoots++;
              walk(root.shadowRoot, depth + 1);
            }
            if (root.querySelectorAll) {
              const all = Array.from(root.querySelectorAll('*'));
              for (const el of all) {
                if (el.shadowRoot) {
                  totalShadowRoots++;
                  walk(el.shadowRoot, depth + 1);
                }
              }
            }
          }

          if (app) walk(app);

          if (app && app.shadowRoot) {
            // Find shop-detail inside iron-pages
            detailEl = app.shadowRoot.querySelector('shop-detail');
            if (detailEl && detailEl.shadowRoot) {
              hasDetailShadow = true;
              const h1 = detailEl.shadowRoot.querySelector('h1');
              if (h1) titleText = h1.textContent.trim();
              const price = detailEl.shadowRoot.querySelector('.price');
              if (price) priceText = price.textContent.trim();

              // Check for size options in select or buttons
              const select = detailEl.shadowRoot.querySelector('#sizeSelect, select[name="size"], select');
              if (select) {
                sizeOptions = Array.from(select.options || []).map(o => ({
                  value: o.value,
                  text: o.text.trim(),
                  disabled: o.disabled
                }));
              }
              const btns = detailEl.shadowRoot.querySelectorAll('button[class*="size"], [class*="size"] button');
              for (const b of btns) {
                sizeOptions.push({
                  value: b.textContent.trim(),
                  text: b.textContent.trim(),
                  disabled: b.disabled || b.classList.contains('disabled')
                });
              }
            }
          }

          return {
            hasApp: Boolean(app),
            hasAppShadow,
            hasDetailShadow,
            totalShadowRoots,
            titleText,
            priceText,
            sizeOptions
          };
        })()
      `,
      returnByValue: true,
      awaitPromise: true,
    });

    console.log('\n--- Real Storefront Architecture Inspection Results ---');
    console.log(JSON.stringify(evalResult.result.value, null, 2));

    ws.close();
  } finally {
    proc.kill();
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  console.error('Probe failed:', err);
  process.exit(1);
});
