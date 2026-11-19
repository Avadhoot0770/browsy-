async function main() {
  const systemPrompt = `You are Browsy's local NLU parser. Extract the user's intent into strict JSON conforming to this schema:
{
  "id": "intent-TIMESTAMP",
  "intent": "find" | "filter" | "navigate" | "compare" | "summarize" | "unknown",
  "target": "products" | "jobs" | "travel" | "content" | "page" | "unknown",
  "entities": {
    "category"?: string, // specific product type, e.g. "shirt", "shoes", "laptop"
    "role"?: string,     // for jobs, e.g. "data analyst", "software engineer"
    "type"?: string,     // for jobs/content, e.g. "entry-level", "senior", "remote"
    "destination"?: string // for travel, e.g. "Bangalore"
  },
  "filters": {
    "color"?: string,    // e.g. "red", "blue"
    "pattern"?: string,  // e.g. "checked", "striped", "solid"
    "size"?: string,     // e.g. "XL", "M", "32"
    "brand"?: string,
    "material"?: string
  },
  "constraints": {
    "maxPrice"?: number,
    "minPrice"?: number,
    "currency"?: "INR" | "USD" | "EUR" | "GBP",
    "minRating"?: number
  },
  "relativeRef"?: {
    "type": "cheapest" | "first" | "second" | "third" | "matching" | "similar" | "all",
    "count"?: number
  },
  "confidence": number (0.0 to 1.0),
  "requiresClarification": boolean,
  "clarificationPrompt"?: string
}
Do not invent constraints. Keep outputs strictly factual based on the user's explicit input.`;

  const query = "Find me a cashmere shirt under ₹1,000.";
  const userPrompt = `User request: "${query}"\nCurrent webpage: myntra.com - Online Shopping`;

  const t0 = Date.now();
  const res = await fetch('http://127.0.0.1:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5:1.5b',
      prompt: userPrompt,
      system: systemPrompt,
      format: 'json',
      stream: false,
      options: {
        temperature: 0.1,
        top_p: 0.9,
        num_predict: 256,
        num_ctx: 1024,
      }
    })
  });
  const data = await res.json();
  console.log('Response:', data.response);
}

main().catch(console.error);
