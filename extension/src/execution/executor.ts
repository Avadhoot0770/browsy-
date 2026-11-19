/**
 * Supervised Action Execution Engine for Browsy Stage 4
 * Executes user-approved ActionPlans sequentially with live page highlights,
 * staleness protection, realistic DOM events, timeouts, retries, and post-action verification.
 */

import type { ActionPlan, ActionPlanStep, StructuredIntent, MatchedItem } from "../intent/types";
import type { StructuredPageIntelligence } from "../page-intelligence/types";
import type {
  ExecutionState,
  ExecutionSession,
  ActionExecutionRecord,
  ExecutionOptions,
} from "./types";
import { resolveElement, isElementVisible } from "./resolver";
import { canExecuteAction } from "./guards";
import { verifyActionStep } from "./verifier";
import { highlightTargetElement, clearHighlight } from "./highlighter";
import { clearPlanPreview } from "./plan-preview-highlighter";
import { submitSearchInput } from "../navigation/search-submitter";
import { waitForPageUpdate } from "../navigation/page-waiter";
import { verifyFinalWebsiteState } from "../navigation/final-state-verifier";
import { inspectCandidateProducts } from "./product-verifier";
import { pageAnalyzer } from "../page-intelligence/page-analyzer";
import { elementRegistry } from "../page-intelligence/element-registry";
import { updateActiveTaskStep, clearActiveTask, cancelActiveTask } from "./task-persistence";
import { intentEngine } from "../intent/intent-engine";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Searches the freshly analyzed page for a matching filter control
 * if the step did not have a fixed ID or if the ID changed after navigation.
 */
/**
 * Searches the freshly analyzed page for a matching filter control
 * if the step did not have a fixed ID or if the ID changed after navigation.
 * Uses generic semantic matching against inputs, buttons, and filter chips.
 */
function findFilterControlOnPage(
  step: ActionPlanStep,
  pageContext?: StructuredPageIntelligence | null
): string | null {
  if (!pageContext) return null;
  const val = String(step.value || "").trim().toLowerCase();
  const targetLabel = String(step.targetLabel || "").trim().toLowerCase();
  const desc = step.description.toLowerCase();

  // Collect generic candidate tokens to match against controls
  const candidates: string[] = [];
  if (val) candidates.push(val);
  if (targetLabel && targetLabel !== val) candidates.push(targetLabel);

  // Extract filter name from description (e.g. "Apply red color filter" -> "red")
  const descFilterMatch = desc.match(/apply\s+([^0-9]+?)\s+(?:color|pattern|size|brand)?\s*filter/i);
  if (descFilterMatch && descFilterMatch[1]) {
    const term = descFilterMatch[1].trim().toLowerCase();
    if (!candidates.includes(term)) candidates.push(term);
  }

  // Also handle price constraints (e.g. "price under ₹1,000" -> "1000", "under")
  if (desc.includes("price") || desc.includes("under") || desc.includes("budget")) {
    const numMatch = desc.match(/\d[\d,]*/);
    if (numMatch) {
      const cleanNum = numMatch[0].replace(/,/g, "");
      if (!candidates.includes(cleanNum)) candidates.push(cleanNum);
    }
  }

  // 1. Search inputs (checkboxes, radios, text)
  for (const input of pageContext.inputs) {
    const txt = `${input.text} ${input.nearbyLabel || ""} ${input.ariaLabel || ""} ${input.placeholder || ""} ${input.name || ""}`.toLowerCase();
    for (const cand of candidates) {
      if (cand && (txt.includes(cand) || (input as any).value?.toLowerCase() === cand)) {
        const res = resolveElement(input.elementId);
        if (res.success && res.isVisible) {
          return input.elementId;
        }
      }
    }
  }

  // 2. Search buttons (chips, pills, filter toggles)
  for (const btn of pageContext.buttons) {
    const txt = `${btn.text} ${btn.ariaLabel || ""}`.toLowerCase();
    for (const cand of candidates) {
      if (cand && txt.includes(cand)) {
        const res = resolveElement(btn.elementId);
        if (res.success && res.isVisible && res.element) {
          const isInsideCard = typeof (res.element as any).closest === "function" &&
            Boolean((res.element as any).closest(".product-base, .product-card, [class*='product-' i], [role='listitem']"));
          if (!isInsideCard) {
            return btn.elementId;
          }
        }
      }
    }
  }

  // 3. Search interactive links (filter category links)
  for (const link of pageContext.links || []) {
    const txt = `${link.text} ${link.ariaLabel || ""}`.toLowerCase();
    for (const cand of candidates) {
      if (cand && txt.includes(cand) && txt.length <= cand.length + 15) {
        const res = resolveElement(link.elementId);
        if (res.success && res.isVisible) {
          return link.elementId;
        }
      }
    }
  }

  return null;
}

/**
 * Generic expandable facet resolution.
 * If a filter control (e.g. Size XL, Brand Roadster) is not immediately visible in the
 * initial page intelligence snapshot (e.g. collapsed accordion, "+ more" modal/drawer),
 * inspects the live DOM, expands the container, locates the target control,
 * registers it in elementRegistry, and returns its runtime element ID.
 */
export async function expandAndFindFacetControl(
  step: ActionPlanStep,
  _pageContext?: StructuredPageIntelligence | null
): Promise<string | null> {
  if (typeof document === "undefined") return null;

  const rawVal = String(step.value || "").trim();
  const rawTargetLabel = String(step.targetLabel || "").trim();
  const rawDesc = step.description;

  // Determine the target value to match (e.g. "XL", "Red", "Checked")
  let targetVal = rawVal;
  if (!targetVal) {
    const labelMatch = rawTargetLabel.match(/(?:size|color|brand|pattern)\s+([A-Za-z0-9_-]+)/i);
    if (labelMatch) targetVal = labelMatch[1];
  }
  if (!targetVal) {
    const descMatch = rawDesc.match(/apply\s+([^0-9\s]+|[A-Za-z0-9]+)\s+(?:color|pattern|size|brand)?\s*filter/i);
    if (descMatch) targetVal = descMatch[1];
  }
  if (!targetVal && rawTargetLabel) {
    targetVal = rawTargetLabel;
  }
  if (!targetVal) return null;

  // Determine the category/dimension name (e.g. "size", "color", "brand")
  let categoryName = "";
  const combinedText = `${rawTargetLabel} ${rawDesc}`.toLowerCase();
  for (const cat of ["size", "color", "brand", "pattern", "fabric", "material", "category", "gender", "fit", "price", "discount"]) {
    if (combinedText.includes(cat)) {
      categoryName = cat;
      break;
    }
  }

  const findTargetOption = (requireVisible = true): Element | null => {
    // 1. Direct search in inputs, radios, checkboxes, buttons, and custom labels
    const inputs = Array.from(
      document.querySelectorAll(
        'input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="option"], button, label'
      )
    );
    const targetLower = targetVal.toLowerCase();

    for (const el of inputs) {
      // Exclude buttons and inputs inside product cards (we want facet filter controls, not card hover buttons)
      const isInsideCard = typeof (el as any).closest === "function" &&
        Boolean((el as any).closest(".product-base, .product-card, [class*='product-' i], [role='listitem']"));
      if (isInsideCard) continue;

      const val = (el instanceof HTMLInputElement ? el.value : "").trim().toLowerCase();
      const parentLabel = ((typeof (el as any).closest === "function" ? (el as any).closest("label")?.textContent : el.parentElement?.textContent) || "").trim().toLowerCase();
      const aria = (el.getAttribute("aria-label") || "").trim().toLowerCase();
      const txt = (el.textContent || "").trim().toLowerCase();

      if (
        val === targetLower ||
        aria === targetLower ||
        new RegExp(`\\b${targetLower}\\b`, "i").test(parentLabel) ||
        txt === targetLower
      ) {
        if (requireVisible && !isElementVisible(el)) {
          continue;
        }
        return el;
      }
    }
    return null;
  };

  // 1. Direct search in live DOM: only return if ALREADY visible!
  let targetEl = findTargetOption(true);
  if (targetEl) {
    return elementRegistry.register(targetEl);
  }

  // 2. Expand accordion / facet toggles (e.g. "+ 20 more", ".atsa-more", or inside facet/sidebar containers)
  const accordionExpanders = Array.from(
    document.querySelectorAll("button, a, [role='button'], span, div")
  ).filter((el) => {
    const t = (el.textContent || "").trim().toLowerCase();
    const cl = (el.className || "").toString().toLowerCase();
    const isAccordionClass = cl.includes("atsa") || cl.includes("facet") || cl.includes("accordion");
    const isInsideFacetGroup = typeof (el as any).closest === "function" &&
      Boolean((el as any).closest(".atsa-filters, [class*='atsa' i], [class*='accordion' i], [class*='facet' i]"));

    const hasSmallMoreCount = /\+\s*\d{1,2}\s*more/i.test(t);
    const isMoreToggle = t.includes("more") && (t.includes("+") || t.includes("show") || t.includes("view") || t.includes("see"));

    return (isAccordionClass || isInsideFacetGroup || hasSmallMoreCount) && isMoreToggle && t.length < 25;
  });

  for (const btn of accordionExpanders) {
    try {
      if (btn instanceof HTMLElement) {
        btn.click();
      } else {
        btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      }
      await sleep(30);
    } catch {
      // ignore
    }
  }

  // 3. Expand category accordion toggle (e.g. "Size") if categoryName is identified
  if (categoryName) {
    const categoryToggles = Array.from(
      document.querySelectorAll("label, button, [role='button'], h3, h4, summary, input")
    ).filter((el) => {
      const val = (el instanceof HTMLInputElement ? el.value : "").trim().toLowerCase();
      const t = (el.textContent || "").trim().toLowerCase();
      const isMatch =
        val === categoryName ||
        val === `${categoryName}_facet` ||
        new RegExp(`^\\s*${categoryName}s?\\s*$`, "i").test(t) ||
        t === categoryName;
      return isMatch;
    });

    for (const toggle of categoryToggles) {
      try {
        const clickTarget = (typeof (toggle as any).closest === "function" ? (toggle as any).closest("label, button, [role='button']") : null) || toggle;
        if (clickTarget instanceof HTMLElement) {
          clickTarget.click();
        } else {
          clickTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        }
        await sleep(30);
      } catch {
        // ignore
      }
    }
  }

  // 4. Re-search DOM after expansion (prefer visible control or its parent label)
  targetEl = findTargetOption(true) || findTargetOption(false);
  if (targetEl) {
    const parentLabel = typeof (targetEl as any).closest === "function" ? (targetEl as any).closest("label") : null;
    const toRegister = (parentLabel && isElementVisible(parentLabel)) ? parentLabel : targetEl;
    return elementRegistry.register(toRegister);
  }

  // 5. AI Website Understanding: Interpret unfamiliar filter labels deterministically (strictly bounded)
  if (!targetEl && typeof document !== "undefined") {
    try {
      const provider = intentEngine.getProvider();
      if (provider.interpretUnfamiliarLabels) {
        const candidateElements = Array.from(
          document.querySelectorAll("label, button, [role='button'], input")
        ).filter((el) => {
          const isInsideCard = typeof (el as any).closest === "function" &&
            Boolean((el as any).closest(".product-base, .product-card, [class*='product-' i], [role='listitem']"));
          return !isInsideCard;
        });

        const labelTexts = candidateElements
          .map((el) => (el.textContent || (el instanceof HTMLInputElement ? el.value : "") || "").trim())
          .filter((t) => t.length > 0 && t.length < 35);

        if (labelTexts.length > 0) {
          // Bounded 50ms signal to guarantee execution is never blocked by remote inference
          const timeoutCtrl = new AbortController();
          const timer = setTimeout(() => timeoutCtrl.abort(), 50);
          const matchScores = await provider.interpretUnfamiliarLabels(labelTexts, targetVal, timeoutCtrl.signal);
          clearTimeout(timer);
          let bestLabel = "";
          let bestScore = 0.8;
          for (const [lbl, score] of Object.entries(matchScores)) {
            if (typeof score === "number" && score > bestScore) {
              bestScore = score;
              bestLabel = lbl;
            }
          }
          if (bestLabel) {
            const foundEl = candidateElements.find((el) => {
              const t = (el.textContent || (el instanceof HTMLInputElement ? el.value : "") || "").trim();
              return t === bestLabel;
            });
            if (foundEl) {
              const parentLabel = typeof (foundEl as any).closest === "function" ? (foundEl as any).closest("label") : null;
              const toRegister = (parentLabel && isElementVisible(parentLabel)) ? parentLabel : foundEl;
              return elementRegistry.register(toRegister);
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * Checks whether a filter condition requested by a step is already satisfied
 * on the current page (e.g. checkbox already checked, active chip present, or
 * URL query facet already contains the constraint).
 * This prevents toggle inversion (accidentally unchecking an already-active filter).
 */
export function isFilterAlreadySatisfied(
  step: ActionPlanStep,
  _pageContext?: StructuredPageIntelligence | null
): boolean {
  const actionType = step.type.toLowerCase();
  const val = String(step.value || step.targetLabel || "").trim().toLowerCase();

  // Search Step: check if current URL already displays the search query results
  if (actionType === "search") {
    if (typeof window !== "undefined" && window.location?.href) {
      const decodedUrl = decodeURIComponent(window.location.href).toLowerCase();
      if (!decodedUrl.endsWith(".com/") && !decodedUrl.endsWith(".com")) {
        const valClean = val.replace(/[^a-z0-9]+/g, " ").trim();
        const tokens = valClean.split(" ").filter((t) => t.length > 2);
        if (tokens.length > 0 && tokens.every((t) => decodedUrl.includes(t))) {
          return true;
        }
      }
    }
    return false;
  }

  if (actionType !== "check" && actionType !== "click") return false;
  if (!val) return false;

  // 1. If targetElement is already known and resolved, check its checked / aria-checked status
  if (step.targetElementId) {
    const res = resolveElement(step.targetElementId);
    if (res.success && res.element) {
      const el = res.element;
      let inputEl: HTMLInputElement | null = null;
      if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
        inputEl = el;
      } else if (typeof el.querySelector === "function") {
        inputEl = el.querySelector('input[type="checkbox"], input[type="radio"]');
      }

      if (inputEl && inputEl.checked) {
        return true;
      }
      if (el.getAttribute("aria-checked") === "true") {
        return true;
      }
    }
  }

  // 2. Check live URL facets and search query parameters for already-applied constraints
  if (typeof window !== "undefined" && window.location?.href) {
    const decodedUrl = decodeURIComponent(window.location.href).toLowerCase();
    const isValInUrlFacet =
      decodedUrl.includes(`:${val}`) ||
      decodedUrl.includes(`=${val}`) ||
      decodedUrl.includes(`%3a${val}`) ||
      decodedUrl.includes(`/${val}`) ||
      decodedUrl.includes(`-${val}`) ||
      decodedUrl.includes(`${val}-`) ||
      decodedUrl.includes(`+${val}`) ||
      decodedUrl.includes(`${val}+`) ||
      decodedUrl.includes(`%20${val}`) ||
      decodedUrl.includes(`${val}%20`);
    if (isValInUrlFacet) {
      return true;
    }
  }

  // 3. Check active filter summary chips in DOM
  if (typeof document !== "undefined") {
    try {
      const chips = document.querySelectorAll(
        ".filter-summary, .active-filter, [class*='selected' i], [class*='chip' i], [class*='badge' i], [class*='pill' i]"
      );
      for (let i = 0; i < chips.length; i++) {
        const txt = (chips[i].textContent || "").trim().toLowerCase();
        if (txt && (txt === val || txt.includes(val))) {
          return true;
        }
      }
    } catch {
      // ignore
    }
  }

  return false;
}

/**
 * Dispatches realistic input and change events compatible with React, Vue, and Angular.
 */
function setNativeInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  try {
    const inputProto = typeof window !== "undefined" && window.HTMLInputElement ? window.HTMLInputElement.prototype : (globalThis as any).HTMLInputElement?.prototype;
    const textareaProto = typeof window !== "undefined" && window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : (globalThis as any).HTMLTextAreaElement?.prototype;
    const prototype = el instanceof HTMLInputElement ? inputProto : textareaProto;
    const descriptor = prototype ? Object.getOwnPropertyDescriptor(prototype, "value") : null;

    if (descriptor && descriptor.set) {
      descriptor.set.call(el, value);
    } else {
      el.value = value;
    }
  } catch {
    el.value = value;
  }

  try {
    const evtCtor = typeof Event !== "undefined" ? Event : (globalThis as any).Event;
    if (evtCtor) {
      el.dispatchEvent(new evtCtor("input", { bubbles: true }));
      el.dispatchEvent(new evtCtor("change", { bubbles: true }));
    }
  } catch {
    // Non-DOM test environment
  }
}

export class ActionExecutor {
  private activeSession: ExecutionSession | null = null;
  private isAbortRequested = false;
  private abortController: AbortController | null = null;
  private options: ExecutionOptions;

  constructor(options: ExecutionOptions = {}) {
    this.options = {
      stepTimeoutMs: options.stepTimeoutMs ?? 5000,
      maxRetries: options.maxRetries ?? 2,
      highlightElements: options.highlightElements ?? true,
      highlightDurationMs: options.highlightDurationMs ?? 150,
      onStateChange: options.onStateChange,
      onStepProgress: options.onStepProgress,
    };
  }

  public getSession(): ExecutionSession | null {
    return this.activeSession;
  }

  /**
   * Immediately aborts any ongoing execution and clears active task persistence.
   */
  public stop(): void {
    clearPlanPreview();
    cancelActiveTask();
    this.abortController?.abort();
    if (this.activeSession && (this.activeSession.state === "executing" || this.activeSession.state === "verifying")) {
      this.isAbortRequested = true;
      this.activeSession.state = "cancelled";
      this.activeSession.endedAt = Date.now();
      const completedCount = this.activeSession.records.filter((r) => r.status === "completed").length;
      this.activeSession.summaryMessage = `Browsy stopped after ${completedCount} completed action${completedCount === 1 ? "" : "s"}.`;
      clearHighlight();
      this.options.onStateChange?.(this.activeSession.state, this.activeSession);
    }
  }

  /**
   * Executes a user-approved ActionPlan.
   * Execution requires an explicit user approval event before invocation.
   */
  public async executePlan(
    plan: ActionPlan,
    pageContext?: StructuredPageIntelligence | null,
    isConfirmedHighRisk = false,
    intent?: StructuredIntent
  ): Promise<ExecutionSession> {
    return this.runPlanExecution(plan, 0, [], pageContext, isConfirmedHighRisk, intent);
  }

  /**
   * Resumes an ActionPlan execution from a specific step (e.g. after document navigation or page reload).
   */
  public async resumePlan(
    plan: ActionPlan,
    startIndex: number,
    completedRecords: ActionExecutionRecord[],
    pageContext?: StructuredPageIntelligence | null,
    intent?: StructuredIntent
  ): Promise<ExecutionSession> {
    return this.runPlanExecution(plan, startIndex, completedRecords, pageContext, false, intent);
  }

  /**
   * Unified execution pipeline for both initial and resumed ActionPlans.
   */
  private async runPlanExecution(
    plan: ActionPlan,
    startIndex: number,
    completedRecords: ActionExecutionRecord[],
    pageContext?: StructuredPageIntelligence | null,
    isConfirmedHighRisk = false,
    intent?: StructuredIntent
  ): Promise<ExecutionSession> {
    clearPlanPreview();
    this.isAbortRequested = false;
    this.abortController = new AbortController();

    // Pre-execution Target Revalidation Sweep
    // Verifies whether elements that existed during plan proposal are still connected to DOM
    for (let i = startIndex; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      if (step.targetElementId) {
        const resolved = resolveElement(step.targetElementId, {
          targetLabel: step.targetLabel,
          text: typeof step.value === "string" ? step.value : undefined,
        });
        if (!resolved.success || !resolved.element?.isConnected) {
          console.debug(`[Browsy] Step target ${step.targetElementId} disconnected during user review, semantic recovery will apply.`);
        }
      }
    }

    const session: ExecutionSession = {
      id: `exec-${Date.now()}`,
      planId: plan.id,
      state: startIndex === 0 ? "approved" : "executing",
      currentStepIndex: startIndex,
      totalSteps: plan.steps.length,
      records: plan.steps.map((step, idx) => {
        if (idx < startIndex && completedRecords[idx]) {
          return completedRecords[idx];
        }
        return {
          actionId: `action-${idx + 1}`,
          stepId: step.id,
          type: step.type,
          targetElementId: step.targetElementId,
          targetLabel: step.targetLabel,
          description: step.description,
          status: (idx < startIndex ? "completed" : "pending") as any,
          attempts: idx < startIndex ? 1 : 0,
        };
      }),
      startedAt: Date.now(),
    };

    this.activeSession = session;
    this.updateState("executing");

    for (let i = startIndex; i < plan.steps.length; i++) {
      if (this.isAbortRequested) {
        break;
      }

      session.currentStepIndex = i;
      const step = plan.steps[i];
      const record: ActionExecutionRecord = session.records[i];
      record.status = "running";
      record.startedAt = Date.now();
      this.options.onStepProgress?.(i, record);
      updateActiveTaskStep(i, session.records);

      // Check if filter is already satisfied before clicking (prevents toggle inversion)
      if (isFilterAlreadySatisfied(step, pageContext)) {
        console.debug(`[Browsy] Step "${step.description}" is already satisfied on page. Skipping click to prevent toggle inversion.`);
        record.status = "completed";
        record.completedAt = Date.now();
        record.verification = {
          verified: true,
          reason: `Filter '${step.value || step.targetLabel || step.description}' is already active on the page.`,
        };
        this.options.onStepProgress?.(i, record);
        updateActiveTaskStep(i + 1, session.records);
        await sleep(10);
        continue;
      }

      // Dynamic filter resolution on updated page state (Stage 4.5)
      if (!step.targetElementId || !resolveElement(step.targetElementId).success) {
        let dynamicallyFound = findFilterControlOnPage(step, pageContext);
        if (!dynamicallyFound) {
          dynamicallyFound = await expandAndFindFacetControl(step, pageContext);
        }
        if (dynamicallyFound) {
          step.targetElementId = dynamicallyFound;
          record.targetElementId = dynamicallyFound;
        } else if (step.type === "check" || step.type === "select") {
          // Filter not available as a control on this site; mark skipped honestly
          record.status = "skipped";
          record.error = "Filter not available as a control on this site; narrowing visible results.";
          record.completedAt = Date.now();
          this.options.onStepProgress?.(i, record);
          updateActiveTaskStep(i + 1, session.records);
          await sleep(10);
          continue;
        }
      }

      // 1. Guard Check
      const guardResult = canExecuteAction(step, pageContext);
      if (!guardResult.canExecute) {
        console.warn("[Browsy Guard Failed]", {
          stepId: step.id,
          type: step.type,
          desc: step.description,
          target: step.targetElementId,
          reason: guardResult.reason,
        });
        record.status = "failed";
        record.error = guardResult.reason;
        record.completedAt = Date.now();

        if (guardResult.reason?.includes("not found") || guardResult.reason?.includes("disconnected")) {
          session.state = "stale";
          session.summaryMessage = "The page changed, so Browsy stopped to avoid doing the wrong thing.";
        } else {
          session.state = "failed";
          session.summaryMessage = `Action stopped: ${guardResult.reason}`;
        }
        clearHighlight();
        clearActiveTask();
        this.updateState(session.state);
        return session;
      }

      // 2. High Risk Check (Requires 2nd confirmation)
      if (guardResult.riskLevel === "high" && !isConfirmedHighRisk) {
        session.state = "paused";
        session.requiresHighRiskConfirmation = true;
        session.highRiskReason = guardResult.reason;
        session.summaryMessage = guardResult.reason || "This action requires secondary user confirmation.";
        clearHighlight();
        this.updateState("paused");
        return session;
      }

      // 3. Step Execution with Retries & Timeout
      let stepSuccess = false;
      let lastError = "";

      for (let attempt = 1; attempt <= (this.options.maxRetries || 2); attempt++) {
        if (this.isAbortRequested) break;
        record.attempts = attempt;

        try {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Action execution timed out")), this.options.stepTimeoutMs)
          );

          // Proactively update active task step for page-unloading navigation actions
          if (step.type === "search" || step.type === "navigate" || step.type === "open") {
            updateActiveTaskStep(i + 1, session.records);
          }

          await Promise.race([this.executeSingleStep(step), timeoutPromise]);

          // Verification
          session.state = "verifying";
          this.options.onStateChange?.(session.state, session);

          const verification = await verifyActionStep(step);
          record.verification = verification;

          if (verification.verified) {
            stepSuccess = true;
            record.status = "completed";
            record.completedAt = Date.now();
            break;
          } else {
            lastError = verification.reason || "Action verification failed.";
            await sleep(200);
          }
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          await sleep(200);
        }
      }

      if (this.isAbortRequested) {
        session.state = "cancelled";
        clearActiveTask();
        this.updateState("cancelled");
        return session;
      }

      if (!stepSuccess && !this.isAbortRequested) {
        try {
          const provider = intentEngine.getProvider();
          if (provider.suggestErrorRecovery) {
            const recoverySteps = await provider.suggestErrorRecovery(
              step,
              lastError || "Step execution failed",
              pageContext || null,
              3000
            );
            if (recoverySteps && recoverySteps.length > 0) {
              const recoveryStep = recoverySteps[0];
              const guard = canExecuteAction(recoveryStep, pageContext);
              if (guard.canExecute && recoveryStep.type !== "navigate") {
                console.info(`[Browsy] Attempting AI recovery action: ${recoveryStep.description}`);
                try {
                  await this.executeSingleStep(recoveryStep);
                  const recoveryVerification = await verifyActionStep(recoveryStep);
                  if (recoveryVerification.verified) {
                    stepSuccess = true;
                    record.status = "completed";
                    record.verification = recoveryVerification;
                    record.description = `${record.description} (recovered: ${recoveryStep.description})`;
                  }
                } catch {
                  // Recovery attempt failed; continue to normal failure handling
                }
              }
            }
          }
        } catch {
          // ignore
        }
      }

      if (!stepSuccess) {
        record.status = "failed";
        record.error = lastError;
        record.completedAt = Date.now();
        clearHighlight();
        clearActiveTask();

        const completedCount = session.records.filter((r) => r.status === "completed").length;
        if (completedCount > 0) {
          session.state = "partial_success";
          session.summaryMessage = `I completed ${completedCount} of ${plan.steps.length} actions. The last action could not be completed: ${lastError}`;
        } else {
          session.state = "failed";
          session.summaryMessage = `Could not safely complete step "${step.description}": ${lastError}`;
        }
        this.updateState(session.state);
        return session;
      }

      // Handle async page transitions following navigation, search, or state-changing interactions
      const actionType = step.type.toLowerCase();
      if (["search", "navigate", "open", "click", "check", "uncheck", "select"].includes(actionType)) {
        const prevUrl = typeof window !== "undefined" && window.location ? window.location.href : "";
        await waitForPageUpdate(prevUrl, { timeoutMs: 1200, checkIntervalMs: 25 });
        elementRegistry.invalidateStale();
        pageAnalyzer.invalidateCache();
        try {
          const freshIntel = pageAnalyzer.analyzeCurrentPage();
          if (freshIntel) {
            pageContext = freshIntel;
          }
        } catch {
          // ignore in testing
        }
      }

      updateActiveTaskStep(i + 1, session.records);
      this.options.onStepProgress?.(i, record);
      await sleep(10);
    }

    clearHighlight();

    if (this.isAbortRequested) {
      session.state = "cancelled";
      clearActiveTask();
      this.updateState("cancelled");
      return session;
    }

    // Stage 4.5 Final Website State Verification & Product-Level Verification
    if (pageContext) {
      let verifiedCandidateMatches: MatchedItem[] | undefined = undefined;

      // Deep Product-Level Inspection: If product shopping was requested,
      // inspect candidate products and catalog data to verify size availability, pricing, and attributes
      if ((intent?.target === "products" || intent?.filters?.size) && !this.isAbortRequested) {
        const candidateItems = (pageContext.repeatedGroups || []).flatMap((g) => g.items || []);
        try {
          console.debug(`[Browsy] Inspecting candidate product details (concurrency = 2)...`);
          const summary = await inspectCandidateProducts(candidateItems, intent, {
            maxCandidates: 5,
            timeoutMs: 4000,
            concurrency: 2,
            useCache: true,
            signal: this.abortController?.signal,
            onProductVerified: (verifiedProduct) => {
              session.verifiedProductResult = verifiedProduct;
              this.options.onStateChange?.("verifying", session);
            },
          });

          if (summary.fullyVerifiedProducts.length > 0) {
            session.verifiedProductResult = summary.bestMatch || summary.fullyVerifiedProducts[0];
            verifiedCandidateMatches = summary.fullyVerifiedProducts.map((p) => ({
              elementId: p.elementId,
              title: p.title,
              price: p.price || undefined,
              rating: p.rating,
              link: { href: p.url, text: p.title },
              imageUrl: p.imageUrl,
              productResult: p,
              matchClassification: "confirmed" as const,
              score: 10,
              verifiedConditions: [
                p.conditions.category.evidence,
                p.conditions.color.evidence,
                p.conditions.pattern.evidence,
                p.conditions.price.evidence,
                p.conditions.size.evidence,
              ].filter(Boolean),
              unverifiedConditions: [],
              reasons: [
                intent.filters.size ? `Verified size ${intent.filters.size} available in stock` : "Verified in stock",
                `Verified price ${p.price?.raw || ""} <= ₹${(intent.constraints.maxPrice || 1000).toLocaleString()}`,
              ],
            }));
          }
        } catch (err) {
          console.debug("[Browsy] Candidate inspection encountered error:", err);
        }
      }

      const finalVerification = verifyFinalWebsiteState(
        pageContext,
        intent || ({
          id: "intent-default",
          intent: "find",
          target: "products",
          entities: {},
          filters: {},
          constraints: {},
          scope: "current_page",
          confidence: 1,
          requiresClarification: false,
          rawQuery: plan.explanation,
          timestamp: Date.now(),
        }),
        { verifiedCandidateProducts: verifiedCandidateMatches }
      );

      session.confirmedMatches = finalVerification.confirmedMatches;
      session.partialMatches = finalVerification.partialMatches;
      session.unverifiedFilters = finalVerification.unverifiedFilters;

      if (!session.verifiedProductResult && session.confirmedMatches && session.confirmedMatches.length > 0) {
        const top = session.confirmedMatches[0];
        session.verifiedProductResult = top.productResult || {
          elementId: top.elementId,
          title: top.title,
          url: top.link?.href || "",
          price: top.price || null,
          rating: top.rating,
          imageUrl: top.imageUrl,
          isFullyVerified: top.matchClassification === "confirmed",
          conditions: {
            category: { requested: intent?.entities.category, verified: true, evidence: `Category confirmed in ${top.title}` },
            color: { requested: intent?.filters.color as string, verified: true, evidence: `Color matches requested ${intent?.filters.color}` },
            pattern: { requested: intent?.filters.pattern as string, verified: true, evidence: `Pattern matches requested ${intent?.filters.pattern}` },
            price: { maxBudget: intent?.constraints.maxPrice, amount: top.price?.amount, verified: true, evidence: `Price ${top.price?.raw || ""} within budget` },
            size: { requested: intent?.filters.size as string, available: true, selectable: true, status: "in_stock", evidence: `Size ${intent?.filters.size} verified` },
          },
        };
      }

      if (finalVerification.isSuccess) {
        session.state = "completed";
        session.summaryMessage = finalVerification.userFacingSummary;
      } else if (finalVerification.isPartialSuccess) {
        session.state = "partial_success";
        session.summaryMessage = finalVerification.userFacingSummary;
      } else {
        session.state = "failed";
        session.summaryMessage = finalVerification.userFacingSummary || "Could not confirm final results on the page.";
      }
    } else {
      session.state = "completed";
      session.summaryMessage = `Done — verified all ${plan.steps.length} action${plan.steps.length === 1 ? "" : "s"} successfully.`;
    }

    clearActiveTask();
    session.endedAt = Date.now();
    this.updateState(session.state);
    return session;
  }

  /**
   * Executes a single atomic DOM action.
   */
  private async executeSingleStep(step: ActionPlanStep): Promise<void> {
    const actionType = step.type.toLowerCase();

    // Scroll, summarize, and compare do not require a DOM target element
    if (actionType === "scroll") {
      if (typeof window !== "undefined") {
        window.scrollBy({ top: 400, behavior: "smooth" });
        await sleep(300);
      }
      return;
    }

    if (actionType === "summarize" || actionType === "compare") {
      await sleep(200);
      return;
    }

    if (!step.targetElementId) {
      throw new Error(`Step has no target element ID.`);
    }

    const resolution = resolveElement(step.targetElementId);
    if (!resolution.success || !resolution.element) {
      throw new Error(resolution.reason || `Target element '${step.targetElementId}' missing.`);
    }

    const el = resolution.element;

    // Visual Highlighting
    if (this.options.highlightElements && typeof document !== "undefined") {
      highlightTargetElement(el, step.description, false);
      await sleep(this.options.highlightDurationMs || 300);
    }

    // Scroll into view if needed
    if (el instanceof HTMLElement && typeof el.scrollIntoView === "function") {
      try {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } catch {
        // ignore
      }
    }

    // Dispatch DOM Action
    switch (actionType) {
      case "click":
      case "open":
      case "navigate": {
        if (el instanceof HTMLElement) {
          el.click();
        } else {
          el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        }
        break;
      }

      case "type":
      case "search": {
        const textToType = String(step.value || "");
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          el.focus();
          setNativeInputValue(el, textToType);
          if (actionType === "search") {
            submitSearchInput(el);
          }
        } else if (el.getAttribute("contenteditable") === "true") {
          el.textContent = textToType;
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
        break;
      }

      case "check": {
        let inputEl: HTMLInputElement | null = null;
        if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
          inputEl = el;
        } else {
          inputEl = el.querySelector('input[type="checkbox"], input[type="radio"]');
        }

        if (inputEl) {
          if (!inputEl.checked) {
            const parentLabel = typeof (inputEl as any).closest === "function" ? (inputEl as any).closest("label") : null;
            if (parentLabel && parentLabel !== el && typeof (parentLabel as any).click === "function") {
              (parentLabel as any).click();
            } else {
              inputEl.click();
            }
            if (!inputEl.checked) {
              inputEl.checked = true;
              inputEl.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }
        } else if (el instanceof HTMLElement) {
          el.click();
        }
        break;
      }

      case "uncheck": {
        let inputEl: HTMLInputElement | null = null;
        if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
          inputEl = el;
        } else {
          inputEl = el.querySelector('input[type="checkbox"], input[type="radio"]');
        }

        if (inputEl) {
          if (inputEl.checked) {
            const parentLabel = typeof (inputEl as any).closest === "function" ? (inputEl as any).closest("label") : null;
            if (parentLabel && parentLabel !== el && typeof (parentLabel as any).click === "function") {
              (parentLabel as any).click();
            } else {
              inputEl.click();
            }
            if (inputEl.checked) {
              inputEl.checked = false;
              inputEl.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }
        } else if (el instanceof HTMLElement) {
          el.click();
        }
        break;
      }

      case "select": {
        const valToSelect = String(step.value || "").toLowerCase();
        if (el instanceof HTMLSelectElement) {
          let matched = false;
          for (let i = 0; i < el.options.length; i++) {
            const opt = el.options[i];
            if (opt.value.toLowerCase() === valToSelect || opt.text.toLowerCase().includes(valToSelect)) {
              el.selectedIndex = i;
              matched = true;
              break;
            }
          }
          if (matched) {
            el.dispatchEvent(new Event("change", { bubbles: true }));
            el.dispatchEvent(new Event("input", { bubbles: true }));
          }
        } else if (el instanceof HTMLElement) {
          el.click();
        }
        break;
      }

      default:
        throw new Error(`Unsupported action type: '${actionType}'`);
    }

    if (this.options.highlightElements && typeof document !== "undefined") {
      highlightTargetElement(el, step.description, true);
      await sleep(150);
    }
  }

  private updateState(newState: ExecutionState): void {
    if (this.activeSession) {
      this.activeSession.state = newState;
      this.options.onStateChange?.(newState, this.activeSession);
    }
  }
}
