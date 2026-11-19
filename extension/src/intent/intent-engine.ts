/**
 * Central Intent Engine Coordinator for Browsy Stage 3
 * Coordinates provider, validation, matching, and planning while maintaining conversation context.
 */

import type {
  StructuredIntent,
  ActionPlan,
  ConversationContext,
  IntentProcessingResult,
} from "./types";
import type { StructuredPageIntelligence } from "../page-intelligence/types";
import { CompositeAIProvider, type AIProvider, type ProviderStatus } from "./provider";
import { validateStructuredIntent, validateActionPlan } from "./validator";
import { generateActionPlan } from "./planner";

const CONTEXT_STORAGE_KEY = "browsy_conversation_context";

function loadPersistedContext(): ConversationContext {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return { turns: [], activeFilters: {}, activeConstraints: {} };
  }
  try {
    const raw = window.sessionStorage.getItem(CONTEXT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.turns)) {
        return parsed;
      }
    }
  } catch {}
  return { turns: [], activeFilters: {}, activeConstraints: {} };
}

function savePersistedContext(ctx: ConversationContext): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(CONTEXT_STORAGE_KEY, JSON.stringify(ctx));
  } catch {}
}

export class IntentEngine {
  private provider: AIProvider;
  private context: ConversationContext;

  constructor(provider?: AIProvider) {
    this.provider = provider || new CompositeAIProvider();
    this.context = loadPersistedContext();
  }

  /**
   * Sets the active AI provider (supports switching between local heuristic, Ollama, and remote proxy).
   */
  public setProvider(provider: AIProvider): void {
    this.provider = provider;
  }

  public getProvider(): AIProvider {
    return this.provider;
  }

  public async getProviderStatus(): Promise<ProviderStatus> {
    if (this.provider.checkAvailability) {
      return this.provider.checkAvailability();
    }
    return {
      status: "connected",
      ollamaRunning: false,
      available: false,
      activeModel: "local-heuristic",
      availableModels: [],
      message: "Deterministic heuristic engine active.",
    };
  }

  public async selectModel(modelName: string): Promise<boolean> {
    if (this.provider.selectModel) {
      return this.provider.selectModel(modelName);
    }
    return false;
  }

  /**
   * Clears conversation context (e.g. when navigating to an entirely new origin or user reset).
   */
  public resetContext(): void {
    this.context = {
      turns: [],
      activeFilters: {},
      activeConstraints: {},
    };
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        window.sessionStorage.removeItem(CONTEXT_STORAGE_KEY);
      } catch {}
    }
  }

  /**
   * Records verified candidate products and active brand into conversation memory.
   */
  public recordVerifiedProducts(arg1: any, arg2?: any): void {
    let products: any[] = [];
    let brand: string | undefined = undefined;

    if (Array.isArray(arg1)) {
      products = arg1;
      if (typeof arg2 === "string") brand = arg2;
    } else if (typeof arg1 === "string") {
      brand = arg1;
      if (Array.isArray(arg2)) products = arg2;
    }

    this.context.lastVerifiedProducts = products;
    if (brand) {
      this.context.activeBrand = brand;
    } else if (products && products.length > 0 && products[0]?.title) {
      const firstWord = products[0].title.split(" ")[0];
      if (firstWord && firstWord.length > 2) {
        this.context.activeBrand = firstWord;
      }
    }
    savePersistedContext(this.context);
  }

  /**
   * Retrieves the current conversation context.
   */
  public getContext(): ConversationContext {
    return this.context;
  }

  /**
   * Processes a user natural language request in the context of the current page.
   */
  public async processRequest(
    query: string,
    pageContext: StructuredPageIntelligence | null,
    signal?: AbortSignal
  ): Promise<IntentProcessingResult> {
    console.debug("[Browsy][Intent] Processing request:", query);

    // Snapshot prior context before generating intent
    const isPriorTurn = this.context.turns.length > 0;
    const lastTurn = isPriorTurn ? this.context.turns[this.context.turns.length - 1] : null;
    const lastIntent = lastTurn?.intent;

    // 1. Generate Structured Intent via Provider
    const intent: StructuredIntent = await this.provider.generateIntent(
      query,
      pageContext,
      this.context,
      signal
    );

    // 2. Validate Intent Schema
    validateStructuredIntent(intent);

    // 3. Generate Proposed Action Plan
    const plan: ActionPlan = generateActionPlan(intent, pageContext);

    // 4. Validate Action Plan (enforcing 'proposed' status invariant)
    validateActionPlan(plan, pageContext);

    // 5. Update Conversation Memory
    if (!intent.requiresClarification && intent.intent !== "unknown") {
      const isCategoryShift = Boolean(
        intent.entities.category &&
        this.context.activeCategory &&
        intent.entities.category.toLowerCase() !== this.context.activeCategory.toLowerCase()
      );

      if (isCategoryShift) {
        // Clear prior category-specific filters and products
        this.context.activeFilters = {};
        this.context.activeBrand = undefined;
        this.context.lastVerifiedProducts = [];
        if (intent.constraints.maxPrice === undefined) {
          this.context.activeConstraints = {};
        }
      }

      if (intent.entities.category) {
        this.context.activeCategory = intent.entities.category;
      }
      this.context.lastTarget = intent.target;

      // Merge new filters
      for (const [k, v] of Object.entries(intent.filters)) {
        if (v !== undefined) {
          this.context.activeFilters[k] = v;
        }
      }

      // Merge exclusions
      if (intent.filters.exclude && Array.isArray(intent.filters.exclude)) {
        this.context.activeExclusions = [
          ...new Set([...(this.context.activeExclusions || []), ...intent.filters.exclude]),
        ];
      }

      // Merge constraints
      if (intent.constraints.maxPrice !== undefined) {
        this.context.activeConstraints.maxPrice = intent.constraints.maxPrice;
        this.context.activeConstraints.currency = intent.constraints.currency;
      }
      if (intent.constraints.minRating !== undefined) {
        this.context.activeConstraints.minRating = intent.constraints.minRating;
      }
      if (intent.constraints.location !== undefined) {
        this.context.activeConstraints.location = intent.constraints.location;
      }

      this.context.lastMatchedElementIds = plan.matchedItems.map((m) => m.elementId);
    }

    // Record turn in history
    this.context.turns.push({
      role: "user",
      text: query,
      intent,
      timestamp: Date.now(),
    });

    savePersistedContext(this.context);

    // 6. Build Human-Readable Summary Message with clear active/updated constraints
    let summaryMessage = "";
    let contextUpdatedInfo: IntentProcessingResult["contextUpdated"] = undefined;

    if (intent.requiresClarification) {
      summaryMessage = intent.clarificationPrompt || "Could you provide a few more details so I can assist you better?";
    } else if (intent.intent === "unknown") {
      summaryMessage = intent.clarificationPrompt || "I didn't quite catch that. Try asking something like: 'Find red checked shirts under ₹1,000'.";
    } else {
      const activeParts: string[] = [];
      const updatedParts: string[] = [];

      if (intent.entities.category) activeParts.push(`category: ${intent.entities.category}`);

      if (intent.filters.color) {
        if (lastIntent?.filters?.color && lastIntent.filters.color !== intent.filters.color) {
          updatedParts.push(`color changed to ${intent.filters.color}`);
        } else {
          activeParts.push(`color: ${intent.filters.color}`);
        }
      }

      if (intent.filters.pattern) {
        if (lastIntent?.filters?.pattern && lastIntent.filters.pattern !== intent.filters.pattern) {
          updatedParts.push(`pattern changed to ${intent.filters.pattern}`);
        } else {
          activeParts.push(`pattern: ${intent.filters.pattern}`);
        }
      }

      if (intent.filters.size) {
        if (lastIntent?.filters?.size && lastIntent.filters.size !== intent.filters.size) {
          updatedParts.push(`size changed to ${intent.filters.size}`);
        } else {
          activeParts.push(`size: ${intent.filters.size}`);
        }
      }

      if (intent.constraints.maxPrice) {
        if (lastIntent?.constraints?.maxPrice && lastIntent.constraints.maxPrice !== intent.constraints.maxPrice) {
          updatedParts.push(`budget updated to ₹${intent.constraints.maxPrice.toLocaleString()}`);
        } else {
          activeParts.push(`budget: under ₹${intent.constraints.maxPrice.toLocaleString()}`);
        }
      }

      if (intent.filters.exclude && (Array.isArray(intent.filters.exclude) ? intent.filters.exclude.length > 0 : Boolean(intent.filters.exclude))) {
        const excludeStr = Array.isArray(intent.filters.exclude)
          ? intent.filters.exclude.join(", ")
          : String(intent.filters.exclude);
        updatedParts.push(`excluding: ${excludeStr}`);
      }

      if (intent.sort) {
        updatedParts.push(`sorted by: ${intent.sort.field} (${intent.sort.direction === "asc" ? "lowest first" : "highest first"})`);
      }

      if (updatedParts.length > 0 && isPriorTurn) {
        summaryMessage = `Got it — ${updatedParts.join(", ")}. Remaining active filters: ${activeParts.join(", ")}.`;
        contextUpdatedInfo = {
          changedConstraint: updatedParts.join(", "),
          preservedConstraints: activeParts,
        };
      } else {
        const parts = [...updatedParts, ...activeParts.map((p) => `✓ ${p}`)];
        summaryMessage = `I understand:\n\n${parts.join("\n")}\n\n`;
      }

      if (plan.matchedItems.length > 0) {
        summaryMessage += ` I found ${plan.matchedItems.length} possible match${plan.matchedItems.length === 1 ? "" : "es"} on this page.`;
      } else if (plan.steps.length > 0) {
        summaryMessage += ` I have prepared a plan with ${plan.steps.length} proposed action${plan.steps.length === 1 ? "" : "s"}.`;
      } else {
        summaryMessage += ` Ready to help you find this on the page.`;
      }
    }

    console.debug(`[Browsy][Intent] Parsed successfully with confidence ${intent.confidence}, found ${plan.matchedItems.length} matches.`);

    return {
      intent,
      plan,
      requiresClarification: intent.requiresClarification,
      clarificationPrompt: intent.clarificationPrompt,
      matchedItems: plan.matchedItems,
      summaryMessage,
      contextUpdated: contextUpdatedInfo,
    };
  }
}

export const intentEngine = new IntentEngine();
