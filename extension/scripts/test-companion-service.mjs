/**
 * Test Suite: Browsy Companion Service Security & Reliability
 * 
 * Verifies:
 * 1. Strict Origin Validation (eliminating substring bypass e.g. attacker-localhost.com)
 * 2. Host Header Validation (DNS rebinding protection)
 * 3. Exact CORS origin reflection (no wildcard *)
 * 4. Graceful EADDRINUSE port conflict handling
 * 5. Clean lifecycle and health check
 */

import { spawn } from 'node:child_process';
import http from 'node:http';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAllowedOrigin, isAllowedHost } from '../../backend/companion-service.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendScript = path.resolve(__dirname, '../../backend/companion-service.mjs');

const TEST_PORT = 8797;
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

let passed = 0;
let total = 0;

function it(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ${GREEN}✓${RESET} ${name}`);
  } catch (err) {
    console.error(`  ${RED}✗ ${name}${RESET}`);
    console.error(err);
    throw err;
  }
}

async function itAsync(name, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`  ${GREEN}✓${RESET} ${name}`);
  } catch (err) {
    console.error(`  ${RED}✗ ${name}${RESET}`);
    console.error(err);
    throw err;
  }
}

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  console.log(`\n${CYAN}=== BROWSY COMPANION SECURITY & RELIABILITY TEST SUITE ===${RESET}\n`);

  // --- 1. Unit Tests for Origin & Host Validation ---
  console.log(`${CYAN}--- Unit: Origin & Host Filter Rules ---${RESET}`);

  it('Allows valid Chrome extension origin', () => {
    assert.strictEqual(isAllowedOrigin('chrome-extension://abcdefghijklmnop'), true);
  });

  it('Allows valid Firefox extension origin', () => {
    assert.strictEqual(isAllowedOrigin('moz-extension://abcdefghijklmnop'), true);
  });

  it('Allows 127.0.0.1 loopback origin', () => {
    assert.strictEqual(isAllowedOrigin('http://127.0.0.1:3000'), true);
    assert.strictEqual(isAllowedOrigin('https://127.0.0.1:8765'), true);
  });

  it('Allows localhost loopback origin', () => {
    assert.strictEqual(isAllowedOrigin('http://localhost:3000'), true);
    assert.strictEqual(isAllowedOrigin('http://localhost:8765'), true);
  });

  it('STRICTLY BLOCKS attacker-localhost.com bypass attempt', () => {
    assert.strictEqual(isAllowedOrigin('https://attacker-localhost.com'), false);
    assert.strictEqual(isAllowedOrigin('http://evil-localhost.org:8080'), false);
    assert.strictEqual(isAllowedOrigin('https://sub.localhost.attacker.com'), false);
  });

  it('STRICTLY BLOCKS attacker-127.0.0.1.com bypass attempt', () => {
    assert.strictEqual(isAllowedOrigin('https://attacker-127.0.0.1.com'), false);
    assert.strictEqual(isAllowedOrigin('http://malicious127.0.0.1.org'), false);
  });

  it('STRICTLY BLOCKS remote commercial websites and null origins', () => {
    assert.strictEqual(isAllowedOrigin('https://www.amazon.in'), false);
    assert.strictEqual(isAllowedOrigin('https://www.google.com'), false);
    assert.strictEqual(isAllowedOrigin('null'), false);
    assert.strictEqual(isAllowedOrigin(''), false);
  });

  it('Validates Host header strictly for loopback', () => {
    assert.strictEqual(isAllowedHost('127.0.0.1:8765'), true);
    assert.strictEqual(isAllowedHost('localhost:8765'), true);
    assert.strictEqual(isAllowedHost('127.0.0.1'), true);
    assert.strictEqual(isAllowedHost('rebound-domain.evil.com'), false);
  });

  // --- 2. Live HTTP Integration Server Tests ---
  console.log(`\n${CYAN}--- Live Server: Security & Port Conflict Verification ---${RESET}`);

  // Note: the test file already imported companion-service.mjs which runs default on 8765.
  // Now let's spawn a separate process on TEST_PORT (8797)
  const child = spawn(process.execPath, [backendScript], {
    env: { ...process.env, BROWSY_COMPANION_PORT: String(TEST_PORT) },
    stdio: 'pipe',
  });

  // Wait for server to become ready
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server failed to start within 5s')), 5000);
    child.stdout.on('data', (d) => {
      if (d.toString().includes('Listening strictly on')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.stderr.on('data', (d) => {
      // console.error('[Test Server Stderr]:', d.toString());
    });
  });

  try {
    await itAsync('Responds 200 on /api/status for loopback requests', async () => {
      const res = await request({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/status',
        method: 'GET',
        headers: {
          'Host': `127.0.0.1:${TEST_PORT}`,
          'Origin': 'http://127.0.0.1:3000',
        },
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers['access-control-allow-origin'], 'http://127.0.0.1:3000');
      const body = JSON.parse(res.body);
      assert.ok('hardware' in body);
      assert.ok('activeModel' in body);
    });

    await itAsync('STRICTLY BLOCKS cross-origin requests from attacker-localhost.com with HTTP 403', async () => {
      const res = await request({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/status',
        method: 'GET',
        headers: {
          'Host': `127.0.0.1:${TEST_PORT}`,
          'Origin': 'https://attacker-localhost.com',
        },
      });
      assert.strictEqual(res.statusCode, 403);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'Access denied: origin not permitted.');
      // Ensure no CORS header was granted
      assert.strictEqual(res.headers['access-control-allow-origin'], undefined);
    });

    await itAsync('STRICTLY BLOCKS DNS rebinding attempts with invalid Host header with HTTP 403', async () => {
      const res = await request({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/status',
        method: 'GET',
        headers: {
          'Host': 'attacker-rebound.com',
        },
      });
      assert.strictEqual(res.statusCode, 403);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.error, 'Access denied: invalid host header.');
    });

    await itAsync('OPTIONS preflight returns 204 with exact origin reflection and no wildcard', async () => {
      const res = await request({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/intent',
        method: 'OPTIONS',
        headers: {
          'Host': `127.0.0.1:${TEST_PORT}`,
          'Origin': 'chrome-extension://abcdefghijklmnop',
        },
      });
      assert.strictEqual(res.statusCode, 204);
      assert.strictEqual(res.headers['access-control-allow-origin'], 'chrome-extension://abcdefghijklmnop');
      assert.notStrictEqual(res.headers['access-control-allow-origin'], '*');
    });

    await itAsync('Port conflict (EADDRINUSE) outputs actionable diagnostic and exits cleanly with code 1', async () => {
      const conflictingChild = spawn(process.execPath, [backendScript], {
        env: { ...process.env, BROWSY_COMPANION_PORT: String(TEST_PORT) },
        stdio: 'pipe',
      });

      let errOutput = '';
      conflictingChild.stderr.on('data', (d) => (errOutput += d.toString()));

      const exitCode = await new Promise((resolve) => {
        conflictingChild.on('close', (code) => resolve(code));
      });

      assert.strictEqual(exitCode, 1);
      assert.ok(errOutput.includes(`Port ${TEST_PORT} is already in use`));
      assert.ok(errOutput.includes('stop-companion.bat'));
    });

  } finally {
    // Teardown test server
    child.kill('SIGTERM');
  }

  console.log(`\n====================================================`);
  console.log(`🎉 ALL COMPANION SERVICE SECURITY TESTS PASSED: ${passed}/${total}`);
  console.log(`====================================================\n`);
}

run().catch((err) => {
  console.error('\n❌ Companion security test suite failed:', err);
  process.exit(1);
});
