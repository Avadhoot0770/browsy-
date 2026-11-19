/**
 * Prompt Formatting and Context Compaction for Browsy AI Intent Engine
 * Serializes StructuredPageIntelligence into token-efficient, privacy-safe representations.
 */

import type { StructuredPageIntelligence } from "../page-intelligence/types";

export const INTENT_SYSTEM_PROMPT = `
You are the Browsy Natural Language Intent Engine.
Your role is to understand user requests in the context of the webpage they are viewing.
Convert natural language requests into a structured intent with targets, filters, constraints, and proposed actions.

STRICT SAFETY RULES:
1. You only PROPOSE actions. NEVER execute them.
2. NEVER harvest passwords, auth tokens, or payment details.
3. If the user request is ambiguous, set requiresClarification: true and ask a helpful question.
4. Only reference real element IDs provided in the page context.
`.trim();

/**
 * Compacts StructuredPageIntelligence into a minimal, token-efficient JSON string for LLMs or debug inspection.
 */
export function compactPageIntelligence(intelligence: StructuredPageIntelligence | null): string {
  if (!intelligence) {
    return JSON.stringify({ page: "No page intelligence available" });
  }

  const compact = {
    url: intelligence.url,
    domain: intelligence.hostname,
    title: intelligence.title,
    headings: intelligence.headings.slice(0, 5).map((h) => `H${h.level}: ${h.text}`),
    controls: {
      search: intelligence.searchInputs.map((s) => ({
        id: s.elementId,
        placeholder: s.placeholder,
        label: s.ariaLabel,
      })),
      buttons: intelligence.buttons.slice(0, 15).map((b) => ({
        id: b.elementId,
        text: b.text || b.ariaLabel,
      })),
      filterInputs: intelligence.inputs.slice(0, 15).map((i) => ({
        id: i.elementId,
        type: i.inputType || i.type,
        label: i.nearbyLabel || i.name,
        options: i.options,
      })),
    },
    repeatedCollections: intelligence.repeatedGroups.map((g) => ({
      type: g.inferredType,
      count: g.count,
      sampleItems: g.items.slice(0, 6).map((item) => ({
        id: item.elementId,
        title: item.title,
        price: item.price?.raw,
        rating: item.rating?.raw,
      })),
    })),
  };

  return JSON.stringify(compact);
}
