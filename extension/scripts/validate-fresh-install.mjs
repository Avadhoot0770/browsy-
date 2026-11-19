/**
 * Browsy Phase 3 Validation: Step 1 - Fresh Installation Testing
 * 
 * Verifies from the perspective of a brand new user:
 * 1. Extraction of the actual website ZIP distribution archive
 * 2. Manifest integrity and asset presence
 * 3. Fresh Chrome browser profile launch with --load-extension
 * 4. Background service worker discovery and lifecycle
 * 5. Content script injection into host webpage DOM (#browsy-host)
 * 6. Extension popup rendering
 * 7. Persistence across full browser restart
 */

import { spawn } from 'node:child_process';
import http from 'node:http';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const zipPath = path.resolve(projectRoot, 'website/public/downloads/browsy-extension-dist.zip');
const extractDir = path.resolve(projectRoot, 'extension/.fresh-extract-test');
const cleanProfileDir = path.resolve(projectRoot, 'extension/.fresh-chrome-profile');
const BRAVE_PATH = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BROWSER_PATH = fs.existsSync(BRAVE_PATH) ? BRAVE_PATH : CHROME_PATH;
const BROWSER_NAME = BROWSER_PATH === BRAVE_PATH ? "Brave" : "Chrome";

const CDP_PORT = 9230;
const HTTP_PORT = 8088;

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendCdp(ws, method, params = {}) {
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
  const res = await sendCdp(ws, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return res?.result?.value;
}

// Start lightweight test server
function startTestServer() {
  const html = `<!DOCTYPE html>
<html>
<head><title>Browsy Fresh Install Test</title></head>
<body>
  <h1>Welcome to Store</h1>
  <div id="product-list">
    <div class="product" data-price="999">Red Checked Shirt - ₹999</div>
  </div>
</body>
</html>`;

  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  return new Promise((resolve) => {
    server.listen(HTTP_PORT, '127.0.0.1', () => resolve(server));
  });
}

// Unzip helper using PowerShell Expand-Archive
function extractZip() {
  if (fs.existsSync(extractDir)) {
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
  fs.mkdirSync(extractDir, { recursive: true });

  const psCmd = `Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force`;
  const { execSync } = import('node:child_process');
  import('node:child_process').then(({ execSync }) => {
    execSync(`powershell -NoProfile -Command "${psCmd}"`, { stdio: 'inherit' });
  });
}

async function run() {
  console.log(`\n${CYAN}================================================================${RESET}`);
  console.log(`${CYAN}🔍 BROWSY PHASE 3: STEP 1 — FRESH INSTALLATION & LIFECYCLE${RESET}`);
  console.log(`${CYAN}================================================================${RESET}\n`);

  // 1. Verify and extract downloaded ZIP
  console.log(`1. Inspecting website downloadable ZIP: ${zipPath}`);
  assert.ok(fs.existsSync(zipPath), `Distribution ZIP must exist at ${zipPath}`);
  const zipStat = fs.statSync(zipPath);
  console.log(`   ZIP size: ${zipStat.size.toLocaleString()} bytes`);

  if (fs.existsSync(extractDir)) {
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
  fs.mkdirSync(extractDir, { recursive: true });

  const { execSync } = await import('node:child_process');
  console.log(`   Extracting with tar to ${extractDir}...`);
  execSync(`tar -xf "${zipPath}" -C "${extractDir}"`);

  // 2. Validate extracted manifest & symbols
  const manifestPath = path.join(extractDir, 'manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'manifest.json missing in extracted archive');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`   ${GREEN}✓${RESET} Valid manifest.json found:`);
  console.log(`     Name: ${manifest.name}`);
  console.log(`     Version: ${manifest.version}`);
  console.log(`     Manifest Version: ${manifest.manifest_version}`);
  console.log(`     Permissions: ${JSON.stringify(manifest.permissions)}`);
  console.log(`     Service Worker: ${manifest.background?.service_worker}`);

  // Confirm referenced files exist
  const swPath = path.join(extractDir, manifest.background.service_worker);
  const csPath = path.join(extractDir, manifest.content_scripts[0].js[0]);
  assert.ok(fs.existsSync(swPath), 'Service worker bundle missing');
  assert.ok(fs.existsSync(csPath), 'Content script bundle missing');
  console.log(`   ${GREEN}✓${RESET} Referenced runtime bundles verified on disk.`);

  // 3. Prepare clean profile and start local test server
  if (fs.existsSync(cleanProfileDir)) {
    fs.rmSync(cleanProfileDir, { recursive: true, force: true });
  }
  fs.mkdirSync(cleanProfileDir, { recursive: true });
  fs.writeFileSync(path.join(cleanProfileDir, 'First Run'), '');

  const testServer = await startTestServer();
  console.log(`   ${GREEN}✓${RESET} Local test webserver running on http://127.0.0.1:${HTTP_PORT}`);

  // Normalize forward slash path for Chromium CLI
  const extLoadPath = extractDir.replace(/\\/g, '/');

  // 4. Launch Clean Browser instance with extracted extension
  console.log(`\n2. Launching fresh ${BROWSER_NAME} profile with loaded extension...`);
  console.log(`   Browser: ${BROWSER_PATH}`);
  console.log(`   User Data Dir: ${cleanProfileDir}`);
  console.log(`   Extension: ${extLoadPath}`);

  let browserProc = spawn(BROWSER_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${cleanProfileDir}`,
    `--load-extension=${extLoadPath}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-fre',
    `http://127.0.0.1:${HTTP_PORT}/`,
  ]);

  let extensionId = null;

  try {
    // Connect to CDP Browser WebSocket to inspect all targets (with retry loop)
    let verData = null;
    for (let i = 0; i < 25; i++) {
      await sleep(400);
      try {
        const verRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
        if (verRes.ok) {
          verData = await verRes.json();
          break;
        }
      } catch {}
    }
    assert.ok(verData, 'Failed to connect to Chrome CDP endpoint within timeout');
    console.log(`   Chrome Browser Version: ${verData.Browser}`);

    const browserWs = new WebSocket(verData.webSocketDebuggerUrl);
    await new Promise((resolve) => browserWs.addEventListener('open', resolve));

    let targetInfos = [];
    for (let i = 0; i < 20; i++) {
      const res = await sendCdp(browserWs, 'Target.getTargets');
      targetInfos = res.targetInfos || [];
      const sw = targetInfos.find((t) => t.type === 'service_worker');
      if (sw) break;
      await sleep(300);
    }
    console.log('   All targets via Target.getTargets:', targetInfos.map(t => ({ type: t.type, url: t.url })));

    // Find Service Worker target
    const swTarget = targetInfos.find((t) => t.type === 'service_worker' && t.url.includes('chrome-extension://'));
    assert.ok(swTarget, 'Background service worker target not found in Chrome!');
    console.log(`   ${GREEN}✓${RESET} Background Service Worker active: ${swTarget.url}`);

    const extMatch = swTarget.url.match(/chrome-extension:\/\/([a-z0-9]+)\//);
    extensionId = extMatch ? extMatch[1] : null;
    console.log(`   ${GREEN}✓${RESET} Detected Extension ID: ${extensionId}`);

    // Find Web Page target
    const listRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const pageTargets = await listRes.json();
    const pageTarget = pageTargets.find((t) => t.type === 'page');
    assert.ok(pageTarget, 'Web page target not found');
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve) => ws.addEventListener('open', resolve));

    // Wait for content script injection
    console.log(`\n3. Verifying content script injection into web page...`);
    let hostMounted = false;
    for (let i = 0; i < 15; i++) {
      await sleep(400);
      hostMounted = await evaluate(ws, `Boolean(document.getElementById('browsy-extension-root'))`);
      if (hostMounted) break;
    }
    assert.ok(hostMounted, 'Shadow DOM host #browsy-extension-root was not injected by content script!');
    console.log(`   ${GREEN}✓${RESET} Shadow DOM Host (#browsy-extension-root) mounted in webpage DOM!`);

    // Verify Shadow DOM isolation
    const shadowAttached = await evaluate(ws, `Boolean(document.getElementById('browsy-extension-root')?.shadowRoot)`);
    assert.ok(shadowAttached, '#browsy-extension-root does not have an attached shadowRoot!');
    console.log(`   ${GREEN}✓${RESET} Shadow Root successfully attached (isolated styles & DOM).`);

    // Verify Launcher button is present inside Shadow DOM
    const launcherFound = await evaluate(
      ws,
      `Boolean(document.getElementById('browsy-extension-root')?.shadowRoot?.querySelector('button'))`
    );
    assert.ok(launcherFound, 'Launcher trigger button not found in shadowRoot');
    console.log(`   ${GREEN}✓${RESET} Browsy UI launcher button rendered cleanly.`);

    // 4. Test Popup Page
    console.log(`\n4. Verifying Extension Popup UI...`);
    const popupUrl = `chrome-extension://${extensionId}/popup/index.html`;
    await sendCdp(ws, 'Page.navigate', { url: popupUrl });
    await sleep(800);

    const popupTitle = await evaluate(ws, `document.title`);
    const popupRootFound = await evaluate(ws, `Boolean(document.getElementById('popup-root'))`);
    assert.ok(popupRootFound, 'Popup root element (#popup-root) not found');
    console.log(`   ${GREEN}✓${RESET} Popup successfully rendered (${popupTitle}).`);

    // 5. Test Full Browser Restart
    console.log(`\n5. Testing Full Browser Restart Lifecycle...`);
    ws.close();
    browserProc.kill('SIGTERM');
    await sleep(1500);

    console.log(`   Re-spawning ${BROWSER_NAME} with existing profile...`);
    browserProc = spawn(BROWSER_PATH, [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${cleanProfileDir}`,
      `--load-extension=${extLoadPath}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-fre',
      `http://127.0.0.1:${HTTP_PORT}/`,
    ]);

    let restartedVerData = null;
    for (let i = 0; i < 25; i++) {
      await sleep(400);
      try {
        const restartedVerRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
        if (restartedVerRes.ok) {
          restartedVerData = await restartedVerRes.json();
          break;
        }
      } catch {}
    }
    assert.ok(restartedVerData, 'Failed to connect to restarted Chrome CDP endpoint');
    const restartedBrowserWs = new WebSocket(restartedVerData.webSocketDebuggerUrl);
    await new Promise((resolve) => restartedBrowserWs.addEventListener('open', resolve));

    let restartedTargetInfos = [];
    for (let i = 0; i < 20; i++) {
      const res = await sendCdp(restartedBrowserWs, 'Target.getTargets');
      restartedTargetInfos = res.targetInfos || [];
      const sw = restartedTargetInfos.find((t) => t.type === 'service_worker');
      if (sw) break;
      await sleep(300);
    }

    const restartedSw = restartedTargetInfos.find((t) => t.type === 'service_worker' && t.url.includes('chrome-extension://'));
    assert.ok(restartedSw, 'Service worker did not revive after browser restart');
    console.log(`   ${GREEN}✓${RESET} Service Worker revived successfully on restart.`);

    const restartedListRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const restartedTargets = await restartedListRes.json();
    const restartedPage = restartedTargets.find((t) => t.type === 'page');
    const restartedWs = new WebSocket(restartedPage.webSocketDebuggerUrl);
    await new Promise((resolve) => restartedWs.addEventListener('open', resolve));

    let reattached = false;
    for (let i = 0; i < 15; i++) {
      await sleep(400);
      reattached = await evaluate(restartedWs, `Boolean(document.getElementById('browsy-extension-root'))`);
      if (reattached) break;
    }
    assert.ok(reattached, 'Content script failed to re-attach after browser restart');
    console.log(`   ${GREEN}✓${RESET} Content Script re-attached to page after browser restart.`);
    restartedWs.close();

  } finally {
    browserProc.kill('SIGTERM');
    testServer.close();
  }

  console.log(`\n${GREEN}================================================================${RESET}`);
  console.log(`${GREEN}🎉 STEP 1: FRESH INSTALLATION & BROWSER RESTART VERIFIED 100%!${RESET}`);
  console.log(`${GREEN}================================================================${RESET}\n`);
}

run().catch((err) => {
  console.error('\n❌ Fresh installation testing failed:', err);
  process.exit(1);
});
