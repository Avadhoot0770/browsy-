/**
 * Dynamic Page and SPA Navigation Observer for Browsy Page Intelligence
 * Listens for client-side routing and meaningful DOM alterations with debouncing.
 */

import { isBrowsyOwned } from "./visibility";

export type PageChangeCallback = (reason: "mutation" | "navigation" | "title") => void;

export class PageObserver {
  private observer: MutationObserver | null = null;
  private titleObserver: MutationObserver | null = null;
  private debounceTimer: number | null = null;
  private readonly debounceMs: number;
  private listeners = new Set<PageChangeCallback>();
  private originalPushState: typeof history.pushState | null = null;
  private originalReplaceState: typeof history.replaceState | null = null;
  private isObserving = false;
  private lastUrl = "";

  constructor(debounceMs = 600) {
    this.debounceMs = debounceMs;
  }

  /**
   * Registers a subscriber callback for page change notifications.
   */
  public subscribe(cb: PageChangeCallback): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(reason: "mutation" | "navigation" | "title"): void {
    for (const listener of this.listeners) {
      try {
        listener(reason);
      } catch (err) {
        console.error("[Browsy PageObserver] Listener error:", err);
      }
    }
  }

  private scheduleUpdate(reason: "mutation" | "navigation" | "title"): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      this.notify(reason);
    }, this.debounceMs);
  }

  /**
   * Starts monitoring DOM mutations and SPA navigations.
   */
  public start(): void {
    if (this.isObserving) return;
    this.isObserving = true;
    this.lastUrl = window.location.href;

    // 1. Observe Body Mutations with filtering of Browsy internal nodes
    if (document.body) {
      this.observer = new MutationObserver((mutations) => {
        let hasHostChange = false;
        for (const m of mutations) {
          if (m.target instanceof Element && isBrowsyOwned(m.target)) {
            continue;
          }
          hasHostChange = true;
          break;
        }

        if (hasHostChange) {
          this.scheduleUpdate("mutation");
        }
      });

      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: false,
      });
    }

    // 2. Observe Document Title mutations
    const titleEl = document.querySelector("title");
    if (titleEl) {
      this.titleObserver = new MutationObserver(() => {
        this.scheduleUpdate("title");
      });
      this.titleObserver.observe(titleEl, { childList: true, characterData: true });
    }

    // 3. Listen to browser history popstate
    window.addEventListener("popstate", this.handleNavigation);

    // 4. Intercept history pushState & replaceState for SPA route transitions
    this.hookHistory();
  }

  private handleNavigation = (): void => {
    if (window.location.href !== this.lastUrl) {
      this.lastUrl = window.location.href;
      this.scheduleUpdate("navigation");
    }
  };

  private hookHistory(): void {
    try {
      this.originalPushState = history.pushState.bind(history);
      this.originalReplaceState = history.replaceState.bind(history);

      const notifyNav = () => {
        if (window.location.href !== this.lastUrl) {
          this.lastUrl = window.location.href;
          this.scheduleUpdate("navigation");
        }
      };

      history.pushState = (...args) => {
        this.originalPushState?.(...args);
        notifyNav();
      };

      history.replaceState = (...args) => {
        this.originalReplaceState?.(...args);
        notifyNav();
      };
    } catch {
      // In restricted or iframe sandboxes
    }
  }

  /**
   * Stops all active observers and unhooks listeners.
   */
  public stop(): void {
    this.isObserving = false;
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.observer?.disconnect();
    this.titleObserver?.disconnect();
    window.removeEventListener("popstate", this.handleNavigation);

    if (this.originalPushState) {
      history.pushState = this.originalPushState;
    }
    if (this.originalReplaceState) {
      history.replaceState = this.originalReplaceState;
    }
  }
}

export const pageObserver = new PageObserver();
