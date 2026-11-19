/**
 * Browsy Extension Background Service Worker (Manifest V3)
 * Acts as the coordination and messaging hub.
 */

import {
  MessageActions,
  type ExtensionMessage,
  type PongMessage,
} from "../shared/messages";
import { EXTENSION_NAME, EXTENSION_VERSION } from "../shared/constants";

// Lifecycle: Installation & Updates
chrome.runtime.onInstalled.addListener((details) => {
  console.info(
    `[${EXTENSION_NAME}] Background Service Worker installed:`,
    details.reason,
    `v${EXTENSION_VERSION}`
  );
});

const COMPANION_URL = "http://127.0.0.1:8765";

// Typed Message Handler
chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => {
    const originTabId = sender.tab?.id;
    console.debug(`[${EXTENSION_NAME}] Message received:`, message.action, "from tab:", originTabId);

    switch (message.action) {
      case MessageActions.PING: {
        const pong: PongMessage = {
          action: MessageActions.PONG,
          version: EXTENSION_VERSION,
          timestamp: Date.now(),
        };
        sendResponse(pong);
        return false;
      }

      case MessageActions.USER_REQUEST: {
        console.info(
          `[${EXTENSION_NAME}] User Request on ${message.context?.hostname}:`,
          message.prompt
        );
        sendResponse({
          received: true,
          status: "stage2_acknowledged",
          hostname: message.context?.hostname,
          hasIntelligence: Boolean(message.context?.intelligence),
        });
        return false;
      }

      case MessageActions.AI_STATUS: {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 1800);
        fetch(`${COMPANION_URL}/api/status`, {
          method: "GET",
          headers: { "X-Browsy-Client": "extension" },
          signal: controller.signal,
        })
          .then((res) => res.json())
          .then((data) => {
            clearTimeout(timer);
            sendResponse(data);
          })
          .catch(() => {
            clearTimeout(timer);
            sendResponse({
              status: "unavailable",
              ollamaRunning: false,
              activeModel: "qwen2.5:1.5b",
              availableModels: [],
              message: "Local companion service not running on loopback (http://127.0.0.1:8765).",
            });
          });
        return true; // Asynchronous response
      }

      case MessageActions.AI_SELECT_MODEL: {
        fetch(`${COMPANION_URL}/api/models/select`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Browsy-Client": "extension" },
          body: JSON.stringify({ model: message.model }),
        })
          .then((res) => res.json())
          .then((data) => sendResponse(data))
          .catch((err) => sendResponse({ error: String(err) }));
        return true;
      }

      case MessageActions.AI_QUERY: {
        const controller = new AbortController();
        const timeoutMs = message.timeoutMs || 8000;
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        fetch(`${COMPANION_URL}${message.endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Browsy-Client": "extension",
            ...(message.simulate ? { "X-Browsy-Simulate": message.simulate } : {}),
          },
          body: JSON.stringify(message.payload || {}),
          signal: controller.signal,
        })
          .then(async (res) => {
            clearTimeout(timer);
            if (!res.ok) {
              const text = await res.text();
              sendResponse({ error: `Companion HTTP ${res.status}: ${text}`, status: res.status });
              return;
            }
            const data = await res.json();
            sendResponse(data);
          })
          .catch((err) => {
            clearTimeout(timer);
            sendResponse({
              error: err instanceof Error ? err.message : String(err),
              isTimeout: err?.name === "AbortError",
            });
          });
        return true;
      }

      default:
        return false;
    }
  }
);
