import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { EXTENSION_NAME, EXTENSION_TAGLINE, EXTENSION_VERSION } from "../shared/constants";
import { MessageActions } from "../shared/messages";

const PopupApp: React.FC = () => {
  const [triggered, setTriggered] = useState(false);

  const handleOpenAssistant = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { action: MessageActions.OPEN_ASSISTANT });
        setTriggered(true);
        setTimeout(() => window.close(), 400);
      }
    } catch {
      // In case content script isn't active on restricted tab
      setTriggered(true);
    }
  };

  return (
    <div className="popup-container">
      <div className="popup-header">
        <div className="popup-icon" aria-hidden="true">✦</div>
        <div className="popup-title">
          <h1>{EXTENSION_NAME}</h1>
          <p>{EXTENSION_TAGLINE}</p>
        </div>
      </div>

      <div className="popup-card">
        <span className="popup-card-label">Extension Status</span>
        <div className="popup-card-status">
          <span className="popup-status-dot" />
          <span>Active on normal webpages</span>
        </div>
        <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#6e6861" }}>
          Look for the floating <strong>✦ Browsy</strong> button on the right edge of any website.
        </p>
      </div>

      <button type="button" className="popup-btn" onClick={handleOpenAssistant}>
        {triggered ? "Opening Browsy…" : "✦ Open Browsy on this tab"}
      </button>

      <div className="popup-footer">
        v{EXTENSION_VERSION} · Manifest V3 Shell
      </div>
    </div>
  );
};

const rootEl = document.getElementById("popup-root");
if (rootEl) {
  createRoot(rootEl).render(<PopupApp />);
}
