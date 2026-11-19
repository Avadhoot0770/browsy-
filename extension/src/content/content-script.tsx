import React, { useState, useEffect, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import { BrowsyLauncher, type AssistantVisualState } from "./BrowsyLauncher";
import { BrowsyPanel } from "./BrowsyPanel";
import {
  SHADOW_HOST_ID,
  APP_CONTAINER_ID,
} from "../shared/constants";
import {
  MessageActions,
  type UserRequestMessage,
  type ExtensionMessage,
} from "../shared/messages";
import type { ChatMessage, PageContext } from "../shared/types";
import {
  pageAnalyzer,
  pageObserver,
  elementRegistry,
} from "../page-intelligence";
import { intentEngine } from "../intent";
import type { ActionPlan, StructuredIntent } from "../intent/types";
import {
  ActionExecutor,
  type ExecutionSession,
  renderPlanPreview,
  clearPlanPreview,
  saveActiveTask,
  loadActiveTask,
  clearActiveTask,
  locateAndFocusProductElement,
} from "../execution";
import { isEligibleForAutoExecution } from "../execution/high-risk";
import { formatFriendlySiteName } from "../navigation/final-state-verifier";
import styles from "./styles.css?inline";

/**
 * Browsy App Root rendered inside the isolated Shadow DOM
 */
const BrowsyContentApp: React.FC = () => {
  const initialVisualState: AssistantVisualState = (() => {
    if (typeof window !== "undefined" && window.sessionStorage) {
      const saved = window.sessionStorage.getItem("browsy_visual_state");
      if (saved === "panel" || saved === "expanded") return saved as AssistantVisualState;
      if (window.sessionStorage.getItem("browsy_active_task_v2")) return "panel";
    }
    return "compact";
  })();

  const [visualState, setVisualStateState] = useState<AssistantVisualState>(initialVisualState);

  const setVisualState = useCallback((val: AssistantVisualState) => {
    setVisualStateState(val);
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.setItem("browsy_visual_state", val);
      }
    } catch {}
  }, []);

  const isOpen = visualState === "panel";
  const [pageContext, setPageContext] = useState<PageContext>(() => ({
    url: window.location.href,
    hostname: window.location.hostname,
    pathname: window.location.pathname,
    title: document.title || window.location.hostname,
    timestamp: Date.now(),
  }));
  const pageContextRef = useRef<PageContext>(pageContext);
  pageContextRef.current = pageContext;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeSession, setActiveSession] = useState<ExecutionSession | null>(null);
  const executorRef = useRef<ActionExecutor | null>(null);
  const isProcessingRef = useRef<boolean>(false);

  if (!executorRef.current) {
    executorRef.current = new ActionExecutor({
      stepTimeoutMs: 5000,
      maxRetries: 2,
      highlightElements: true,
      highlightDurationMs: 120, // Snappy 120ms highlight duration
      onStateChange: (_state, session) => {
        setActiveSession({ ...session });
      },
      onStepProgress: (_idx, _record) => {
        if (executorRef.current) {
          const s = executorRef.current.getSession();
          if (s) setActiveSession({ ...s });
        }
      },
    });
  }

  // Function to perform controlled page intelligence analysis
  const runAnalysis = useCallback(() => {
    try {
      const intel = pageAnalyzer.analyzeCurrentPage();
      setPageContext({
        url: window.location.href,
        hostname: window.location.hostname,
        pathname: window.location.pathname,
        title: document.title || window.location.hostname,
        timestamp: Date.now(),
        intelligence: intel,
      });
    } catch (err) {
      console.error("[Browsy] Page analysis encountered an error:", err);
    }
  }, []);

  // Initial Page Intelligence Analysis on page load
  useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);

  // Page Observer lifecycle: only observe DOM mutations when the panel is open or actively executing
  useEffect(() => {
    if (!isOpen && activeSession?.state !== "executing") {
      pageObserver.stop();
      return;
    }

    pageObserver.start();
    const unsubscribeObserver = pageObserver.subscribe((reason) => {
      console.debug(`[Browsy] Dynamic update detected (${reason}), re-analyzing...`);
      if (reason === "navigation") {
        const currentSession = executorRef.current?.getSession();
        if (!currentSession || currentSession.state !== "executing") {
          executorRef.current?.stop();
          setActiveSession(null);
        }
      }
      runAnalysis();
    });

    return () => {
      unsubscribeObserver();
      pageObserver.stop();
    };
  }, [isOpen, activeSession?.state, runAnalysis]);

  // Listen for messages from background script or popup
  useEffect(() => {
    const messageListener = (
      message: ExtensionMessage,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void
    ) => {
      if (message.action === MessageActions.OPEN_ASSISTANT) {
        setVisualState("panel");
        sendResponse({ success: true });
      } else if (message.action === MessageActions.CLOSE_ASSISTANT) {
        setVisualState("compact");
        sendResponse({ success: true });
      } else if (message.action === MessageActions.GET_PAGE_CONTEXT) {
        sendResponse({ context: pageContextRef.current });
      } else if (message.action === MessageActions.GET_PAGE_INTELLIGENCE) {
        sendResponse({ intelligence: pageContextRef.current.intelligence });
      } else if (message.action === MessageActions.REFRESH_PAGE_INTELLIGENCE) {
        runAnalysis();
        sendResponse({ success: true, intelligence: pageContextRef.current.intelligence });
      } else if (message.action === MessageActions.GET_ELEMENT_DETAILS) {
        const targetId = message.elementId;
        const el = elementRegistry.get(targetId);
        sendResponse({
          elementId: targetId,
          exists: Boolean(el),
          isStale: elementRegistry.isStale(targetId),
        });
      }
      return true;
    };

    try {
      chrome.runtime?.onMessage?.addListener(messageListener);
    } catch {
      // In local testing environments without chrome.runtime
    }

    return () => {
      try {
        chrome.runtime?.onMessage?.removeListener(messageListener);
      } catch {
        // cleanup
      }
    };
  }, [runAnalysis]);

  // Visual Interaction Explainability: Pre-interaction Plan Preview Overlay
  useEffect(() => {
    // If panel is closed or minimized, clear preview immediately
    if (visualState !== "panel") {
      clearPlanPreview();
      return;
    }

    // Find latest assistant message with a proposed plan
    const lastMsg = messages[messages.length - 1];
    const hasProposedPlan =
      lastMsg &&
      lastMsg.role === "assistant" &&
      lastMsg.intentResult &&
      lastMsg.intentResult.plan &&
      lastMsg.intentResult.plan.steps.length > 0 &&
      (!activeSession || activeSession.state === "proposed" || activeSession.state === "awaiting_approval");

    if (hasProposedPlan && lastMsg.intentResult) {
      renderPlanPreview(lastMsg.intentResult.plan);
    } else {
      clearPlanPreview();
    }

    return () => {
      clearPlanPreview();
    };
  }, [visualState, messages, activeSession]);

  // Handle user request submission
  const handleSendMessage = async (text: string) => {
    if (!text || !text.trim()) return;

    // Failure Recovery: If an active execution is currently in-flight, cleanly stop it before processing follow-up
    if (executorRef.current) {
      const currentSession = executorRef.current.getSession();
      if (currentSession && (currentSession.state === "executing" || currentSession.state === "verifying")) {
        console.debug("[Browsy] Active task running while new message received; cleanly stopping active task.");
        executorRef.current.stop();
        isProcessingRef.current = false;
      }
    }

    // Stage 2 Instant Interaction Guard: prevent duplicate submissions
    if (isProcessingRef.current) {
      console.debug("[Browsy] Request ignored: workflow already active.");
      return;
    }

    isProcessingRef.current = true;
    clearActiveTask();
    clearPlanPreview();

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
      pageContext,
      status: "delivered",
    };

    // Responsive Interaction: immediate visual acknowledgement within 50 ms
    const placeholderId = `msg-${Date.now() + 1}`;
    const placeholderMsg: ChatMessage = {
      id: placeholderId,
      role: "assistant",
      content: "✦ Analyzing request...",
      timestamp: Date.now(),
      pageContext: pageContextRef.current,
      status: "pending",
    };

    setMessages((prev) => [...prev, userMsg, placeholderMsg]);

    // Send typed request to background service worker (Part 12)
    try {
      const msg: UserRequestMessage = {
        action: MessageActions.USER_REQUEST,
        prompt: text,
        context: pageContext,
        timestamp: Date.now(),
      };
      chrome.runtime?.sendMessage?.(msg, (response) => {
        if (chrome.runtime.lastError) {
          console.debug("[Browsy] Service worker response:", chrome.runtime.lastError.message);
        } else if (response) {
          console.debug("[Browsy] Service worker acknowledged request");
        }
      });
    } catch {
      // Offline / standalone fallback
    }

    try {
      // Process request through Stage 3 AI Intent Engine
      const result = await intentEngine.processRequest(
        text,
        pageContextRef.current.intelligence || null
      );

      // Update UI with proposed plan
      const updatedMessages: ChatMessage[] = [
        ...messages.filter((m) => m.id !== placeholderId),
        {
          id: placeholderId,
          role: "assistant" as const,
          content: result.summaryMessage,
          timestamp: Date.now(),
          pageContext: pageContextRef.current,
          status: "received" as const,
          intentResult: result,
        },
      ];
      setMessages(updatedMessages);

      console.log("[Browsy Intent Result]", {
        stepsCount: result.plan?.steps?.length,
        steps: result.plan?.steps?.map((s) => ({ type: s.type, desc: s.description })),
        requiresClarification: result.requiresClarification,
        isAutoEligible: result.plan ? isEligibleForAutoExecution(result.plan) : false,
      });

      // Hands-free automated execution for ordinary, low-risk browsing/filtering/searching
      if (
        result.plan &&
        result.plan.steps.length > 0 &&
        !result.requiresClarification &&
        isEligibleForAutoExecution(result.plan)
      ) {
        console.log("[Browsy Auto-Executing Plan]");
        await handleExecutePlan(placeholderId, result.plan, false, result.intent, updatedMessages);
      }
    } catch (err) {
      console.error("[Browsy] Intent engine error:", err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? {
                ...m,
                content:
                  "I encountered an issue understanding that request. Try asking something like: 'Find red checked shirts in XL under ₹1,000'.",
                timestamp: Date.now(),
                pageContext,
                status: "received",
              }
            : m
        )
      );
    } finally {
      isProcessingRef.current = false;
    }
  };

  // Check and resume pending execution across document navigations (e.g. Myntra search reload)
  useEffect(() => {
    const pendingTask = loadActiveTask();
    if (!pendingTask || !pendingTask.isApproved || !pendingTask.plan) return;

    try {
      setVisualState("panel");
      if (pendingTask.messages && Array.isArray(pendingTask.messages)) {
        setMessages(pendingTask.messages);
      }

      const initialSession: ExecutionSession = {
        id: pendingTask.taskId || `exec-${Date.now()}`,
        planId: pendingTask.plan.id,
        state: "executing",
        currentStepIndex: pendingTask.currentStepIndex,
        totalSteps: pendingTask.plan.steps.length,
        records: pendingTask.plan.steps.map((step: any, idx: number) => {
          if (idx < pendingTask.currentStepIndex && pendingTask.completedRecords?.[idx]) {
            return pendingTask.completedRecords[idx];
          }
          return {
            actionId: `action-${idx + 1}`,
            stepId: step.id,
            type: step.type,
            targetElementId: step.targetElementId,
            targetLabel: step.targetLabel,
            description: step.description,
            status: idx === pendingTask.currentStepIndex ? ("running" as const) : idx < pendingTask.currentStepIndex ? ("completed" as const) : ("pending" as const),
            attempts: idx < pendingTask.currentStepIndex ? 1 : 0,
          };
        }),
        startedAt: Date.now(),
      };
      setActiveSession(initialSession);

      // Controlled condition-based resumption instead of fixed 1200ms sleep
      let isCancelled = false;
      const pollAndResume = async () => {
        const start = Date.now();
        // Adaptive condition-based wait: up to 3500ms on cold loads, breaking early as soon as cards mount
        while (!isCancelled && Date.now() - start < 3500) {
          const hasCards = Boolean(
            document.querySelector(
              ".product-base, [data-testid*='product'], [class*='product-base'], article, .product-card, [role='listitem']"
            )
          );
          if (document.readyState === "complete" && hasCards) {
            break;
          }
          if (hasCards && Date.now() - start > 350) {
            // Product cards already mounted and interactive
            break;
          }
          await new Promise((r) => setTimeout(r, 40));
        }

        if (isCancelled) return;

        // Single controlled analysis pass
        runAnalysis();
        const freshIntel = pageContextRef.current.intelligence || pageAnalyzer.analyzeCurrentPage();
        if (executorRef.current) {
          const resumed = await executorRef.current.resumePlan(
            pendingTask.plan,
            pendingTask.currentStepIndex,
            pendingTask.completedRecords || [],
            freshIntel,
            pendingTask.intent
          );
          setActiveSession({ ...resumed });

          const defaultIntent: StructuredIntent = pendingTask.intent || {
            id: "intent-resumed",
            intent: "find",
            target: "products",
            entities: {},
            filters: {},
            constraints: {},
            scope: "current_page",
            confidence: 1,
            requiresClarification: false,
            rawQuery: pendingTask.originalQuery || "",
            timestamp: Date.now(),
          };

          // Update messages with resumed execution session and verified product result
          setMessages((prev) => {
            let found = false;
            const updated = prev.map((m) => {
              if (m.intentResult?.plan?.id === resumed.planId || m.role === "assistant") {
                found = true;
                return {
                  ...m,
                  intentResult: m.intentResult || {
                    plan: pendingTask.plan,
                    intent: defaultIntent,
                    requiresClarification: false,
                    summaryMessage: resumed.summaryMessage || "",
                    matchedItems: [],
                  },
                  executionSession: { ...resumed },
                };
              }
              return m;
            });
            if (!found) {
              return [
                ...updated,
                {
                  id: `msg-${Date.now()}`,
                  role: "assistant" as const,
                  content: resumed.summaryMessage || "Showing matching results.",
                  timestamp: Date.now(),
                  pageContext: {
                    url: window.location.href,
                    hostname: window.location.hostname,
                    pathname: window.location.pathname,
                    title: document.title,
                    timestamp: Date.now(),
                    intelligence: freshIntel,
                  },
                  status: "received" as const,
                  intentResult: {
                    plan: pendingTask.plan,
                    intent: defaultIntent,
                    requiresClarification: false,
                    summaryMessage: resumed.summaryMessage || "",
                    matchedItems: [],
                  },
                  executionSession: { ...resumed },
                },
              ];
            }
            return updated;
          });
        }
      };

      pollAndResume();

      return () => {
        isCancelled = true;
      };
    } catch (err) {
      console.error("[Browsy] Error resuming navigation execution:", err);
    }
  }, [runAnalysis]);

  // Stage 4: Supervised plan execution handler
  const handleExecutePlan = async (
    messageId: string,
    plan: ActionPlan,
    isHighRiskConfirmed = false,
    providedIntent?: StructuredIntent,
    activeMessagesList?: ChatMessage[]
  ) => {
    clearPlanPreview();
    if (!executorRef.current) return;
    try {
      const msgsToUse = activeMessagesList || messages;
      const targetMsg = msgsToUse.find((m) => m.id === messageId);
      const targetIntent = providedIntent || targetMsg?.intentResult?.intent;

      const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      saveActiveTask({
        taskId,
        plan,
        intent: targetIntent,
        originalQuery: targetMsg?.content || plan.explanation,
        currentStepIndex: 0,
        completedRecords: [],
        isApproved: true,
        messages: msgsToUse,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const session = await executorRef.current.executePlan(
        plan,
        pageContextRef.current.intelligence,
        isHighRiskConfirmed,
        targetIntent
      );
      if (session.state === "completed" || session.state === "cancelled") {
        clearActiveTask();
      }
      setActiveSession({ ...session });

      // Update the message bubble with the execution session
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, executionSession: { ...session } } : m
        )
      );

      // Re-scan webpage after execution to keep Page Intelligence fresh
      setTimeout(() => {
        runAnalysis();
      }, 300);

      // Append assistant confirmation for terminal state (suppress redundant text bubble when product result card is present)
      if (session.state === "completed" && !session.verifiedProductResult) {
        const summaryMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: `✓ Done\n\n${session.summaryMessage || `${formatFriendlySiteName(window.location.hostname)} is showing results matching your request.`}`,
          timestamp: Date.now(),
          pageContext,
          status: "received",
        };
        setMessages((prev) => [...prev, summaryMsg]);
      } else if (session.state === "partial_success" && !session.verifiedProductResult) {
        const summaryMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: `Partially completed\n\n${session.summaryMessage || "I applied the filters I could verify, but I couldn't verify all criteria on this site."}`,
          timestamp: Date.now(),
          pageContext,
          status: "received",
        };
        setMessages((prev) => [...prev, summaryMsg]);
      } else if (session.state === "failed") {
        const summaryMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: `Action stopped\n\n${session.summaryMessage || "Could not complete the requested action on this page."}`,
          timestamp: Date.now(),
          pageContext,
          status: "received",
        };
        setMessages((prev) => [...prev, summaryMsg]);
      } else if (session.state === "cancelled") {
        const summaryMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: `Execution stopped by user\n\n${session.summaryMessage || "Browsy stopped executing actions."}`,
          timestamp: Date.now(),
          pageContext,
          status: "received",
        };
        setMessages((prev) => [...prev, summaryMsg]);
      }
    } catch (err) {
      console.error("[Browsy] Supervised execution error:", err);
    }
  };

  const handleFocusProduct = useCallback((target: { elementId?: string; title?: string; url?: string }) => {
    const res = locateAndFocusProductElement(target);
    console.debug("[Browsy Focus Bridge]", res);
    return res;
  }, []);

  const handleStopExecution = () => {
    isProcessingRef.current = false;
    clearActiveTask();
    clearPlanPreview();
    executorRef.current?.stop();
  };

  return (
    <>
      <BrowsyLauncher
        visualState={visualState}
        onChangeState={setVisualState}
        isOpen={isOpen}
        onOpen={() => setVisualState("panel")}
        onClose={() => setVisualState("compact")}
      />
      <BrowsyPanel
        isOpen={isOpen}
        onClose={() => setVisualState("compact")}
        onMinimize={() => setVisualState("compact")}
        pageContext={pageContext}
        messages={messages}
        onSendMessage={handleSendMessage}
        onRefreshIntelligence={runAnalysis}
        onExecutePlan={handleExecutePlan}
        onStopExecution={handleStopExecution}
        activeExecutionSession={activeSession}
        onFocusProduct={handleFocusProduct}
      />
    </>
  );
};

/**
 * Initializes and mounts Browsy inside an isolated Shadow DOM root
 */
function initBrowsy() {
  // Guard 0: Do not inject into iframe or subframes
  if (typeof window !== "undefined" && window.self !== window.top) {
    return;
  }

  // Guard 1: Do not inject into special browser pages or invalid origins (Part 15)
  const currentUrl = window.location.href.toLowerCase();
  if (
    currentUrl.startsWith("chrome://") ||
    currentUrl.startsWith("chrome-extension://") ||
    currentUrl.startsWith("brave://") ||
    currentUrl.startsWith("edge://") ||
    currentUrl.startsWith("about:") ||
    currentUrl.startsWith("view-source:")
  ) {
    return;
  }

  // Guard 2: Prevent duplicate injection
  if (document.getElementById(SHADOW_HOST_ID)) {
    return;
  }

  try {
    // 1. Create the Host Element
    const hostElement = document.createElement("browsy-root");
    hostElement.id = SHADOW_HOST_ID;
    hostElement.setAttribute("data-browsy-root", "true");
    hostElement.style.cssText =
      "all: initial; position: static; z-index: 2147483647; display: block;";

    // 2. Attach Shadow Root for strict style isolation
    const shadowRoot = hostElement.attachShadow({ mode: "open" });

    // 3. Inject Scoped CSS into Shadow DOM
    const styleTag = document.createElement("style");
    styleTag.textContent = styles;
    shadowRoot.appendChild(styleTag);

    // 4. Create Mount Container
    const appContainer = document.createElement("div");
    appContainer.id = APP_CONTAINER_ID;
    shadowRoot.appendChild(appContainer);

    // 5. Append host to document root
    document.documentElement.appendChild(hostElement);

    // 6. Mount React App
    const root = createRoot(appContainer);
    root.render(<BrowsyContentApp />);

    console.info("[Browsy] Extension mounted successfully with Stage 2 Page Intelligence.");
  } catch (error) {
    console.error("[Browsy] Failed to initialize extension:", error);
  }
}

// Run when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initBrowsy);
} else {
  initBrowsy();
}
