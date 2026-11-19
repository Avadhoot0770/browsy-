import React, { useState, useRef, useEffect } from "react";
import type { ChatMessage, PageContext } from "../shared/types";
import type { ActionPlan } from "../intent/types";
import type { ExecutionSession } from "../execution/types";
import { resolveStepPreviewTarget } from "../execution";
import { isEligibleForAutoExecution } from "../execution/high-risk";
import { DeveloperInspector } from "./DeveloperInspector";
import { useDraggable, type Position } from "./useDraggable";
import { VerifiedProductCard } from "./VerifiedProductCard";
import { intentEngine } from "../intent/intent-engine";
import type { ProviderStatus } from "../intent/provider";

interface BrowsyPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onMinimize?: () => void;
  pageContext: PageContext;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onRefreshIntelligence?: () => void;
  onExecutePlan?: (messageId: string, plan: ActionPlan, isHighRiskConfirmed?: boolean) => void;
  onStopExecution?: () => void;
  activeExecutionSession?: ExecutionSession | null;
  onFocusProduct?: (target: { elementId?: string; title?: string; url?: string }) => any;
}

const DEFAULT_PANEL_POS = (): Position => {
  if (typeof window === "undefined") return { x: 800, y: 60 };
  const w = window.innerWidth;
  const h = window.innerHeight;
  const panelW = 450;
  const panelH = 700;
  return {
    x: Math.max(16, w - panelW - 20),
    y: Math.max(16, Math.round((h - panelH) / 2)),
  };
};

export const BrowsyPanel: React.FC<BrowsyPanelProps> = ({
  isOpen,
  onClose,
  onMinimize,
  pageContext,
  messages,
  onSendMessage,
  onRefreshIntelligence,
  onExecutePlan,
  onStopExecution,
  activeExecutionSession,
  onFocusProduct,
}) => {
  const [input, setInput] = useState("");
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<ProviderStatus | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch local AI provider status
  useEffect(() => {
    if (isOpen) {
      intentEngine.getProviderStatus().then((status) => {
        setAiStatus(status);
      }).catch(() => {});
    }
  }, [isOpen]);

  // Hook for dragging the panel by its header
  const { position, isDragging, bindProps } = useDraggable({
    storageKey: "browsy_panel_pos",
    defaultPosition: DEFAULT_PANEL_POS,
    elementWidth: 450,
    elementHeight: 700,
    margin: 16,
  });

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isInspectorOpen) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isInspectorOpen]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Keyboard shortcut: Escape to close / minimize, Ctrl+Shift+B for inspector
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Developer Inspector via Ctrl+Shift+B
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsInspectorOpen((prev) => !prev);
        return;
      }

      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        if (isInspectorOpen) {
          setIsInspectorOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isInspectorOpen, onClose]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    onSendMessage(trimmed);
    setInput("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto grow textarea smoothly
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  // 3 friendly suggestion cards as requested
  const suggestions = [
    {
      title: "Find products or apply filters",
      prompt: "Find me a red checked shirt in XL under ₹1,000",
    },
    {
      title: "Find search or filter options on this page",
      prompt: "Find the search or filter options on this page",
    },
    {
      title: "Summarize the key information on this page",
      prompt: "Summarize the key information on this page",
    },
  ];

  const intelligence = pageContext.intelligence;

  return (
    <>
      {/* Backdrop for closing by clicking outside — clean and unobtrusive */}
      <div
        className={`browsy-backdrop ${isOpen ? "open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Main Draggable Assistant Panel */}
      <aside
        className={`browsy-panel ${isOpen ? "open" : ""} ${isDragging ? "dragging" : ""}`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
        role="dialog"
        aria-label="Browsy Web Assistant"
        aria-modal="true"
      >
        {/* Developer Inspector Overlay */}
        <DeveloperInspector
          intelligence={intelligence || null}
          isOpen={isInspectorOpen}
          onClose={() => setIsInspectorOpen(false)}
          onRefresh={() => onRefreshIntelligence?.()}
        />

        {/* Draggable Header */}
        <div
          className="browsy-header"
          {...bindProps}
          title="Drag anywhere to reposition Browsy"
        >
          <div className="browsy-header-row">
            {/* Left: Brand & Status */}
            <div className="browsy-brand">
              <div className="browsy-icon-box" aria-hidden="true">
                ✦
              </div>
              <div className="browsy-brand-text">
                <div className="browsy-brand-title-row">
                  <h1>Browsy</h1>
                  <span className="browsy-readiness-pill" title="Active on this tab">
                    <span className="browsy-status-dot" />
                    Active
                  </span>
                  <button
                    type="button"
                    className={`browsy-ai-pill ${aiStatus?.available ? "online" : "offline"}`}
                    title={
                      aiStatus?.available
                        ? `Local AI connected (${aiStatus.activeModel || "Ollama"}). Click to inspect.`
                        : "Deterministic mode (Ollama offline). Click to configure."
                    }
                    onClick={() => setIsInspectorOpen(true)}
                  >
                    <span className={`browsy-ai-dot ${aiStatus?.available ? "online" : "offline"}`} />
                    {aiStatus?.available ? (aiStatus.activeModel || "LOCAL AI") : "DETERMINISTIC"}
                  </button>
                </div>
                <p>Your browser assistant</p>
              </div>
            </div>

            {/* Right: Controls & Actions (prevent drag propagation) */}
            <div
              className="browsy-header-actions"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="browsy-inspect-btn"
                onClick={() => setIsInspectorOpen(true)}
                title="Open Page Intelligence Inspector (Ctrl+Shift+B)"
              >
                Inspect
              </button>

              <button
                type="button"
                className="browsy-minimize-btn"
                onClick={() => {
                  if (onMinimize) onMinimize();
                  else onClose();
                }}
                aria-label="Minimize assistant"
                title="Minimize assistant"
              >
                –
              </button>

              <button
                type="button"
                className="browsy-close-btn"
                onClick={onClose}
                aria-label="Close assistant (Escape)"
                title="Close assistant (Esc)"
              >
                ×
              </button>
            </div>
          </div>

          {/* Current Page Awareness Card */}
          <div className="browsy-page-card" onPointerDown={(e) => e.stopPropagation()}>
            <div className="browsy-page-card-top">
              <span className="browsy-page-label">You&apos;re on</span>
              {intelligence ? (
                <div
                  className="browsy-status-pill"
                  title="Page structure understood locally by Browsy Page Intelligence"
                >
                  <span className="browsy-status-pill-dot" />
                  PAGE UNDERSTOOD ·{" "}
                  {intelligence.stats.repeatedItemCount > 0
                    ? `${intelligence.stats.repeatedItemCount} items`
                    : `${intelligence.stats.totalInteractiveCount} controls`}
                </div>
              ) : (
                <div className="browsy-status-pill">
                  <span className="browsy-status-pill-dot" />
                  PAGE DETECTED
                </div>
              )}
            </div>
            <div className="browsy-page-domain">
              <span>{pageContext.hostname || "Current Webpage"}</span>
            </div>
            {pageContext.title && (
              <div className="browsy-page-title" title={pageContext.title}>
                {pageContext.title}
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Conversation Body */}
        <div className="browsy-body">
          {messages.length === 0 ? (
            <div className="browsy-welcome-card">
              <h3>What can I help you do on this page?</h3>
              <p>
                Tell Browsy what you want to accomplish. Review its proposed actions
                before anything happens.
              </p>

              <div className="browsy-suggestions">
                {suggestions.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    className="browsy-suggestion-card"
                    onClick={() => {
                      setInput(item.prompt);
                      textareaRef.current?.focus();
                    }}
                  >
                    <div className="browsy-suggestion-header">
                      <span className="browsy-suggestion-icon" aria-hidden="true">
                        ✦
                      </span>
                      <span className="browsy-suggestion-title">{item.title}</span>
                    </div>
                    <span className="browsy-suggestion-prompt">“{item.prompt}”</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const plan = msg.intentResult?.plan;
              const session =
                activeExecutionSession?.planId === plan?.id
                  ? activeExecutionSession
                  : msg.executionSession;
              const hasVerifiedResult = Boolean(session?.verifiedProductResult);

              return (
              <div key={msg.id} className={`browsy-message-wrap ${msg.role}`}>
                <div className="browsy-message-bubble">
                  {msg.role === "assistant" && (
                    <div className="browsy-stage3-badge">
                      ✦ {msg.status === "pending" ? "Browsy Working..." : "Browsy Assistant"}
                    </div>
                  )}
                  <div className="browsy-message-text" style={{ whiteSpace: "pre-wrap" }}>
                    {msg.status === "pending" ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <span className="browsy-pulse-dot" />
                        {msg.content}
                      </span>
                    ) : (
                      msg.content
                    )}
                  </div>

                  {/* 1. What I Understood Card */}
                  {msg.intentResult &&
                    !msg.intentResult.requiresClarification &&
                    msg.intentResult.intent.intent !== "unknown" &&
                    !hasVerifiedResult && (
                      <div className="browsy-understood-card">
                        <div className="browsy-understood-header">
                          <span>What I Understood</span>
                          <span className="browsy-confidence-badge">
                            {Math.round(msg.intentResult.intent.confidence * 100)}% confidence
                          </span>
                        </div>
                        <div className="browsy-understood-grid">
                          {msg.intentResult.intent.entities.category && (
                            <div className="browsy-understood-field">
                              <span className="browsy-understood-label">Category</span>
                              <span className="browsy-understood-value">
                                {msg.intentResult.intent.entities.category}
                              </span>
                            </div>
                          )}
                          {msg.intentResult.intent.entities.role && (
                            <div className="browsy-understood-field">
                              <span className="browsy-understood-label">Role</span>
                              <span className="browsy-understood-value">
                                {msg.intentResult.intent.entities.role}
                              </span>
                            </div>
                          )}
                          {msg.intentResult.intent.entities.type && (
                            <div className="browsy-understood-field">
                              <span className="browsy-understood-label">Type</span>
                              <span className="browsy-understood-value">
                                {msg.intentResult.intent.entities.type}
                              </span>
                            </div>
                          )}
                          {msg.intentResult.intent.filters.color && (
                            <div className="browsy-understood-field">
                              <span className="browsy-understood-label">Color</span>
                              <span className="browsy-understood-value">
                                {String(msg.intentResult.intent.filters.color)}
                              </span>
                            </div>
                          )}
                          {msg.intentResult.intent.filters.pattern && (
                            <div className="browsy-understood-field">
                              <span className="browsy-understood-label">Pattern</span>
                              <span className="browsy-understood-value">
                                {String(msg.intentResult.intent.filters.pattern)}
                              </span>
                            </div>
                          )}
                          {msg.intentResult.intent.filters.material && (
                            <div className="browsy-understood-field">
                              <span className="browsy-understood-label">Material</span>
                              <span className="browsy-understood-value">
                                {String(msg.intentResult.intent.filters.material)}
                              </span>
                            </div>
                          )}
                          {msg.intentResult.intent.filters.size && (
                            <div className="browsy-understood-field">
                              <span className="browsy-understood-label">Size</span>
                              <span className="browsy-understood-value">
                                {String(msg.intentResult.intent.filters.size)}
                              </span>
                            </div>
                          )}
                          {msg.intentResult.intent.constraints.maxPrice && (
                            <div className="browsy-understood-field">
                              <span className="browsy-understood-label">Budget</span>
                              <span className="browsy-understood-value">
                                ₹{msg.intentResult.intent.constraints.maxPrice.toLocaleString()} max
                              </span>
                            </div>
                          )}
                          {msg.intentResult.intent.constraints.location && (
                            <div className="browsy-understood-field">
                              <span className="browsy-understood-label">Location</span>
                              <span className="browsy-understood-value">
                                {msg.intentResult.intent.constraints.location}
                              </span>
                            </div>
                          )}
                          {msg.intentResult.intent.intent === "summarize" && (
                            <div className="browsy-understood-field">
                              <span className="browsy-understood-label">Goal</span>
                              <span className="browsy-understood-value">
                                Summarize Webpage
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  {/* 2. Matched Items on Host Webpage */}
                  {msg.intentResult &&
                    msg.intentResult.matchedItems.length > 0 &&
                    !hasVerifiedResult && (
                    <div className="browsy-matches-box">
                      <div className="browsy-matches-header">
                        Matching Items on this Page ({msg.intentResult.matchedItems.length})
                      </div>
                      {msg.intentResult.matchedItems.slice(0, 3).map((item) => (
                        <div
                          key={item.elementId}
                          className={`browsy-match-card ${item.matchClassification === "partial" ? "partial" : ""}`}
                        >
                          <div className="browsy-match-top">
                            <span className="browsy-match-title">{item.title}</span>
                            {item.price && (
                              <span className="browsy-match-price">{item.price.raw}</span>
                            )}
                          </div>
                          <div className="browsy-match-tags">
                            {item.matchClassification === "confirmed" && (
                              <span className="browsy-match-status-badge confirmed">✓ Confirmed</span>
                            )}
                            {item.matchClassification === "partial" && (
                              <span className="browsy-match-status-badge partial">⚠ Partial</span>
                            )}
                            {(item.verifiedConditions && item.verifiedConditions.length > 0 ? item.verifiedConditions : item.reasons).map((r, rIdx) => (
                              <span key={rIdx} className="browsy-match-tag">
                                {r}
                              </span>
                            ))}
                            {item.unverifiedConditions?.map((u, uIdx) => (
                              <span key={`u-${uIdx}`} className="browsy-match-tag unverified">
                                ⚠ {u} (unverified)
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 3. Stage 4 Supervised Action Execution & Plan View */}
                  {msg.intentResult && msg.intentResult.plan.steps.length > 0 && (() => {
                    const plan = msg.intentResult.plan;
                    const session =
                      activeExecutionSession?.planId === plan.id
                        ? activeExecutionSession
                        : msg.executionSession;

                    // A. High-Risk Confirmation View
                    if (session && session.state === "paused" && session.requiresHighRiskConfirmation) {
                      return (
                        <div className="browsy-highrisk-card">
                          <div className="browsy-highrisk-title">
                            ⚠️ High-Risk Action Confirmation
                          </div>
                          <div className="browsy-highrisk-text">
                            {session.highRiskReason ||
                              "This action performs a sensitive operation on the page. Please confirm you wish to proceed."}
                          </div>
                          <div className="browsy-highrisk-actions">
                            <button
                              type="button"
                              className="browsy-highrisk-confirm-btn"
                              onClick={() => onExecutePlan?.(msg.id, plan, true)}
                            >
                              Confirm & Run
                            </button>
                            <button
                              type="button"
                              className="browsy-highrisk-cancel-btn"
                              onClick={() => onStopExecution?.()}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // B. Live Execution Progress View
                    if (session && (session.state === "executing" || session.state === "verifying")) {
                      return (
                        <div className="browsy-exec-card">
                          <div className="browsy-exec-header">
                            <div className="browsy-exec-title">
                              <span className="browsy-pulse-dot" />
                              {session.state === "verifying"
                                ? "Verifying Product Details & Availability..."
                                : "Running Actions..."}
                            </div>
                            <span className="browsy-plan-badge running">
                              {session.state === "verifying"
                                ? "Verifying Match"
                                : `Step ${session.currentStepIndex + 1} of ${session.totalSteps}`}
                            </span>
                          </div>
                          <div className="browsy-exec-steps">
                            {session.records.map((rec, rIdx) => {
                              let iconClass = "pending";
                              let iconChar = "○";
                              if (rec.status === "completed") {
                                iconClass = "completed";
                                iconChar = "✓";
                              } else if (rec.status === "running") {
                                iconClass = "running";
                                iconChar = "●";
                              } else if (rec.status === "failed") {
                                iconClass = "failed";
                                iconChar = "✕";
                              }
                              return (
                                <div key={rec.actionId || rIdx} className="browsy-exec-step-row">
                                  <span className={`browsy-exec-icon ${iconClass}`}>{iconChar}</span>
                                  <span>{rec.description}</span>
                                </div>
                              );
                            })}
                          </div>
                          {session.verifiedProductResult && (
                            <div style={{ marginTop: "12px" }}>
                              <VerifiedProductCard
                                product={session.verifiedProductResult}
                                userQuery={msg.content}
                                onFocusProduct={onFocusProduct}
                                onOpenLink={(url) => {
                                  if (typeof window !== "undefined") {
                                    window.open(url, "_blank", "noopener,noreferrer");
                                  }
                                }}
                              />
                            </div>
                          )}
                          <button
                            type="button"
                            className="browsy-stop-btn"
                            onClick={() => onStopExecution?.()}
                          >
                            ⏹ Stop Execution
                          </button>
                        </div>
                      );
                    }

                    // C. Completed / Cancelled / Stale / Result View
                    if (session && session.state !== "proposed" && session.state !== "awaiting_approval") {
                      return (
                        <div className="browsy-plan-card">
                          <div className="browsy-plan-header">
                            <span className="browsy-plan-title">Action Execution</span>
                            <span className={`browsy-result-badge ${session.state}`}>
                              {session.state === "completed"
                                ? "✓ COMPLETED · DONE"
                                : session.state === "partial_success"
                                ? "⚠ PARTIALLY COMPLETED"
                                : session.state === "cancelled"
                                ? "⏹ CANCELLED"
                                : session.state === "stale"
                                ? "✕ FAILED · PAGE CHANGED"
                                : "✕ FAILED"}
                            </span>
                          </div>
                          <div className="browsy-plan-steps">
                            {session.records.map((rec, rIdx) => (
                              <div key={rIdx} className="browsy-plan-step">
                                <span
                                  style={{
                                    color:
                                      rec.status === "completed"
                                        ? "#16a34a"
                                        : rec.status === "skipped"
                                        ? "#ca8a04"
                                        : "#dc2626",
                                    fontWeight: 700,
                                  }}
                                >
                                  {rec.status === "completed"
                                    ? "✓"
                                    : rec.status === "skipped"
                                    ? "○"
                                    : "✕"}
                                </span>
                                <span>{rec.description}</span>
                                {rec.status === "skipped" && (
                                  <span style={{ fontSize: "11px", color: "#ca8a04", marginLeft: "6px" }}>
                                    (unverified)
                                  </span>
                                )}
                                {rec.status === "failed" && (
                                  <span style={{ fontSize: "11px", color: "#dc2626", marginLeft: "6px" }}>
                                    (failed)
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                          {/* Verified Product Result Card or Summary Notice */}
                          {session.verifiedProductResult ? (
                            <VerifiedProductCard
                              product={session.verifiedProductResult}
                              userQuery={msg.content}
                              onFocusProduct={onFocusProduct}
                              onOpenLink={(url) => {
                                if (typeof window !== "undefined") {
                                  window.open(url, "_blank", "noopener,noreferrer");
                                }
                              }}
                            />
                          ) : (
                            <div className="browsy-plan-notice">
                              {session.summaryMessage}
                            </div>
                          )}

                          {/* Additional Verified Alternatives if more than 1 confirmed match exists */}
                          {hasVerifiedResult && session.confirmedMatches && session.confirmedMatches.length > 1 && (
                            <div className="browsy-matches-box" style={{ marginTop: "12px" }}>
                              <div className="browsy-matches-header">
                                Other Verified Alternatives ({session.confirmedMatches.length - 1} more)
                              </div>
                              {session.confirmedMatches.slice(1, 4).map((item) => (
                                <div
                                  key={item.elementId}
                                  className="browsy-match-card confirmed"
                                  onClick={() => onFocusProduct?.(item)}
                                  style={{ cursor: "pointer" }}
                                  title="Click to focus on page"
                                >
                                  <div className="browsy-match-top">
                                    <span className="browsy-match-title">{item.title}</span>
                                    {item.price && <span className="browsy-match-price">{item.price.raw}</span>}
                                  </div>
                                  <div className="browsy-match-tags">
                                    <span className="browsy-match-status-badge confirmed">✓ Fully Verified</span>
                                    {(item.verifiedConditions && item.verifiedConditions.length > 0 ? item.verifiedConditions : item.reasons).map((r, rIdx) => (
                                      <span key={rIdx} className="browsy-match-tag">
                                        {r}
                                      </span>
                                    ))}
                                  </div>
                                  {item.link?.href && (
                                    <div style={{ marginTop: "6px" }}>
                                      <a
                                        href={item.link.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="browsy-product-direct-link"
                                        style={{ fontSize: "11px", padding: "3px 8px", display: "inline-block" }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (item.link?.href && typeof window !== "undefined") {
                                            e.preventDefault();
                                            window.open(item.link.href, "_blank", "noopener,noreferrer");
                                          }
                                        }}
                                      >
                                        View Alternative on Store ↗
                                      </a>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Post-Execution Verified & Partial Matching Products */}
                          {!hasVerifiedResult &&
                            ((session.confirmedMatches && session.confirmedMatches.length > 0) ||
                            (session.partialMatches && session.partialMatches.length > 0)) && (
                            <div className="browsy-matches-box" style={{ marginTop: "10px" }}>
                              <div className="browsy-matches-header">
                                {session.confirmedMatches && session.confirmedMatches.length > 0
                                  ? `Verified Matching Products (${session.confirmedMatches.length})`
                                  : `Partial Product Matches (${session.partialMatches?.length || 0})`}
                              </div>
                              {[...(session.confirmedMatches || []), ...(session.partialMatches || [])]
                                .slice(0, 3)
                                .map((item) => (
                                  <div
                                    key={item.elementId}
                                    className={`browsy-match-card ${item.matchClassification === "partial" ? "partial" : ""}`}
                                    onClick={() => onFocusProduct?.(item)}
                                    style={{ cursor: "pointer" }}
                                    title="Click to focus on page"
                                  >
                                    <div className="browsy-match-top">
                                      <span className="browsy-match-title">{item.title}</span>
                                      {item.price && (
                                        <span className="browsy-match-price">{item.price.raw}</span>
                                      )}
                                    </div>
                                    <div className="browsy-match-tags">
                                      {item.matchClassification === "confirmed" ? (
                                        <span className="browsy-match-status-badge confirmed">✓ Confirmed Match</span>
                                      ) : (
                                        <span className="browsy-match-status-badge partial">⚠ Partial Match</span>
                                      )}
                                      {(item.verifiedConditions && item.verifiedConditions.length > 0 ? item.verifiedConditions : item.reasons).map((r, rIdx) => (
                                        <span key={rIdx} className="browsy-match-tag">
                                          {r}
                                        </span>
                                      ))}
                                      {item.unverifiedConditions?.map((u, uIdx) => (
                                        <span key={`u-${uIdx}`} className="browsy-match-tag unverified">
                                          ⚠ {u} (unverified)
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}

                          {(session.state === "completed" || session.state === "partial_success") && (
                            <div className="browsy-plan-actions" style={{ marginTop: "12px" }}>
                              <button
                                type="button"
                                className="browsy-run-btn"
                                onClick={() => {
                                  const targetProd =
                                    session.verifiedProductResult ||
                                    session.confirmedMatches?.[0] ||
                                    session.partialMatches?.[0];
                                  if (targetProd && onFocusProduct) {
                                    onFocusProduct(targetProd);
                                  }
                                  onClose();
                                }}
                              >
                                ↗ View results
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    }

                    // D. Default: Proposed Action Plan with Prominent Approval Button & Visual Explainability
                    const isAutoEligible = isEligibleForAutoExecution(plan);
                    if (isAutoEligible && (!session || session.state === "approved" || session.state === "executing")) {
                      return (
                        <div className="browsy-exec-card">
                          <div className="browsy-exec-header">
                            <div className="browsy-exec-title">
                              <span className="browsy-pulse-dot" />
                              Preparing actions...
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const resolvedPreviews = plan.steps.map((step) => resolveStepPreviewTarget(step));
                    const hasAnyResolved = resolvedPreviews.some((p) => p.reason === "resolved");

                    return (
                      <div className="browsy-plan-card">
                        <div className="browsy-plan-header">
                          <span className="browsy-plan-title">Proposed actions</span>
                          <span className="browsy-plan-badge awaiting">Awaiting Approval</span>
                        </div>
                        {msg.intentResult.intent.rawQuery && (
                          <div className="browsy-plan-goal">
                            Goal: <strong>{msg.intentResult.intent.rawQuery}</strong>
                          </div>
                        )}
                        {hasAnyResolved && (
                          <div className="browsy-plan-preview-hint">
                            <span className="browsy-plan-preview-hint-sparkle">✦</span>
                            <span>Visual preview: Target controls highlighted on webpage above</span>
                          </div>
                        )}
                        <div className="browsy-plan-steps">
                          {plan.steps.map((step, sIdx) => {
                            const preview = resolvedPreviews[sIdx];
                            return (
                              <div key={step.id} className="browsy-plan-step">
                                <span className="browsy-plan-step-num">{sIdx + 1}.</span>
                                <div className="browsy-plan-step-desc">
                                  <div className="browsy-plan-step-header">
                                    <span>{step.description}</span>
                                    {preview?.reason === "resolved" ? (
                                      <span className="browsy-step-preview-tag resolved" title="Target control highlighted on webpage">
                                        🎯 Target on page
                                      </span>
                                    ) : preview?.reason === "pending_navigation" ? (
                                      <span className="browsy-step-preview-tag pending" title="Navigation required before interacting with target">
                                        ⏳ Pending navigation
                                      </span>
                                    ) : (
                                      <span className="browsy-step-preview-tag dynamic" title="Control will resolve dynamically during execution">
                                        🔍 Dynamic target
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="browsy-plan-notice">
                          Browsy will only execute these actions when you click "Run with Browsy".
                        </div>
                        <div className="browsy-plan-actions">
                          <button
                            type="button"
                            className="browsy-run-btn"
                            onClick={() => onExecutePlan?.(msg.id, plan, false)}
                          >
                            ⚡ Run with Browsy
                          </button>
                          <button
                            type="button"
                            className="browsy-edit-btn"
                            onClick={() => {
                              setInput(msg.intentResult?.intent.rawQuery || "");
                              textareaRef.current?.focus();
                            }}
                          >
                            Edit request
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 4. Clarification prompt suggestions */}
                  {msg.intentResult && msg.intentResult.requiresClarification && (
                    <div className="browsy-clarification-box">
                      <div className="browsy-plan-header" style={{ marginBottom: "6px" }}>
                        <span className="browsy-plan-title">Status</span>
                        <span className="browsy-result-badge needs_input">NEEDS USER INPUT</span>
                      </div>
                      <div className="browsy-clarification-options">
                        {["Under ₹1,000", "Size XL", "Red checked", "Bangalore"].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            className="browsy-clarification-pill"
                            onClick={() => {
                              setInput(opt);
                              textareaRef.current?.focus();
                            }}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="browsy-message-time">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            );
          })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Fixed Input Composer at Bottom */}
        <form className="browsy-footer" onSubmit={handleSubmit}>
          <div className="browsy-input-box">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Tell Browsy what you want..."
              className="browsy-textarea"
              aria-label="Ask Browsy"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="browsy-send-btn"
              aria-label="Send message"
              title="Send message (Enter)"
            >
              ↑
            </button>
          </div>
          <div className="browsy-footer-hint">
            <span>Press Enter to send · Shift + Enter for new line · Esc to close</span>
          </div>
        </form>
      </aside>
    </>
  );
};
