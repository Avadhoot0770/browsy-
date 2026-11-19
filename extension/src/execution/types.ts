/**
 * Execution Engine Types for Browsy Stage 4: Supervised Browser Action Execution
 * Defines the state machine, risk classification, execution logs, and verification contracts.
 */

import type { ActionPlanStepType, MatchedItem } from "../intent/types";

/**
 * Supervised execution lifecycle states.
 * Enforces a strict one-way state machine without arbitrary jumps.
 */
export type ExecutionState =
  | "idle"
  | "proposed"
  | "awaiting_approval"
  | "approved"
  | "executing"
  | "paused"
  | "verifying"
  | "completed"
  | "partial_success"
  | "failed"
  | "cancelled"
  | "stale";

/**
 * Action risk classification levels.
 * High-risk actions require a mandatory second user confirmation before execution.
 */
export type ActionRiskLevel = "low" | "medium" | "high";

/**
 * Status of individual steps during an execution session.
 */
export type StepExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "cancelled"
  | "stale";

/**
 * Detailed verification outcome for an executed action.
 */
export interface VerificationResult {
  verified: boolean;
  reason?: string;
  details?: Record<string, unknown>;
}

/**
 * Result returned by safety guards before any action is permitted.
 */
export interface GuardCheckResult {
  canExecute: boolean;
  reason?: string;
  riskLevel: ActionRiskLevel;
  requiresConfirmation?: boolean;
}

/**
 * Detailed audit log entry for an executed or attempted step.
 */
export interface ActionExecutionRecord {
  actionId: string;
  stepId: string;
  type: ActionPlanStepType;
  targetElementId?: string;
  targetLabel?: string;
  description: string;
  status: StepExecutionStatus;
  startedAt?: number;
  completedAt?: number;
  attempts: number;
  error?: string;
  verification?: VerificationResult;
}

/**
 * State representing a live or concluded supervised execution session.
 */
export interface ExecutionSession {
  id: string;
  planId: string;
  state: ExecutionState;
  currentStepIndex: number;
  totalSteps: number;
  records: ActionExecutionRecord[];
  startedAt: number;
  endedAt?: number;
  requiresHighRiskConfirmation?: boolean;
  highRiskReason?: string;
  summaryMessage?: string;
  confirmedMatches?: MatchedItem[];
  partialMatches?: MatchedItem[];
  unverifiedFilters?: string[];
  verifiedProductResult?: any;
}

/**
 * Configuration options for the ActionExecutor.
 */
export interface ExecutionOptions {
  stepTimeoutMs?: number;        // Default 5000ms
  maxRetries?: number;           // Default 2
  highlightElements?: boolean;   // Default true
  highlightDurationMs?: number;  // Default 500ms
  onStateChange?: (state: ExecutionState, session: ExecutionSession) => void;
  onStepProgress?: (stepIndex: number, record: ActionExecutionRecord) => void;
}
