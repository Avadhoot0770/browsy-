/**
 * Browsy Fast-Path Extraction Audit
 * Verifies that the deterministic fast path accurately extracts:
 * - Product category
 * - Colour
 * - Pattern
 * - Size
 * - Budget / Max Price
 * - Currency
 * - Confidence score (>= 0.92)
 * - Clarification status (false for unambiguous queries)
 */

import assert from "node:assert";
import { IntentEngine } from "../src/intent";
import { CompositeAIProvider, HeuristicLocalProvider } from "../src/intent/provider";

async function auditFastPath() {
  console.log("======================================================================");
  console.log("🔍 BROWSY AUDIT: DETERMINISTIC FAST-PATH ENTITY EXTRACTION");
  console.log("======================================================================\n");

  const engine = new IntentEngine();
  const provider = new CompositeAIProvider();
  const heuristic = new HeuristicLocalProvider();

  const testCases = [
    {
      query: "Find me a red checked shirt in size XL under ₹1,000",
      expectedCategory: "shirt",
      expectedColor: "red",
      expectedPattern: "checked",
      expectedSize: "XL",
      expectedPrice: 1000,
      expectedCurrency: "INR",
    },
    {
      query: "Find blue plaid cotton shirt size M under Rs 500",
      expectedCategory: "shirt",
      expectedColor: "blue",
      expectedPattern: "plaid",
      expectedSize: "M",
      expectedPrice: 500,
      expectedCurrency: "INR",
    },
    {
      query: "Men black striped trousers size 32 under 2000 INR",
      expectedCategory: "trousers",
      expectedColor: "black",
      expectedPattern: "striped",
      expectedSize: "32",
      expectedPrice: 2000,
      expectedCurrency: "INR",
    },
    {
      query: "White solid sneakers size 10 under $100",
      expectedCategory: "sneakers",
      expectedColor: "white",
      expectedPattern: "solid",
      expectedSize: "10",
      expectedPrice: 100,
      expectedCurrency: "USD",
    },
  ];

  for (const tc of testCases) {
    console.log(`Input Query: "${tc.query}"`);
    const result = await engine.processRequest(tc.query, null);
    const intent = result.intent;

    console.log("Extracted Structured Intent:");
    console.log(`  - Intent Type:  ${intent.intent}`);
    console.log(`  - Target Type:  ${intent.target}`);
    console.log(`  - Category:     ${intent.entities.category} (Expected: ${tc.expectedCategory})`);
    console.log(`  - Color:        ${intent.filters.color} (Expected: ${tc.expectedColor})`);
    console.log(`  - Pattern:      ${intent.filters.pattern} (Expected: ${tc.expectedPattern})`);
    console.log(`  - Size:         ${intent.filters.size} (Expected: ${tc.expectedSize})`);
    console.log(`  - Max Price:    ${intent.constraints.maxPrice} (Expected: ${tc.expectedPrice})`);
    console.log(`  - Currency:     ${intent.constraints.currency} (Expected: ${tc.expectedCurrency})`);
    console.log(`  - Confidence:   ${intent.confidence}`);
    console.log(`  - Clarification:${intent.requiresClarification}`);

    assert.strictEqual(intent.entities.category, tc.expectedCategory, `Category mismatch for: ${tc.query}`);
    assert.strictEqual(intent.filters.color, tc.expectedColor, `Color mismatch for: ${tc.query}`);
    assert.strictEqual(intent.filters.pattern, tc.expectedPattern, `Pattern mismatch for: ${tc.query}`);
    assert.strictEqual(intent.filters.size, tc.expectedSize, `Size mismatch for: ${tc.query}`);
    assert.strictEqual(intent.constraints.maxPrice, tc.expectedPrice, `Price mismatch for: ${tc.query}`);
    assert.strictEqual(intent.constraints.currency, tc.expectedCurrency, `Currency mismatch for: ${tc.query}`);
    assert.ok(intent.confidence >= 0.92, `Confidence should be >= 0.92 (was: ${intent.confidence})`);
    assert.strictEqual(intent.requiresClarification, false, `Unambiguous query should not require clarification`);

    console.log("  -> Result: PASS ✓\n");
  }

  console.log("======================================================================");
  console.log("🎉 ALL FAST-PATH ATTRIBUTE EXTRACTIONS VERIFIED 100% ACCURATE");
  console.log("======================================================================\n");
}

auditFastPath().catch((err) => {
  console.error("Audit error:", err);
  process.exit(1);
});
