/**
 * Automated validation of Companion Service Tooling & Lifecycle
 * Tests startup, status API, Ollama live & simulated offline handling, EADDRINUSE conflict, shutdown, and restart.
 */

import { spawn, execSync } from 'node:child_process';
import http from 'node:http';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const companionScript = path.resolve(rootDir, 'backend/companion-service.mjs');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchStatus(query = '') {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:8765/api/status${query}`, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log("==================================================================");
  console.log("🛠️  BROWSY COMPANION SERVICE TOOLING & LIFECYCLE VALIDATION");
  console.log("==================================================================\n");

  // Step 1: Ensure port 8765 is clear initially
  console.log("1. Checking initial port 8765 state...");
  try {
    execSync('netstat -ano | findstr :8765 | findstr LISTENING', { stdio: 'pipe' });
    console.log("   Port 8765 is currently in use. Cleaning up with stop-companion logic...");
    const stopBat = path.resolve(rootDir, 'backend/scripts/stop-companion.bat');
    execSync(`cmd /c "${stopBat}" < nul`, { stdio: 'pipe' });
    await sleep(1000);
  } catch {
    console.log("   ✓ Port 8765 is free.");
  }

  // Step 2: Spawn companion service
  console.log("\n2. Spawning companion service (node backend/companion-service.mjs)...");
  const companionProc = spawn('node', [companionScript], {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  companionProc.stdout.on('data', (d) => (output += d.toString()));
  companionProc.stderr.on('data', (d) => (output += d.toString()));

  // Wait for server to bind
  let connected = false;
  let statusData = null;
  for (let i = 0; i < 20; i++) {
    await sleep(300);
    try {
      const res = await fetchStatus();
      if (res.status === 200) {
        connected = true;
        statusData = res.body;
        break;
      }
    } catch {}
  }

  assert.ok(connected, "Companion service did not start or respond on port 8765!");
  console.log("   ✓ Companion service successfully listening on http://127.0.0.1:8765");
  console.log(`   Status Response:`, statusData);
  assert.ok(statusData.status === 'connected' || statusData.status === 'unavailable');
  assert.strictEqual(typeof statusData.ollamaRunning, 'boolean');
  assert.ok(statusData.hardware);
  assert.strictEqual(typeof statusData.hardware.totalMemGB, 'number');
  console.log(`   Ollama detected: ${statusData.ollamaRunning} (Active model: ${statusData.activeModel})`);

  // Step 3: Test simulated offline status endpoint
  console.log("\n3. Testing offline status handling (?simulate=offline)...");
  const offlineRes = await fetchStatus('?simulate=offline');
  assert.strictEqual(offlineRes.status, 200);
  assert.strictEqual(offlineRes.body.status, 'unavailable');
  assert.strictEqual(offlineRes.body.ollamaRunning, false);
  console.log("   ✓ Successfully handles offline Ollama state: reports 'unavailable' cleanly.");

  // Step 4: Test EADDRINUSE conflict handling
  console.log("\n4. Testing EADDRINUSE port conflict handling...");
  const conflictProc = spawn('node', [companionScript], {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let conflictExitCode = null;
  let conflictOutput = '';
  conflictProc.stdout.on('data', (d) => (conflictOutput += d.toString()));
  conflictProc.stderr.on('data', (d) => (conflictOutput += d.toString()));

  await new Promise((resolve) => {
    conflictProc.on('exit', (code) => {
      conflictExitCode = code;
      resolve();
    });
  });

  assert.strictEqual(conflictExitCode, 1, "Conflict process should exit with code 1");
  assert.ok(conflictOutput.includes("EADDRINUSE") || conflictOutput.includes("already in use"), "Conflict process should log actionable EADDRINUSE error");
  console.log("   ✓ Duplicate process exited cleanly with code 1 and logged diagnostic guidance.");

  // Step 5: Test shutdown via stop-companion logic
  console.log("\n5. Testing shutdown with stop-companion logic...");
  companionProc.kill();
  await sleep(600);

  let portFreed = false;
  try {
    await fetchStatus();
  } catch {
    portFreed = true;
  }
  assert.ok(portFreed, "Port 8765 should be offline after termination");
  console.log("   ✓ Process terminated cleanly and port 8765 is offline.");

  // Step 6: Test restart recovery
  console.log("\n6. Testing restart recovery...");
  const restartProc = spawn('node', [companionScript], {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  connected = false;
  for (let i = 0; i < 20; i++) {
    await sleep(300);
    try {
      const res = await fetchStatus();
      if (res.status === 200) {
        connected = true;
        break;
      }
    } catch {}
  }
  assert.ok(connected, "Companion service did not recover on restart!");
  console.log("   ✓ Companion service successfully restarted and healthy on port 8765.");

  restartProc.kill();
  await sleep(600);
  console.log("   ✓ Cleaned up restarted process.");

  console.log("\n==================================================================");
  console.log("🎉 ALL COMPANION TOOLING VALIDATION TESTS PASSED 100%!");
  console.log("==================================================================");
}

main().catch((err) => {
  console.error("Tooling validation failed:", err);
  process.exit(1);
});
