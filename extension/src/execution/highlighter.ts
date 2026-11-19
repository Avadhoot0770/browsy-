/**
 * Visual Element Highlighter for Browsy Stage 4 Execution Engine
 * Provides temporary, non-destructive visual focus and progress badges on the host webpage
 * during supervised execution, and cleans up all temporary styles immediately afterwards.
 */

let activeHighlightEl: HTMLElement | null = null;
let originalOutline = "";
let originalBoxShadow = "";
let originalTransition = "";
let activeBadgeEl: HTMLElement | null = null;

/**
 * Temporarily highlights a target DOM element and attaches a small Browsy badge.
 */
export function highlightTargetElement(
  target: Element,
  message: string,
  isCompleted = false
): void {
  // Clean up any existing highlight first
  clearHighlight();

  if (!(target instanceof HTMLElement)) {
    return;
  }

  activeHighlightEl = target;
  originalOutline = target.style.outline;
  originalBoxShadow = target.style.boxShadow;
  originalTransition = target.style.transition;

  // Apply subtle non-invasive focus ring
  target.style.transition = "outline 0.15s ease, box-shadow 0.15s ease";
  if (isCompleted) {
    target.style.outline = "2px solid #10b981";
    target.style.outlineOffset = "2px";
    target.style.boxShadow = "0 0 0 4px rgba(16, 185, 129, 0.25)";
  } else {
    target.style.outline = "2px solid #4f46e5";
    target.style.outlineOffset = "2px";
    target.style.boxShadow = "0 0 0 4px rgba(79, 70, 229, 0.25)";
  }

  // Create floating pill indicator
  try {
    const rect = target.getBoundingClientRect();
    const badge = document.createElement("div");
    badge.id = "browsy-active-highlight-badge";
    badge.setAttribute("data-browsy-root", "true");

    badge.style.position = "fixed";
    badge.style.top = `${Math.max(10, rect.top - 28)}px`;
    badge.style.left = `${Math.max(10, rect.left)}px`;
    badge.style.zIndex = "2147483646";
    badge.style.background = isCompleted ? "#065f46" : "#312e81";
    badge.style.color = "#ffffff";
    badge.style.fontFamily = "system-ui, -apple-system, sans-serif";
    badge.style.fontSize = "11px";
    badge.style.fontWeight = "600";
    badge.style.padding = "3px 8px";
    badge.style.borderRadius = "12px";
    badge.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.2)";
    badge.style.pointerEvents = "none";
    badge.style.transition = "all 0.2s ease";
    badge.textContent = `${isCompleted ? "✓" : "✦ Browsy:"} ${message}`;

    document.body.appendChild(badge);
    activeBadgeEl = badge;
  } catch {
    // Non-DOM environments
  }
}

/**
 * Removes all active highlights and badges, restoring original element styles.
 */
export function clearHighlight(): void {
  if (activeHighlightEl) {
    activeHighlightEl.style.outline = originalOutline;
    activeHighlightEl.style.boxShadow = originalBoxShadow;
    activeHighlightEl.style.transition = originalTransition;
    activeHighlightEl = null;
  }

  if (activeBadgeEl) {
    try {
      activeBadgeEl.remove();
    } catch {
      // ignore
    }
    activeBadgeEl = null;
  }
}
