/**
 * Shared TypeScript types for the Browsy Extension
 */

import type { StructuredPageIntelligence } from "../page-intelligence/types";
import type { IntentProcessingResult } from "../intent/types";
import type { ExecutionSession } from "../execution/types";

export interface PageContext {
  url: string;
  hostname: string;
  pathname: string;
  title: string;
  favIconUrl?: string;
  timestamp: number;
  intelligence?: StructuredPageIntelligence;
}

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  pageContext?: PageContext;
  status?: "sending" | "delivered" | "received" | "pending";
  intentResult?: IntentProcessingResult;
  executionSession?: ExecutionSession;
}

export interface ExtensionState {
  isPanelOpen: boolean;
  pageContext: PageContext | null;
  messages: ChatMessage[];
}
