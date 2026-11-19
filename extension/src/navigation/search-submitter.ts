/**
 * Search Submission Engine for Browsy Stage 4.5
 * Reliably submits site search inputs across diverse websites using
 * form submit triggers, search buttons, or keyboard Enter events.
 */

/**
 * Triggers submission of a search input field using the most appropriate mechanism.
 */
export function submitSearchInput(inputEl: HTMLInputElement | HTMLTextAreaElement): boolean {
  if (!inputEl) return false;

  // 1. Mechanism A: Submit Button inside the same form or container
  const form = inputEl.form || inputEl.closest("form");
  if (form) {
    const submitBtn = form.querySelector('button[type="submit"], input[type="submit"], button');
    if (submitBtn instanceof HTMLElement && !submitBtn.hasAttribute("disabled")) {
      try {
        submitBtn.click();
        return true;
      } catch {
        // continue
      }
    }

    try {
      if (typeof form.requestSubmit === "function") {
        form.requestSubmit();
        return true;
      } else {
        form.submit();
        return true;
      }
    } catch {
      // continue
    }
  }

  // 2. Mechanism B: Sibling, Adjacent, or Container Search Button/Link
  const container = inputEl.parentElement || inputEl.closest("header, nav, [role='search'], div");
  if (container) {
    const adjacentBtn = container.querySelector(
      "button, a.desktop-submit, a[class*='submit'], a[class*='search'], .search-btn, .search-button, [role='button']"
    );
    if (adjacentBtn instanceof HTMLElement && adjacentBtn !== inputEl) {
      try {
        adjacentBtn.click();
        return true;
      } catch {
        // continue
      }
    }
  }

  // 3. Mechanism C: Standard Keyboard Enter Event
  try {
    const enterDown = new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    });
    inputEl.dispatchEvent(enterDown);

    const enterPress = new KeyboardEvent("keypress", {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    });
    inputEl.dispatchEvent(enterPress);

    const enterUp = new KeyboardEvent("keyup", {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    });
    inputEl.dispatchEvent(enterUp);
    return true;
  } catch {
    return false;
  }
}
