/**
 * Task Persistence for Browsy Supervised Execution Resumption
 * Ensures tasks survive page reloads and dynamic updates with stable task IDs,
 * explicit step status tracking, and strict approval gates.
 */

import type { ActionPlan, ActionPlanStep, StructuredIntent } from "../intent/types";
import type { ActionExecutionRecord } from "./types";
import type { ChatMessage } from "../shared/types";

export const TASK_STORAGE_KEY = "browsy_active_task";
export const LEGACY_STORAGE_KEY = "browsy_pending_nav_execution";
export const TASK_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

export interface TaskPersistenceData {
  taskId: string;
  plan: ActionPlan;
  intent?: StructuredIntent;
  originalQuery: string;
  parsedConstraints?: {
    category?: string;
    color?: string;
    pattern?: string;
    size?: string;
    maxPrice?: number;
    minRating?: number;
    [key: string]: any;
  };
  currentStepIndex: number;
  completedRecords: ActionExecutionRecord[];
  pendingActions?: ActionPlanStep[];
  verificationResults?: Record<string, any>;
  retryCounts?: Record<string, number>;
  isApproved: boolean;
  isCancelled?: boolean;
  isTimedOut?: boolean;
  executionState?: "proposed" | "approved" | "executing" | "verifying" | "completed" | "partial_success" | "failed" | "cancelled" | "stale" | "paused";
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Saves or updates an active task in sessionStorage.
 */
export function saveActiveTask(data: TaskPersistenceData): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    const pendingActions = data.plan?.steps ? data.plan.steps.slice(data.currentStepIndex) : [];
    const parsedConstraints = data.parsedConstraints || (data.intent ? {
      category: data.intent.entities?.category,
      color: data.intent.filters?.color as string | undefined,
      pattern: data.intent.filters?.pattern as string | undefined,
      size: data.intent.filters?.size as string | undefined,
      maxPrice: data.intent.constraints?.maxPrice,
      minRating: data.intent.constraints?.minRating,
    } : undefined);

    const payload: TaskPersistenceData = {
      ...data,
      pendingActions,
      parsedConstraints,
      updatedAt: Date.now(),
    };
    window.sessionStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("[Browsy] Failed to save active task to sessionStorage:", err);
  }
}

/**
 * Retrieves the active task from sessionStorage.
 * Validates expiration, approval gate, and cancellation/timeout states.
 * Returns null if invalid, expired, cancelled, or timed out.
 */
export function loadActiveTask(): TaskPersistenceData | null {
  if (typeof window === "undefined" || !window.sessionStorage) return null;
  try {
    let raw = window.sessionStorage.getItem(TASK_STORAGE_KEY);
    if (!raw) {
      // Check legacy key for backward compatibility
      raw = window.sessionStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        const legacy = JSON.parse(raw);
        if (legacy && legacy.plan) {
          const converted: TaskPersistenceData = {
            taskId: `task-legacy-${Date.now()}`,
            plan: legacy.plan,
            intent: legacy.intent,
            originalQuery: legacy.plan.explanation || "",
            currentStepIndex: legacy.nextStepIndex || 0,
            completedRecords: legacy.completedRecords || [],
            isApproved: true,
            messages: legacy.messages || [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
          saveActiveTask(converted);
          return converted;
        }
      }
      return null;
    }

    const data: TaskPersistenceData = JSON.parse(raw);
    if (!data || !data.taskId || !data.plan || !data.plan.steps) {
      clearActiveTask();
      return null;
    }

    // Safety Gate: Must be explicitly approved
    if (!data.isApproved) {
      console.warn("[Browsy] Active task rejected: execution not approved by user.");
      clearActiveTask();
      return null;
    }

    // Cancellation and Timeout Gates: Do not resume aborted or timed-out tasks
    if (data.isCancelled || data.isTimedOut || data.executionState === "cancelled") {
      console.debug(`[Browsy] Task ${data.taskId} is marked cancelled/timed out, not resuming.`);
      clearActiveTask();
      return null;
    }

    // Time-to-live expiration check
    const age = Date.now() - (data.updatedAt || data.createdAt || 0);
    if (age > TASK_EXPIRATION_MS) {
      console.warn(`[Browsy] Active task ${data.taskId} expired (age: ${Math.round(age / 1000)}s). Clearing.`);
      clearActiveTask();
      return null;
    }

    return data;
  } catch (err) {
    console.warn("[Browsy] Failed to read active task from sessionStorage:", err);
    clearActiveTask();
    return null;
  }
}

/**
 * Updates the current step index, completed records, and verification state for the active task.
 */
export function updateActiveTaskStep(
  currentStepIndex: number,
  completedRecords: ActionExecutionRecord[],
  verificationResults?: Record<string, any>,
  retryCounts?: Record<string, number>
): void {
  const current = loadActiveTask();
  if (!current) return;
  current.currentStepIndex = currentStepIndex;
  current.completedRecords = completedRecords;
  if (verificationResults) current.verificationResults = verificationResults;
  if (retryCounts) current.retryCounts = retryCounts;
  current.pendingActions = current.plan.steps.slice(currentStepIndex);
  saveActiveTask(current);
}

/**
 * Explicitly marks the active task as cancelled and clears from active execution.
 */
export function cancelActiveTask(): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    const current = loadActiveTask();
    if (current) {
      current.isCancelled = true;
      current.executionState = "cancelled";
      saveActiveTask(current);
    }
  } catch {
    // ignore
  }
  clearActiveTask();
}

/**
 * Clears the active task from sessionStorage (e.g. upon completion, cancellation, or error).
 */
export function clearActiveTask(): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    window.sessionStorage.removeItem(TASK_STORAGE_KEY);
    window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Returns true if an approved pending task currently exists in sessionStorage.
 */
export function isTaskPending(): boolean {
  const task = loadActiveTask();
  return Boolean(task && task.isApproved && !task.isCancelled && !task.isTimedOut && task.currentStepIndex < task.plan.steps.length);
}
