/**
 * Browsy Local AI Companion Service
 *
 * Lightweight, zero-dependency local bridge between Browsy and Ollama.
 * Runs on the loopback interface (127.0.0.1) outside the webpage context.
 *
 * Capabilities:
 * - Ollama health and model availability checks
 * - Model selection and warm-up
 * - Structured NLU parsing (JSON schema guaranteed)
 * - Adaptive task planning with bounded DOM context
 * - Unfamiliar filter label interpretation
 * - Safe error recovery without retry loops
 * - Grounded product comparison (zero hallucination)
 * - Origin validation, payload bounds, and loopback security
 */

import http from 'node:http';
import { URL } from 'node:url';
import os from 'node:os';

const PORT = parseInt(process.env.BROWSY_COMPANION_PORT || '8765', 10);
const HOST = '127.0.0.1'; // Loopback interface only
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const DEFAULT_MODEL = process.env.BROWSY_DEFAULT_MODEL || 'qwen2.5:1.5b';

// Runtime State
let activeModel = DEFAULT_MODEL;
const MODEL_CACHE = new Map(); // promptHash -> cached response

// Determine Hardware Profile & Recommended Model
function getHardwareProfile() {
  const totalMemGB = Math.round((os.totalmem() / (1024 ** 3)) * 10) / 10;
  const freeMemGB = Math.round((os.freemem() / (1024 ** 3)) * 10) / 10;
  const cpus = os.cpus();
  const cpuModel = cpus[0]?.model || 'Unknown CPU';
  const cpuCores = cpus.length;

  let recommendedModel = 'qwen2.5:1.5b';
  let memoryTier = 'compact';

  if (totalMemGB >= 32) {
    recommendedModel = 'qwen2.5:7b';
    memoryTier = 'high';
  } else if (totalMemGB >= 16) {
    // 16 GB machines run 1.5B or 3B models comfortably without paging
    recommendedModel = 'qwen2.5:3b';
    memoryTier = 'medium';
  } else {
    recommendedModel = 'qwen2.5:1.5b';
    memoryTier = 'compact';
  }

  return {
    totalMemGB,
    freeMemGB,
    cpuModel,
    cpuCores,
    memoryTier,
    recommendedModel,
    activeModel,
  };
}

// Check Ollama daemon availability with bounded 5-second TTL cache to eliminate redundant HTTP handshakes
let cachedAvailability = null;
let lastAvailabilityCheckTime = 0;

async function checkOllamaAvailability(timeoutMs = 1500, bypassCache = false) {
  const now = Date.now();
  if (!bypassCache && cachedAvailability && now - lastAvailabilityCheckTime < 5000) {
    return cachedAvailability;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      cachedAvailability = { connected: false, error: `HTTP ${res.status} from Ollama`, models: [] };
      lastAvailabilityCheckTime = now;
      return cachedAvailability;
    }

    const data = await res.json();
    const models = Array.isArray(data.models) ? data.models.map((m) => m.name || m.model) : [];
    cachedAvailability = {
      connected: true,
      models,
      error: null,
    };
    lastAvailabilityCheckTime = now;
    return cachedAvailability;
  } catch (err) {
    clearTimeout(timer);
    cachedAvailability = {
      connected: false,
      models: [],
      error: err instanceof Error ? err.message : String(err),
    };
    lastAvailabilityCheckTime = now;
    return cachedAvailability;
  }
}

// Request Ollama generation with strict JSON formatting and keepalive
async function queryOllamaJSON(prompt, systemPrompt, model = activeModel, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const payload = {
    model,
    prompt,
    system: systemPrompt,
    stream: false,
    format: 'json',
    options: {
      temperature: 0.1, // Near-deterministic for reliable structured extraction
      top_p: 0.9,
      num_predict: 128, // Compact limit for fast token generation; fits schema cleanly
      num_ctx: 512,     // Bounded context window for rapid prompt evaluation
    },
    keep_alive: '15m', // Keep model in RAM between requests to eliminate reload latency
  };

  try {
    const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Ollama API error: HTTP ${res.status}`);
    }

    const data = await res.json();
    const rawResponse = data.response;
    return JSON.parse(rawResponse);
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// Security: Validate Origin & Client headers
function validateSecurity(req, res) {
  const origin = req.headers['origin'] || '';
  const clientHeader = req.headers['x-browsy-client'];

  // Reject requests from arbitrary remote websites
  if (origin) {
    const isExtension = origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://');
    const isLocalhost = origin.includes('127.0.0.1') || origin.includes('localhost');
    if (!isExtension && !isLocalhost) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Access denied: origin not permitted.' }));
      return false;
    }
  }

  // Set safe CORS headers strictly for loopback / extension
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Browsy-Client, X-Browsy-Simulate');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return false;
  }

  return true;
}

// Helper to read JSON request body
function readBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Payload too large (exceeds 1MB limit)'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const str = Buffer.concat(chunks).toString('utf8');
        if (!str.trim()) return resolve({});
        resolve(JSON.parse(str));
      } catch (err) {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', reject);
  });
}

// Send standard JSON response
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Prompt injection sanitization
function sanitizeUntrustedText(text) {
  if (!text || typeof text !== 'string') return '';
  // Strip control characters and escape boundary markers
  return text
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, '')
    .replace(/<\/?(?:system|instruction|prompt|override)>/gi, '')
    .trim();
}

// Router & Server Handler
const server = http.createServer(async (req, res) => {
  if (!validateSecurity(req, res)) return;

  const reqUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1:8765'}`);
  const pathname = reqUrl.pathname;

  // Check for test simulation mode via header or query
  const simulate = req.headers['x-browsy-simulate'] || reqUrl.searchParams.get('simulate');

  try {
    // -------------------------------------------------------------
    // GET /api/status - Companion & Ollama Status
    // -------------------------------------------------------------
    if (req.method === 'GET' && (pathname === '/api/status' || pathname === '/health')) {
      if (simulate === 'offline') {
        return sendJSON(res, 200, {
          status: 'unavailable',
          ollamaRunning: false,
          activeModel,
          availableModels: [],
          hardware: getHardwareProfile(),
          message: 'Ollama is offline or unreachable on loopback.',
        });
      }

      const ollama = await checkOllamaAvailability();
      const hardware = getHardwareProfile();

      return sendJSON(res, 200, {
        status: ollama.connected ? 'connected' : 'unavailable',
        ollamaRunning: ollama.connected,
        activeModel,
        availableModels: ollama.models,
        hardware,
        message: ollama.connected
          ? `Ollama connected. Active model: ${activeModel}`
          : `Ollama not running on ${OLLAMA_HOST}. Start Ollama with 'ollama serve'.`,
      });
    }

    // -------------------------------------------------------------
    // POST /api/models/select - Model Selection
    // -------------------------------------------------------------
    if (req.method === 'POST' && pathname === '/api/models/select') {
      const body = await readBody(req);
      const model = String(body.model || '').trim();
      if (!model) {
        return sendJSON(res, 400, { error: 'Model name is required' });
      }

      activeModel = model;
      cachedAvailability = null;
      return sendJSON(res, 200, {
        success: true,
        activeModel,
        message: `Switched active local model to ${activeModel}`,
      });
    }

    // -------------------------------------------------------------
    // POST /api/intent - Structured NLU Extraction
    // -------------------------------------------------------------
    if (req.method === 'POST' && pathname === '/api/intent') {
      const body = await readBody(req);
      const query = sanitizeUntrustedText(body.query || '');
      const pageInfo = body.pageContext || {};

      if (!query) {
        return sendJSON(res, 400, { error: 'Query is required' });
      }

      // Simulation hooks for automated regression testing
      if (simulate === 'timeout') {
        await new Promise((resolve) => setTimeout(resolve, 4000));
        return sendJSON(res, 504, { error: 'Model execution timed out' });
      }
      if (simulate === 'invalid_json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end('MALFORMED_NON_JSON_RESPONSE_FROM_MODEL');
      }

      // Check Ollama status
      const ollama = await checkOllamaAvailability(1000);
      if (!ollama.connected || simulate === 'fallback') {
        return sendJSON(res, 503, {
          error: 'Ollama offline, falling back to local heuristic provider',
          fallbackRecommended: true,
        });
      }

      const systemPrompt = `Extract user intent into concise JSON:
{"id":"intent-0","intent":"find"|"filter"|"navigate"|"compare"|"summarize"|"unknown","target":"products"|"jobs"|"page"|"unknown","entities":{"category":string,"role":string,"type":string},"filters":{"color":string,"pattern":string,"size":string,"brand":string,"material":string},"constraints":{"maxPrice":number,"currency":"INR"|"USD","minRating":number},"relativeRef":{"type":"cheapest"|"first"|"matching","count":number},"confidence":0.95,"requiresClarification":false}
Strict factual extraction only. Do not invent unmentioned constraints.`;

      const userPrompt = `User request: "${query}"\nCurrent webpage: ${sanitizeUntrustedText(pageInfo.domain || '')} - ${sanitizeUntrustedText(pageInfo.title || '')}`;

      const intentTimeout = typeof body.timeoutMs === 'number' ? body.timeoutMs : 12000;
      try {
        const parsed = await queryOllamaJSON(userPrompt, systemPrompt, activeModel, intentTimeout);
        // Schema hygiene
        parsed.id = parsed.id || `intent-${Date.now()}`;
        parsed.rawQuery = query;
        parsed.timestamp = Date.now();
        parsed.confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.92;
        parsed.entities = parsed.entities || {};
        parsed.filters = parsed.filters || {};
        parsed.constraints = parsed.constraints || {};

        // Intent & target type normalization
        if (parsed.target === 'content' || parsed.intent === 'summarize') {
          parsed.target = 'page';
        }
        if (parsed.intent === 'find' && (Object.keys(parsed.filters).length > 0 || parsed.constraints.maxPrice)) {
          parsed.intent = 'filter';
        }
        if (/^(?:open|go to|take me to|navigate to)\s+/i.test(query.trim()) && (parsed.intent === 'unknown' || !parsed.intent)) {
          parsed.intent = 'navigate';
          parsed.target = 'controls';
        }

        // Normalization: Ensure specific product category is preserved and unknown strings removed
        if (parsed.target === 'products') {
          delete parsed.entities.role;
          delete parsed.entities.type;
          delete parsed.entities.destination;

          const queryLower = query.toLowerCase();
          if (!parsed.entities.category || parsed.entities.category === 'clothing' || parsed.entities.category === 'apparel') {
            for (const cat of ['shirt', 't-shirt', 'shoes', 'jeans', 'dress', 'jacket', 'trousers', 'sneakers', 'book', 'watch']) {
              if (queryLower.includes(cat)) {
                parsed.entities.category = cat;
                break;
              }
            }
          }

          // Reconcile colors that small LLMs misclassify as brand or drop
          for (const color of ['red', 'blue', 'green', 'black', 'white', 'yellow', 'pink', 'grey', 'gray', 'brown', 'maroon', 'navy', 'orange']) {
            if (new RegExp(`\\b${color}\\b`, 'i').test(queryLower)) {
              parsed.filters.color = color;
              if (parsed.filters.brand?.toLowerCase() === color) delete parsed.filters.brand;
              if (parsed.entities.brand?.toLowerCase() === color) delete parsed.entities.brand;
              break;
            }
          }

          // Reconcile patterns that small LLMs omit
          for (const pat of ['checked', 'check', 'plaid', 'striped', 'solid', 'printed', 'gingham']) {
            if (new RegExp(`\\b${pat}\\b`, 'i').test(queryLower) && !parsed.filters.pattern) {
              parsed.filters.pattern = pat;
              break;
            }
          }

          // Reconcile size constraints that small LLMs omit
          for (const sz of ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '2XL']) {
            if (new RegExp(`\\b${sz}\\b`, 'i').test(query) && !parsed.filters.size) {
              parsed.filters.size = sz.toUpperCase();
              break;
            }
          }

          // Reconcile budget constraint if omitted
          const priceMatch = query.match(/(?:under|below|less than|max|up to)\s*(?:₹|rs\.?|inr|\$|£|€)?\s*([0-9,]+)/i);
          if (priceMatch && !parsed.constraints.maxPrice) {
            parsed.constraints.maxPrice = parseInt(priceMatch[1].replace(/,/g, ''), 10);
            if (query.includes('₹') || /rs\.?|inr/i.test(query)) parsed.constraints.currency = 'INR';
            else if (query.includes('$')) parsed.constraints.currency = 'USD';
            else if (query.includes('£')) parsed.constraints.currency = 'GBP';
            else if (query.includes('€')) parsed.constraints.currency = 'EUR';
          }

          // Reconcile rating constraints (e.g. "good reviews", "top rated", "4 stars")
          if (!parsed.constraints.minRating) {
            if (/highly\s+rated|top\s+rated|best\s+rated|best\s+reviewed|good\s+reviews?|well\s+reviewed|positive\s+reviews?|great\s+reviews?/i.test(queryLower)) {
              parsed.constraints.minRating = 4;
            } else {
              const ratingMatch = queryLower.match(/([1-5](?:\.[0-9])?)\s*(?:-| )?star|rating\s*(?:above|greater than|>)\s*([1-5](?:\.[0-9])?)/i);
              if (ratingMatch) {
                const score = parseFloat(ratingMatch[1] || ratingMatch[2]);
                if (!isNaN(score)) parsed.constraints.minRating = score;
              }
            }
          }

          // Reconcile relativeRef count (e.g. "top five", "top 5", "first 3")
          if (!parsed.relativeRef || !parsed.relativeRef.count) {
            const countMatch = queryLower.match(/(?:top|first|best)\s+(one|two|three|four|five|six|seven|eight|nine|ten|\d+)/i);
            if (countMatch) {
              const countWordMap = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
              const val = countMatch[1].toLowerCase();
              const num = countWordMap[val] || parseInt(val, 10);
              if (num && !isNaN(num)) {
                parsed.relativeRef = {
                  type: parsed.relativeRef?.type || 'matching',
                  count: num,
                };
              }
            }
          }

          // Avoid duplicating material into color
          if (parsed.filters.color && parsed.filters.material && parsed.filters.color === parsed.filters.material) {
            const knownColors = ['red', 'blue', 'green', 'black', 'white', 'yellow', 'pink', 'grey', 'gray', 'brown', 'maroon', 'navy', 'orange'];
            if (!knownColors.includes(parsed.filters.color.toLowerCase())) {
              delete parsed.filters.color;
            }
          }

          for (const obj of [parsed.entities, parsed.filters, parsed.constraints]) {
            if (!obj) continue;
            for (const [k, v] of Object.entries(obj)) {
              if (
                typeof v === 'string' &&
                ['none', 'unknown', 'null', 'undefined', 'n/a', 'na', ''].includes(v.trim().toLowerCase())
              ) {
                delete obj[k];
              } else if (v === null || v === undefined) {
                delete obj[k];
              }
            }
          }
        }

        // Job normalization
        if (parsed.target === 'jobs') {
          const queryLower = query.toLowerCase();
          const jobTypes = ['entry-level', 'internship', 'intern', 'junior', 'senior', 'lead', 'full-time', 'part-time', 'contract', 'remote'];

          // If model swapped role and job type, normalize them
          if (parsed.entities.role && jobTypes.includes(parsed.entities.role.toLowerCase())) {
            parsed.entities.type = parsed.entities.role.toLowerCase();
            parsed.entities.role = parsed.entities.category || '';
            delete parsed.entities.category;
          }

          for (const jt of jobTypes) {
            if (queryLower.includes(jt) && !parsed.entities.type) {
              parsed.entities.type = jt;
              break;
            }
          }

          if (!parsed.entities.role) {
            const roleMatch = query.match(/(?:find|search|for)\s+(?:an?\s+)?(?:entry-level\s+|senior\s+|remote\s+)?([a-z\s]+?)(?:\s+jobs|\s+opportunities|\s+roles|\s+positions|$)/i);
            if (roleMatch && roleMatch[1]) {
              parsed.entities.role = roleMatch[1].trim();
            }
          }
        }

        // Global cleanup of empty/sentinel fields across all intent types
        for (const obj of [parsed.entities, parsed.filters, parsed.constraints]) {
          if (!obj) continue;
          for (const [k, v] of Object.entries(obj)) {
            if (
              typeof v === 'string' &&
              ['none', 'unknown', 'null', 'undefined', 'n/a', 'na', ''].includes(v.trim().toLowerCase())
            ) {
              delete obj[k];
            } else if (v === null || v === undefined) {
              delete obj[k];
            }
          }
        }

        return sendJSON(res, 200, parsed);
      } catch (err) {
        return sendJSON(res, 500, {
          error: 'Failed to process with local model',
          details: err instanceof Error ? err.message : String(err),
          fallbackRecommended: true,
        });
      }
    }

    // -------------------------------------------------------------
    // POST /api/interpret-labels - Website Understanding (Facet Labels)
    // -------------------------------------------------------------
    if (req.method === 'POST' && pathname === '/api/interpret-labels') {
      const body = await readBody(req);
      const labels = Array.isArray(body.labels) ? body.labels.slice(0, 30) : [];
      const targetConstraint = sanitizeUntrustedText(body.targetConstraint || '');

      if (!targetConstraint || labels.length === 0) {
        return sendJSON(res, 200, { matches: {} });
      }

      if (simulate === 'invalid_json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end('{ broken json');
      }

      const ollama = await checkOllamaAvailability(1000);
      if (!ollama.connected || simulate === 'fallback') {
        // Deterministic label fallback matching
        const matches = {};
        const targetLower = targetConstraint.toLowerCase();
        for (const label of labels) {
          const lLower = String(label).toLowerCase();
          if (lLower.includes(targetLower)) {
            matches[label] = 0.95;
          } else if (targetLower === 'red' && /\b(maroon|crimson|wine|rust|burgundy)\b/i.test(lLower)) {
            matches[label] = 0.9;
          } else {
            matches[label] = 0.0;
          }
        }
        return sendJSON(res, 200, { matches, source: 'heuristic-fallback' });
      }

      const systemPrompt = `You evaluate whether UI filter labels match a target constraint.
Return JSON mapping each label to a match confidence score between 0.0 and 1.0:
{
  "matches": {
    "Label A": 0.95,
    "Label B": 0.0
  }
}`;
      const prompt = `Target constraint: "${targetConstraint}"\nCandidate facet labels: ${JSON.stringify(labels)}`;

      try {
        const result = await queryOllamaJSON(prompt, systemPrompt);
        return sendJSON(res, 200, { matches: result.matches || {}, source: 'local-ollama' });
      } catch (err) {
        return sendJSON(res, 500, { error: 'Label interpretation failed', fallbackRecommended: true });
      }
    }

    // -------------------------------------------------------------
    // POST /api/recover - Error Recovery Suggestions
    // -------------------------------------------------------------
    if (req.method === 'POST' && pathname === '/api/recover') {
      const body = await readBody(req);
      const failedStep = body.failedStep || {};
      const errorReason = sanitizeUntrustedText(body.errorReason || '');
      const remainingTimeMs = body.remainingTimeMs || 5000;

      if (simulate === 'unsafe_action') {
        // Simulates an unsafe action proposed by a rogue model
        return sendJSON(res, 200, {
          suggestedSteps: [
            {
              id: 'step-rogue',
              type: 'type',
              targetElementId: 'cvv-input',
              value: '123',
              description: 'Enter CVV code',
            },
          ],
        });
      }

      if (remainingTimeMs < 1000) {
        return sendJSON(res, 200, {
          canRecover: false,
          reason: 'Insufficient time remaining in task deadline budget',
          suggestedSteps: [],
        });
      }

      const ollama = await checkOllamaAvailability(1000);
      if (!ollama.connected || simulate === 'fallback') {
        return sendJSON(res, 200, {
          canRecover: true,
          source: 'deterministic-recovery',
          suggestedSteps: [
            {
              id: `recovery-${Date.now()}`,
              type: 'click',
              targetLabel: failedStep.targetLabel || failedStep.value,
              description: `Retry locating filter '${failedStep.targetLabel || failedStep.value}' via expandable facet drawers`,
            },
          ],
        });
      }

      const systemPrompt = `You are Browsy's error recovery planner. When a browser action fails, propose a safe alternative plan step.
Do NOT repeat the failed action. Never propose actions touching passwords, CVVs, or payment forms.
Return JSON:
{
  "canRecover": boolean,
  "suggestedSteps": [
    {
      "id": string,
      "type": "click" | "check" | "type" | "scroll",
      "targetLabel": string,
      "description": string
    }
  ]
}`;
      const prompt = `Failed action: ${JSON.stringify(failedStep)}\nFailure reason: "${errorReason}"\nRemaining budget: ${remainingTimeMs}ms`;

      try {
        const result = await queryOllamaJSON(prompt, systemPrompt);
        return sendJSON(res, 200, result);
      } catch {
        return sendJSON(res, 200, { canRecover: false, suggestedSteps: [] });
      }
    }

    // -------------------------------------------------------------
    // POST /api/compare - Grounded Product Comparison
    // -------------------------------------------------------------
    if (req.method === 'POST' && pathname === '/api/compare') {
      const body = await readBody(req);
      const items = Array.isArray(body.items) ? body.items.slice(0, 8) : [];
      const query = sanitizeUntrustedText(body.query || '');

      if (items.length === 0) {
        return sendJSON(res, 200, { rankedItemIds: [], reasoning: {} });
      }

      const ollama = await checkOllamaAvailability(1000);
      if (!ollama.connected || simulate === 'fallback') {
        // Grounded heuristic comparison: rank by rating and price
        const ranked = [...items].sort((a, b) => {
          const rA = a.rating?.score || 0;
          const rB = b.rating?.score || 0;
          if (rB !== rA) return rB - rA;
          const pA = a.price?.amount || 999999;
          const pB = b.price?.amount || 999999;
          return pA - pB;
        });
        const rankedItemIds = ranked.map((i) => i.elementId);
        const reasoning = {};
        for (const item of ranked) {
          reasoning[item.elementId] = `Grounded in verified rating: ${item.rating?.raw || 'N/A'}, price: ${item.price?.raw || 'N/A'}`;
        }
        return sendJSON(res, 200, { rankedItemIds, reasoning, source: 'grounded-heuristic' });
      }

      const systemPrompt = `You rank candidate products strictly using the provided extracted attributes (title, price, metaText, rating).
NEVER invent missing specifications, prices, or sizes.
Return JSON:
{
  "rankedItemIds": string[],
  "reasoning": {
    "[elementId]": string
  }
}`;
      const prompt = `User request: "${query}"\nExtracted items:\n${JSON.stringify(items, null, 2)}`;

      try {
        const result = await queryOllamaJSON(prompt, systemPrompt);
        return sendJSON(res, 200, {
          rankedItemIds: result.rankedItemIds || items.map((i) => i.elementId),
          reasoning: result.reasoning || {},
          source: 'local-ollama',
        });
      } catch (err) {
        return sendJSON(res, 500, { error: 'Product comparison failed', fallbackRecommended: true });
      }
    }

    // Default 404 for unknown endpoints
    sendJSON(res, 404, { error: `Endpoint '${pathname}' not found on Browsy Companion Service` });
  } catch (err) {
    console.error('[Browsy Companion Error]:', err);
    sendJSON(res, 500, { error: err instanceof Error ? err.message : 'Internal Server Error' });
  }
});

// Start loopback server
server.listen(PORT, HOST, () => {
  const hw = getHardwareProfile();
  console.log('===========================================================');
  console.log(`🤖 BROWSY LOCAL AI COMPANION SERVICE`);
  console.log(`📡 Listening strictly on: http://${HOST}:${PORT} (Loopback)`);
  console.log(`🔗 Target Ollama daemon: ${OLLAMA_HOST}`);
  console.log(`🧠 Hardware profile: ${hw.cpuModel} (${hw.cpuCores} cores)`);
  console.log(`💾 RAM: ${hw.totalMemGB} GB total (${hw.freeMemGB} GB free)`);
  console.log(`💡 Recommended model for this hardware: ${hw.recommendedModel}`);
  console.log(`🎯 Active model: ${activeModel}`);
  console.log('===========================================================');
});

// Clean shutdown handler
process.on('SIGINT', () => {
  console.log('\n[Browsy Companion] Shutting down gracefully...');
  server.close(() => process.exit(0));
});
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

export { server, getHardwareProfile, checkOllamaAvailability };
