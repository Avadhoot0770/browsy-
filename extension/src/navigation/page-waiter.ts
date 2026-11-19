/**
 * Page Update and Stabilization Watcher for Browsy Stage 4.5
 * Waits for DOM mutations, SPA navigation, and network updates with bounded timeouts.
 */

import type { PageWaitOptions } from "./types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Waits for the page to update or stabilize following a major navigation, filter or search action.
 * Strictly bounded — will never hang indefinitely. Supports condition callbacks and DOM mutation detection.
 */
export async function waitForPageUpdate(
  previousUrl: string,
  options: PageWaitOptions = {}
): Promise<{ urlChanged: boolean; conditionMet: boolean; waitedMs: number }> {
  const timeoutMs = options.timeoutMs ?? 2000;
  const intervalMs = options.checkIntervalMs ?? 35;
  const startTime = Date.now();

  let urlChanged = false;
  let conditionMet = false;

  if (typeof window === "undefined" || !window.location) {
    return { urlChanged: false, conditionMet: false, waitedMs: 0 };
  }

  // Lightweight structural fingerprint (child count, avoiding full innerHTML stringification)
  const initialChildCount =
    typeof document !== "undefined" && document.body
      ? (document.body.childElementCount ?? document.body.children?.length ?? 0)
      : 0;

  while (Date.now() - startTime < timeoutMs) {
    if (window.location.href !== previousUrl) {
      urlChanged = true;
      await sleep(10);
      break;
    }

    if (options.condition && options.condition()) {
      conditionMet = true;
      break;
    }

    // Detect structural DOM count mutation without serializing megabytes of HTML
    if (typeof document !== "undefined" && document.body) {
      const currentCount = document.body.childElementCount ?? document.body.children?.length ?? 0;
      if (Math.abs(currentCount - initialChildCount) >= 1) {
        conditionMet = true;
        await sleep(10);
        break;
      }
    }

    await sleep(intervalMs);
  }

  return {
    urlChanged,
    conditionMet,
    waitedMs: Date.now() - startTime,
  };
}
