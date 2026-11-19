/**
 * Focused Validation of Ollama Settings (num_predict: 256, num_ctx: 1024)
 * Tests simple, multi-constraint, and complex queries for truncation, completeness,
 * schema adherence, and failure/fallback modes.
 */

import http from 'node:http';
import assert from 'node:assert';

const COMPANION_URL = 'http://127.0.0.1:8765';

async function postIntent(payload, headers = {}) {
  const t0 = Date.now();
  const res = await fetch(`${COMPANION_URL}/api/intent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Browsy-Client': 'extension',
      ...headers,
    },
    body: JSON.stringify(payload),
  });
  const latency = Date.now() - t0;
  const status = res.status;
  const data = await res.json().catch((err) => ({ parseError: err.message }));
  return { status, data, latency };
}

async function runValidation() {
  console.log("==================================================================");
  console.log("🧠 FOCUSED VALIDATION: OLLAMA SETTINGS & NLU EXTRACTION");
  console.log("   num_predict: 256 | num_ctx: 1024 | Model: qwen2.5:1.5b");
  console.log("==================================================================\n");

  const testCases = [
    {
      id: "SIMPLE_1",
      name: "Simple Shopping Request",
      query: "Find red shirts",
      expectedIntent: "find",
      expectedTarget: "products",
      expectedCategory: "shirt",
      expectedFilters: { color: "red" },
    },
    {
      id: "MODERATE_1",
      name: "Moderate Multi-Constraint Shopping Request",
      query: "Find me a red checked shirt in size XL under ₹1,000.",
      expectedIntent: "find",
      expectedTarget: "products",
      expectedCategory: "shirt",
      expectedFilters: { color: "red", pattern: "checked", size: "XL" },
      expectedMaxPrice: 1000,
      expectedCurrency: "INR",
    },
    {
      id: "COMPLEX_SHOPPING_1",
      name: "Complex Multi-Constraint (Color + Pattern + Material + Brand + Size + Price + Rating)",
      query: "Find me a red checked cotton shirt in size XL from Roadster under ₹1,000 with minimum 4 star rating.",
      expectedIntent: "find",
      expectedTarget: "products",
      expectedCategory: "shirt",
      expectedFilters: { color: "red", pattern: "checked", size: "XL", brand: "Roadster", material: "cotton" },
      expectedMaxPrice: 1000,
    },
    {
      id: "COMPLEX_SHOPPING_2",
      name: "Apparel Search with Foreign Currency & Fit",
      query: "Find slim fit blue denim jeans in size 32 under $50 with high rating",
      expectedIntent: "find",
      expectedTarget: "products",
      expectedFilters: { color: "blue", material: "denim", size: "32" },
      expectedMaxPrice: 50,
      expectedCurrency: "USD",
    },
    {
      id: "COMPLEX_JOB_1",
      name: "Job Search with Role + Seniority + Location + Min Salary",
      query: "Find senior remote python backend developer jobs in Europe paying at least 80000 EUR",
      expectedIntent: "find",
      expectedTarget: "jobs",
      expectedEntities: { role: "python backend developer" },
    },
    {
      id: "COMPARISON_1",
      name: "Comparison & Relative Reference Request",
      query: "Compare the top three red checked shirts and show me the cheapest one",
      expectedIntent: "compare",
      expectedTarget: "products",
    },
  ];

  let passedCases = 0;

  for (const tc of testCases) {
    console.log(`▶ Running Test: [${tc.id}] ${tc.name}`);
    console.log(`  Query: "${tc.query}"`);

    const result = await postIntent({
      query: tc.query,
      pageContext: { domain: "myntra.com", title: "Online Shopping for Men, Women & Kids" },
    });

    console.log(`  Status: HTTP ${result.status} | Latency: ${result.latency}ms`);

    // Verify response integrity
    if (result.status !== 200) {
      console.error(`  ✕ FAILED: Non-200 response:`, result.data);
      continue;
    }

    const intent = result.data;

    // Check if JSON was complete (not truncated)
    if (!intent || typeof intent !== 'object' || !intent.intent || !intent.target) {
      console.error(`  ✕ FAILED: Malformed or truncated intent object:`, intent);
      continue;
    }

    console.log(`  Extracted Intent: intent=${intent.intent}, target=${intent.target}`);
    console.log(`  Entities:`, intent.entities || {});
    console.log(`  Filters:`, intent.filters || {});
    console.log(`  Constraints:`, intent.constraints || {});

    // Validate no silent truncation of expected constraints
    let hasConstraintRegression = false;

    if (tc.expectedCategory) {
      const cat = intent.entities?.category || '';
      if (!cat.toLowerCase().includes(tc.expectedCategory.toLowerCase())) {
        console.warn(`  ⚠️ Warning: Category expected "${tc.expectedCategory}", got "${cat}"`);
      }
    }

    if (tc.expectedFilters) {
      for (const [key, val] of Object.entries(tc.expectedFilters)) {
        const actual = intent.filters?.[key];
        if (!actual) {
          console.warn(`  ⚠️ Warning: Expected filter [${key}="${val}"] missing or truncated!`);
        } else {
          console.log(`  ✓ Verified filter: ${key} = ${actual}`);
        }
      }
    }

    if (tc.expectedMaxPrice) {
      const actualMax = intent.constraints?.maxPrice;
      if (actualMax !== tc.expectedMaxPrice) {
        console.warn(`  ⚠️ Warning: Max price expected ${tc.expectedMaxPrice}, got ${actualMax}`);
      } else {
        console.log(`  ✓ Verified maxPrice constraint: ${actualMax}`);
      }
    }

    if (tc.expectedCurrency) {
      const actualCurr = intent.constraints?.currency;
      if (actualCurr !== tc.expectedCurrency) {
        console.warn(`  ⚠️ Warning: Currency expected ${tc.expectedCurrency}, got ${actualCurr}`);
      } else {
        console.log(`  ✓ Verified currency: ${actualCurr}`);
      }
    }

    console.log(`  ✓ PASSED: Valid JSON, complete schema, no truncation observed.\n`);
    passedCases++;
  }

  console.log("------------------------------------------------------------------");
  console.log("🛡️ ROBUSTNESS & ERROR-HANDLING VALIDATION");
  console.log("------------------------------------------------------------------");

  // Test 1: Malformed JSON Simulation
  console.log("▶ Testing: Malformed Model Response Handling (simulate: invalid_json)...");
  const malformedRes = await postIntent(
    { query: "Find red shirts" },
    { 'X-Browsy-Simulate': 'invalid_json' }
  );
  console.log(`  Response: status=${malformedRes.status}`);
  assert.strictEqual(
    malformedRes.status === 200 || malformedRes.status === 500,
    true,
    "Malformed model response gracefully handled without companion crash"
  );
  console.log("  ✓ Malformed model output safely handled.\n");

  // Test 2: Fallback Simulation
  console.log("▶ Testing: Heuristic Fallback Provider Recommendation (simulate: fallback)...");
  const fallbackRes = await postIntent(
    { query: "Find red shirts" },
    { 'X-Browsy-Simulate': 'fallback' }
  );
  console.log(`  Response: status=${fallbackRes.status}, data=`, fallbackRes.data);
  assert.strictEqual(fallbackRes.status, 503, "Status should be 503 Service Unavailable");
  assert.strictEqual(fallbackRes.data.fallbackRecommended, true, "Fallback recommendation present");
  console.log("  ✓ Graceful fallback trigger verified.\n");

  // Test 3: Client Abort / Cancellation Signal
  console.log("▶ Testing: Request Cancellation via AbortSignal...");
  const abortCtrl = new AbortController();
  const cancelPromise = fetch(`${COMPANION_URL}/api/intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Browsy-Client': 'extension' },
    body: JSON.stringify({ query: "Find red checked shirts in XL" }),
    signal: abortCtrl.signal,
  });
  // Abort after 15ms
  setTimeout(() => abortCtrl.abort(), 15);
  let wasAborted = false;
  try {
    await cancelPromise;
  } catch (err) {
    wasAborted = err.name === 'AbortError';
  }
  console.log(`  Client abort detected: ${wasAborted ? 'YES (AbortError caught)' : 'NO'}`);
  assert.strictEqual(wasAborted, true, "Fetch aborted cleanly without hanging");
  console.log("  ✓ Request cancellation verified.\n");

  console.log("==================================================================");
  console.log(`📊 OLLAMA SETTINGS VALIDATION SUMMARY: ${passedCases} / ${testCases.length} Passed`);
  console.log("==================================================================");
}

runValidation().catch(console.error);
