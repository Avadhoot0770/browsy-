import React, { useState, useEffect } from "react";
import type { StructuredPageIntelligence } from "../page-intelligence/types";
import { intentEngine } from "../intent/intent-engine";
import type { ProviderStatus } from "../intent/provider";

interface DeveloperInspectorProps {
  intelligence: StructuredPageIntelligence | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

type TabType = "overview" | "controls" | "repeated" | "json";

export const DeveloperInspector: React.FC<DeveloperInspectorProps> = ({
  intelligence,
  isOpen,
  onClose,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [aiStatus, setAiStatus] = useState<ProviderStatus | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("qwen2.5:1.5b");
  const [modelSwitchMsg, setModelSwitchMsg] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      intentEngine.getProviderStatus().then((status) => {
        setAiStatus(status);
        if (status.activeModel) setSelectedModel(status.activeModel);
      }).catch(() => {});
    }
  }, [isOpen]);

  const handleSelectModel = async (model: string) => {
    setModelSwitchMsg("Switching...");
    const ok = await intentEngine.selectModel(model);
    if (ok) {
      setModelSwitchMsg(`Switched to ${model}`);
      const updated = await intentEngine.getProviderStatus();
      setAiStatus(updated);
    } else {
      setModelSwitchMsg("Failed to switch model");
    }
    setTimeout(() => setModelSwitchMsg(""), 3000);
  };

  if (!isOpen) return null;

  return (
    <div
      className="browsy-inspector-overlay"
      role="dialog"
      aria-label="Browsy Page Intelligence Inspector"
    >
      {/* Top Header */}
      <div className="browsy-inspector-top">
        <h2>
          <span>✦ Browsy Inspector</span>
          <span className="browsy-inspector-badge">Dev Preview · Stage 2</span>
        </h2>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            className="browsy-inspect-btn"
            onClick={onRefresh}
            title="Re-run Page Intelligence analysis"
          >
            ↻ Refresh
          </button>
          <button
            type="button"
            className="browsy-inspector-close-btn"
            onClick={onClose}
            aria-label="Close Inspector"
            title="Close (Ctrl+Shift+B)"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="browsy-inspector-nav">
        <button
          type="button"
          className={`browsy-inspector-tab-btn ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className={`browsy-inspector-tab-btn ${activeTab === "controls" ? "active" : ""}`}
          onClick={() => setActiveTab("controls")}
        >
          Controls ({intelligence?.stats.totalInteractiveCount || 0})
        </button>
        <button
          type="button"
          className={`browsy-inspector-tab-btn ${activeTab === "repeated" ? "active" : ""}`}
          onClick={() => setActiveTab("repeated")}
        >
          Cards ({intelligence?.stats.repeatedItemCount || 0})
        </button>
        <button
          type="button"
          className={`browsy-inspector-tab-btn ${activeTab === "json" ? "active" : ""}`}
          onClick={() => setActiveTab("json")}
        >
          Structured JSON
        </button>
      </div>

      {/* Body Content */}
      <div className="browsy-inspector-content">
        {!intelligence ? (
          <div className="browsy-inspector-card">
            <p>Analyzing page intelligence...</p>
          </div>
        ) : activeTab === "overview" ? (
          <>
            <div className="browsy-inspector-card">
              <h4>Page Meta</h4>
              <div style={{ wordBreak: "break-all" }}>
                <strong>Title:</strong> {intelligence.title}
              </div>
              <div style={{ wordBreak: "break-all" }}>
                <strong>Domain:</strong> {intelligence.hostname}
              </div>
              <div style={{ wordBreak: "break-all", fontSize: "11px", color: "#6e6861" }}>
                <strong>URL:</strong> {intelligence.url}
              </div>
            </div>

            {/* Local AI Provider (Ollama) */}
            <div className="browsy-inspector-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4>Local AI Provider (Ollama)</h4>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "9999px",
                    background: aiStatus?.available ? "#f0fdf4" : "#fffbeb",
                    color: aiStatus?.available ? "#15803d" : "#b45309",
                    border: `1px solid ${aiStatus?.available ? "#bbf7d0" : "#fef3c7"}`,
                  }}
                >
                  {aiStatus?.available ? "● Ollama Active" : "○ Deterministic Mode"}
                </span>
              </div>
              <div style={{ fontSize: "12px", color: "#444", display: "flex", flexDirection: "column", gap: "6px" }}>
                <div>
                  <strong>Endpoint:</strong>{" "}
                  <code style={{ fontSize: "11px", background: "#f0ede8", padding: "1px 4px", borderRadius: "3px" }}>
                    {aiStatus?.endpoint || "http://127.0.0.1:8765"}
                  </code>
                </div>
                <div>
                  <strong>Active Model:</strong>{" "}
                  <span style={{ fontWeight: 600, color: "#170404" }}>
                    {aiStatus?.activeModel || "qwen2.5:1.5b"}
                  </span>
                </div>
                {aiStatus?.recommendedModel && (
                  <div style={{ fontSize: "11px", color: "#6b7280" }}>
                    <strong>Recommended:</strong> {aiStatus.recommendedModel}
                  </div>
                )}
                <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "4px" }}>
                  <label htmlFor="model-select" style={{ fontSize: "11px", fontWeight: 600 }}>Model:</label>
                  <select
                    id="model-select"
                    value={selectedModel}
                    onChange={(e) => {
                      setSelectedModel(e.target.value);
                      handleSelectModel(e.target.value);
                    }}
                    style={{
                      fontSize: "11px",
                      padding: "3px 6px",
                      borderRadius: "4px",
                      border: "1px solid #d1d5db",
                      background: "#fff",
                      flex: 1,
                    }}
                  >
                    {(aiStatus?.availableModels && aiStatus.availableModels.length > 0
                      ? aiStatus.availableModels
                      : ["qwen2.5:1.5b", "qwen2.5:3b", "llama3.2:1b", "llama3.2:3b"]
                    ).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                {modelSwitchMsg && (
                  <div style={{ fontSize: "11px", color: "#059669", fontStyle: "italic" }}>
                    {modelSwitchMsg}
                  </div>
                )}
                {!aiStatus?.available && (
                  <div
                    style={{
                      marginTop: "6px",
                      padding: "8px",
                      background: "#fef3c7",
                      borderRadius: "4px",
                      fontSize: "11px",
                      color: "#92400e",
                      lineHeight: "1.4",
                    }}
                  >
                    <strong>Setup Instructions:</strong>
                    <br />
                    1. Install Ollama from <a href="https://ollama.com" target="_blank" rel="noreferrer" style={{ color: "#b45309" }}>ollama.com</a>
                    <br />
                    2. Run: <code>ollama pull qwen2.5:1.5b</code>
                    <br />
                    3. Run: <code>ollama serve</code>
                    <br />
                    4. Start companion: <code>npm run companion</code>
                  </div>
                )}
              </div>
            </div>

            <div className="browsy-inspector-grid">
              <div className="browsy-inspector-stat-box">
                <div className="browsy-inspector-stat-val">
                  {intelligence.stats.analysisDurationMs}ms
                </div>
                <div className="browsy-inspector-stat-lbl">Analysis Time</div>
              </div>
              <div className="browsy-inspector-stat-box">
                <div className="browsy-inspector-stat-val">
                  {intelligence.stats.searchCount}
                </div>
                <div className="browsy-inspector-stat-lbl">Search Fields</div>
              </div>
              <div className="browsy-inspector-stat-box">
                <div className="browsy-inspector-stat-val">
                  {intelligence.stats.buttonCount}
                </div>
                <div className="browsy-inspector-stat-lbl">Buttons</div>
              </div>
              <div className="browsy-inspector-stat-box">
                <div className="browsy-inspector-stat-val">
                  {intelligence.stats.repeatedItemCount}
                </div>
                <div className="browsy-inspector-stat-lbl">Repeated Items</div>
              </div>
              <div className="browsy-inspector-stat-box">
                <div className="browsy-inspector-stat-val">
                  {intelligence.stats.priceCount}
                </div>
                <div className="browsy-inspector-stat-lbl">Prices Found</div>
              </div>
              <div className="browsy-inspector-stat-box">
                <div className="browsy-inspector-stat-val">
                  {intelligence.stats.ratingCount}
                </div>
                <div className="browsy-inspector-stat-lbl">Ratings Found</div>
              </div>
            </div>

            <div className="browsy-inspector-card">
              <h4>Extracted Headings ({intelligence.headings.length})</h4>
              {intelligence.headings.length === 0 ? (
                <div style={{ color: "#8c827a" }}>No explicit headings detected</div>
              ) : (
                intelligence.headings.slice(0, 8).map((h, idx) => (
                  <div key={idx} className="browsy-inspector-list-item">
                    <span className="browsy-inspector-tag">H{h.level}</span> {h.text}
                  </div>
                ))
              )}
            </div>

            <div className="browsy-inspector-card">
              <h4>Summary</h4>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  fontFamily: "monospace",
                  fontSize: "10px",
                  lineHeight: "1.4",
                  background: "#f7f5f2",
                  padding: "8px",
                  borderRadius: "4px",
                }}
              >
                {intelligence.summary}
              </pre>
            </div>
          </>
        ) : activeTab === "controls" ? (
          <>
            {intelligence.searchInputs.length > 0 && (
              <div className="browsy-inspector-card">
                <h4>Search Fields ({intelligence.searchInputs.length})</h4>
                {intelligence.searchInputs.map((s) => (
                  <div key={s.elementId} className="browsy-inspector-list-item">
                    <div className="browsy-inspector-item-row">
                      <span className="browsy-inspector-id">{s.elementId}</span>
                      <span className="browsy-inspector-tag">{s.role}</span>
                    </div>
                    <div>
                      {s.placeholder ? `Placeholder: "${s.placeholder}"` : s.ariaLabel ? `Aria: "${s.ariaLabel}"` : `Type: ${s.type}`}
                    </div>
                    <div style={{ fontSize: "10px", color: "#8c827a" }}>
                      Bounds: {s.bounds.x},{s.bounds.y} ({s.bounds.width}×{s.bounds.height})
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="browsy-inspector-card">
              <h4>Buttons ({intelligence.buttons.length})</h4>
              {intelligence.buttons.slice(0, 15).map((btn) => (
                <div key={btn.elementId} className="browsy-inspector-list-item">
                  <div className="browsy-inspector-item-row">
                    <span className="browsy-inspector-id">{btn.elementId}</span>
                    <span className="browsy-inspector-tag">{btn.tagName}</span>
                  </div>
                  <div>
                    <strong>{btn.text || btn.ariaLabel || "Unnamed Button"}</strong>
                  </div>
                  <div style={{ fontSize: "10px", color: "#8c827a" }}>
                    Bounds: {btn.bounds.x},{btn.bounds.y} ({btn.bounds.width}×{btn.bounds.height})
                  </div>
                </div>
              ))}
            </div>

            {intelligence.forms.length > 0 && (
              <div className="browsy-inspector-card">
                <h4>Forms ({intelligence.forms.length})</h4>
                {intelligence.forms.map((f) => (
                  <div key={f.elementId} className="browsy-inspector-list-item">
                    <div className="browsy-inspector-item-row">
                      <span className="browsy-inspector-id">{f.elementId}</span>
                      <span className="browsy-inspector-tag">{f.method}</span>
                    </div>
                    <div>
                      Inputs: {f.inputCount} · Buttons: {f.buttonCount} · Search: {f.hasSearchRole ? "Yes" : "No"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : activeTab === "repeated" ? (
          <>
            {intelligence.repeatedGroups.length === 0 ? (
              <div className="browsy-inspector-card">
                <p style={{ color: "#8c827a" }}>No repeated item clusters detected on this page.</p>
              </div>
            ) : (
              intelligence.repeatedGroups.map((group, gIdx) => (
                <div key={gIdx} className="browsy-inspector-card">
                  <div className="browsy-inspector-item-row">
                    <h4>Group {gIdx + 1}: {group.inferredType}</h4>
                    <span className="browsy-inspector-badge">{group.count} items</span>
                  </div>
                  <div style={{ fontSize: "10px", color: "#8c827a" }}>
                    Selector: {group.containerSelector}
                  </div>
                  {group.items.slice(0, 10).map((item) => (
                    <div key={item.elementId} className="browsy-inspector-list-item">
                      <div className="browsy-inspector-item-row">
                        <span className="browsy-inspector-id">{item.elementId}</span>
                        {item.price && (
                          <span className="browsy-inspector-tag" style={{ background: "#dcfce7", color: "#166534" }}>
                            {item.price.raw}
                          </span>
                        )}
                        {item.rating && (
                          <span className="browsy-inspector-tag" style={{ background: "#fef9c3", color: "#854d0e" }}>
                            {item.rating.raw}
                          </span>
                        )}
                      </div>
                      <div style={{ fontWeight: 600 }}>{item.title}</div>
                      {item.link && (
                        <div style={{ fontSize: "10px", color: "#6e6861", wordBreak: "break-all" }}>
                          Link: {item.link.href}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </>
        ) : (
          <div className="browsy-inspector-card">
            <h4>Stage 3 Ready Payload (JSON)</h4>
            <pre
              style={{
                fontFamily: "monospace",
                fontSize: "10px",
                whiteSpace: "pre-wrap",
                maxHeight: "450px",
                overflowY: "auto",
                background: "#f6f3ee",
                padding: "8px",
                borderRadius: "4px",
              }}
            >
              {JSON.stringify(intelligence, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="browsy-inspector-footer">
        <span className="browsy-inspector-footer-hint">Shortcut: Ctrl + Shift + B to toggle</span>
        <button
          type="button"
          className="browsy-inspect-btn"
          onClick={onClose}
        >
          Close Inspector
        </button>
      </div>
    </div>
  );
};
