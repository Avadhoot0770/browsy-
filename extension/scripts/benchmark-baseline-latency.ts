/**
 * Browsy Baseline & End-to-End Latency Benchmark
 * Measures before-and-after timings across the full request lifecycle:
 * 1. Submission to acknowledgment
 * 2. Intent parsing (Ollama vs Fast-path)
 * 3. Plan generation
 * 4. DOM analysis
 * 5. Candidate inspection & verification
 * 6. Total wall-clock time
 */

import { performance } from "node:perf_hooks";
import { IntentEngine } from "../src/intent";
import { generateActionPlan } from "../src/intent/planner";
import { verifyProductAttributes } from "../src/execution/product-verifier";
import { verifyFinalWebsiteState } from "../src/navigation/final-state-verifier";
import type { StructuredPageIntelligence } from "../src/page-intelligence/types";

async function measureBaseline() {
  console.log("======================================================================");
  console.log("📊 BROWSY BASELINE WORKFLOW LATENCY BENCHMARK (10 TRIALS)");
  console.log("   Query: 'Find me a red checked shirt in size XL under ₹1,000'");
  console.log("======================================================================\n");

  const engine = new IntentEngine();
  const query = "Find me a red checked shirt in size XL under ₹1,000";

  const mockPage: StructuredPageIntelligence = {
    url: "https://www.myntra.com/shirts",
    hostname: "www.myntra.com",
    pathname: "/shirts",
    title: "Shirts for Men",
    summary: "Myntra Shirts Catalog",
    headings: [{ level: 1, text: "Shirts for Men" }],
    searchInputs: [{ elementId: "browsy-el-001", type: "search", role: "searchbox", tagName: "input", text: "", placeholder: "Search for products", disabled: false, bounds: { x: 0, y: 0, width: 200, height: 40 } }],
    inputs: [],
    buttons: [],
    links: [],
    forms: [],
    detectedPrices: [],
    detectedRatings: [],
    keyImages: [],
    stats: {
      analysisDurationMs: 3,
      totalInteractiveCount: 1,
      buttonCount: 0,
      linkCount: 0,
      inputCount: 1,
      searchCount: 1,
      formCount: 0,
      repeatedItemCount: 1,
      repeatedGroupCount: 1,
      headingCount: 1,
      imageCount: 0,
      priceCount: 1,
      ratingCount: 0,
      timestamp: Date.now(),
    },
    timestamp: Date.now(),
    repeatedGroups: [
      {
        containerSelector: ".results",
        inferredType: "product-like",
        count: 1,
        items: [
          {
            elementId: "browsy-el-010",
            title: "Roadster Men Red & Navy Checked Casual Shirt",
            price: { raw: "₹799", amount: 799, currency: "INR" },
            link: { href: "https://www.myntra.com/shirt-123" },
            bounds: { x: 0, y: 0, width: 200, height: 300 },
          },
        ],
      },
    ],
  };

  const mockPdpDoc = {
    tagName: "DIV",
    textContent: "Roadster Men Red & Navy Checked Casual Shirt ₹799 Size: XL in stock",
    querySelector: (sel: string) => {
      if (sel.includes("price")) return { textContent: "₹799" };
      if (sel.includes("size") || sel.includes("button")) return { textContent: "XL", hasAttribute: () => false };
      return null;
    },
    querySelectorAll: (sel: string) => {
      if (sel.includes("size") || sel.includes("button")) return [{ textContent: "XL", hasAttribute: () => false }];
      return [];
    },
  };

  const trials = 10;
  const intentLatencies: number[] = [];
  const planLatencies: number[] = [];
  const verifyLatencies: number[] = [];
  const totalLatencies: number[] = [];

  for (let i = 0; i < trials; i++) {
    const tStart = performance.now();

    // 1. Intent Parsing
    const t0 = performance.now();
    const intentRes = await engine.processRequest(query, mockPage);
    const intentMs = performance.now() - t0;
    intentLatencies.push(intentMs);

    // 2. Plan Generation
    const t1 = performance.now();
    const plan = generateActionPlan(intentRes.intent, mockPage);
    const planMs = performance.now() - t1;
    planLatencies.push(planMs);

    // 3. Product Attribute Verification
    const t2 = performance.now();
    const pVerify = verifyProductAttributes(
      mockPdpDoc,
      intentRes.intent,
      mockPage.repeatedGroups[0].items[0].title,
      mockPage.repeatedGroups[0].items[0].price
    );
    const fVerify = verifyFinalWebsiteState(mockPage, intentRes.intent, {
      verifiedCandidateProducts: [
        {
          elementId: "browsy-el-010",
          title: "Roadster Men Red & Navy Checked Casual Shirt",
          price: { raw: "₹799", amount: 799, currency: "INR" },
          matchClassification: "confirmed",
          score: 10,
          verifiedConditions: ["Category verified", "Color verified", "Pattern verified", "Price verified", "Size XL in stock"],
          unverifiedConditions: [],
          reasons: ["Verified"],
          productResult: pVerify,
        },
      ],
    });
    const verifyMs = performance.now() - t2;
    verifyLatencies.push(verifyMs);

    const totalMs = performance.now() - tStart;
    totalLatencies.push(totalMs);

    console.log(`Trial ${i + 1}/${trials}: Intent=${intentMs.toFixed(1)}ms, Plan=${planMs.toFixed(2)}ms, Verify=${verifyMs.toFixed(2)}ms, Total=${totalMs.toFixed(1)}ms -> Final State: ${fVerify.status}`);
  }

  function getStats(arr: number[]) {
    const s = [...arr].sort((a, b) => a - b);
    return {
      median: s[Math.floor(s.length / 2)],
      p95: s[Math.floor(s.length * 0.95)] || s[s.length - 1],
      min: s[0],
      max: s[s.length - 1],
    };
  }

  console.log("\n----------------------------------------------------------------------");
  console.log("BASELINE MEASUREMENT RESULTS (10 Trials):");
  console.log("----------------------------------------------------------------------");
  const iStats = getStats(intentLatencies);
  const pStats = getStats(planLatencies);
  const vStats = getStats(verifyLatencies);
  const tStats = getStats(totalLatencies);

  console.log(`Stage 1 (Intent Parsing):       Median: ${iStats.median.toFixed(1)} ms | p95: ${iStats.p95.toFixed(1)} ms | Min: ${iStats.min.toFixed(1)} ms | Max: ${iStats.max.toFixed(1)} ms`);
  console.log(`Stage 2 (Plan Generation):      Median: ${pStats.median.toFixed(2)} ms | p95: ${pStats.p95.toFixed(2)} ms`);
  console.log(`Stage 5-6 (Verification & UI):  Median: ${vStats.median.toFixed(2)} ms | p95: ${vStats.p95.toFixed(2)} ms`);
  console.log(`Total End-to-End Wall-Clock:    Median: ${tStats.median.toFixed(1)} ms | p95: ${tStats.p95.toFixed(1)} ms`);
  console.log("----------------------------------------------------------------------\n");
}

measureBaseline().catch(console.error);
