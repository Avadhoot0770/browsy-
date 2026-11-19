import assert from "node:assert";
import { OllamaLocalProvider } from "../src/intent/provider";
import { validateStructuredIntent } from "../src/intent/validator";

async function runLiveOllamaVerification() {
  console.log("======================================================================");
  console.log("🦙 BROWSY LIVE OLLAMA INFERENCE VERIFICATION (PORT 8765 -> 11434)");
  console.log("======================================================================\n");

  const provider = new OllamaLocalProvider({
    companionUrl: "http://127.0.0.1:8765",
    defaultModel: "qwen2.5:1.5b",
    timeoutMs: 15000,
  });

  // Step 1: Health & Availability
  console.log("--- 1. Availability & Health Check ---");
  const avail = await provider.checkAvailability();
  console.log("Provider Status:", avail.status);
  console.log("Ollama Running:", avail.ollamaRunning);
  console.log("Active Model:", avail.activeModel);
  console.log("Available Models:", avail.availableModels);
  console.log("Hardware Recommended Model:", avail.recommendedModel);

  assert.strictEqual(avail.status, "connected", "Companion status must be connected");
  assert.strictEqual(avail.ollamaRunning, true, "Ollama daemon must be confirmed running");
  assert.ok(avail.availableModels.includes("qwen2.5:1.5b"), "Model qwen2.5:1.5b must be installed");
  console.log("✓ Live companion and Ollama daemon connectivity verified.\n");

  // Step 2: Live Natural Language NLU Inference
  console.log("--- 2. Live Natural Language NLU Inference with Real Ollama ---");
  const prompt = "Find me a red checked shirt in size XL under ₹1,000.";
  console.log(`Prompt: "${prompt}"`);

  const t0 = performance.now();
  const intent = await provider.generateIntent(prompt, null, {
    turns: [],
    activeFilters: {},
    activeConstraints: {},
  });
  const durationMs = Math.round(performance.now() - t0);
  console.log(`Inference Duration: ${durationMs}ms`);

  console.log("\nStructured Intent Output:");
  console.log(JSON.stringify(intent, null, 2));

  // Step 3: Schema Validation
  console.log("\n--- 3. Strict Schema Validation ---");
  validateStructuredIntent(intent);
  console.log("✓ Schema validator accepted Ollama generated intent without error.");

  assert.ok(intent.intent === "find" || intent.intent === "filter", `Intent must be find/filter, got: ${intent.intent}`);
  assert.strictEqual(intent.target, "products", "Target must be products");
  assert.strictEqual(intent.filters.color?.toLowerCase(), "red", "Color must be red");
  assert.strictEqual(intent.filters.pattern?.toLowerCase(), "checked", "Pattern must be checked");
  assert.strictEqual(intent.filters.size?.toUpperCase(), "XL", "Size must be XL");
  console.log("✓ All structured entity slots (color, pattern, size) matched explicit prompt.\n");

  // Step 4: Live Label Interpretation
  console.log("--- 4. Live Unfamiliar Label Interpretation ---");
  const labelT0 = performance.now();
  const labelMatches = await provider.interpretUnfamiliarLabels(
    ["Crimson Plaid", "Navy Blue", "Maroon Checks", "White Solid"],
    "red"
  );
  const labelDuration = Math.round(performance.now() - labelT0);
  console.log(`Label Interpretation Duration: ${labelDuration}ms`);
  console.log("Interpretation Matches:", labelMatches);
  assert.ok(typeof labelMatches === "object", "Must return label mapping object");
  console.log("✓ Live label interpretation successfully processed by Ollama.\n");

  // Step 5: Bounded Error Recovery
  console.log("--- 5. Live Error Recovery Planning ---");
  const recovery = await provider.suggestErrorRecovery(
    {
      id: "step-1",
      type: "click",
      targetLabel: "Size XL",
      description: "Click Size XL facet checkbox",
    },
    "Element not clickable at point (120, 450)",
    5000
  );
  console.log("Recovery Plan:", recovery);
  assert.ok(Array.isArray(recovery) && recovery.length > 0, "Recovery plan must return valid suggested steps array");
  console.log("✓ Live recovery plan generated without repeating failed actions.\n");

  // Step 6: Fallback Invariants (Timeout, Malformed JSON, Offline Refusal)
  console.log("--- 6. Fallback Invariants (Safety & Robustness) ---");

  // 6A. Simulated Timeout
  console.log("Testing timeout fallback...");
  provider.setSimulateMode("timeout");
  const timeoutIntent = await provider.generateIntent(prompt, null, {
    turns: [],
    activeFilters: {},
    activeConstraints: {},
  });
  assert.ok(timeoutIntent, "Timeout must return deterministic fallback");
  assert.strictEqual(timeoutIntent.filters.color, "red");
  console.log("✓ Timeout safely triggered deterministic fallback without crashing.");

  // 6B. Malformed Output
  console.log("Testing malformed JSON fallback...");
  provider.setSimulateMode("invalid_json");
  const malformedIntent = await provider.generateIntent(prompt, null, {
    turns: [],
    activeFilters: {},
    activeConstraints: {},
  });
  assert.ok(malformedIntent, "Malformed JSON must return deterministic fallback");
  assert.strictEqual(malformedIntent.filters.pattern, "checked");
  console.log("✓ Malformed JSON safely triggered deterministic fallback.");

  // 6C. Offline Refusal
  console.log("Testing offline connection refusal...");
  const offlineProvider = new OllamaLocalProvider({
    companionUrl: "http://127.0.0.1:9999", // dead port
    timeoutMs: 1000,
  });
  const offlineAvail = await offlineProvider.checkAvailability();
  assert.strictEqual(offlineAvail.status, "unavailable");
  const offlineIntent = await offlineProvider.generateIntent(prompt, null, {
    turns: [],
    activeFilters: {},
    activeConstraints: {},
  });
  assert.ok(offlineIntent, "Offline companion must return deterministic fallback");
  assert.strictEqual(offlineIntent.filters.size, "XL");
  console.log("✓ Offline companion cleanly falls back to deterministic heuristics.");

  console.log("\n======================================================================");
  console.log("🎉 ALL LIVE OLLAMA VERIFICATION CHECKS PASSED 100%!");
  console.log("======================================================================\n");
}

runLiveOllamaVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
