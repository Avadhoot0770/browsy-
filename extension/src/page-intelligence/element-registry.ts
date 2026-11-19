/**
 * In-Memory Element Reference Registry for Browsy Page Intelligence
 * Provides stable runtime identifiers (e.g. browsy-el-001) mapped to live DOM nodes.
 * Designed for future Stage 4 automation while guaranteeing staleness checks and safe invalidation.
 */

class ElementRegistry {
  private idToElement = new Map<string, Element>();
  private elementToId = new WeakMap<Element, string>();
  private counter = 0;

  /**
   * Registers a DOM element and returns a stable runtime reference ID.
   * Reuses the existing ID if the element was already registered in this session.
   */
  public register(element: Element): string {
    const existing = this.elementToId.get(element);
    if (existing && this.idToElement.has(existing)) {
      return existing;
    }

    this.counter += 1;
    const pad = String(this.counter).padStart(3, "0");
    const id = `browsy-el-${pad}`;

    this.idToElement.set(id, element);
    this.elementToId.set(element, id);

    // Also mark element with a non-destructive data attribute for developer inspection
    try {
      element.setAttribute("data-browsy-id", id);
    } catch {
      // Ignore if element does not support attributes
    }

    return id;
  }

  /**
   * Retrieves a live DOM element by its reference ID.
   * Returns null if the element does not exist or has disconnected from the document.
   */
  public get(id: string): Element | null {
    const element = this.idToElement.get(id);
    if (!element) {
      return null;
    }

    // Security & Staleness: Check if element is still connected to the DOM
    if (!element.isConnected) {
      this.idToElement.delete(id);
      return null;
    }

    return element;
  }

  /**
   * Returns true if the element with the given ID is either missing or disconnected from the DOM.
   */
  public isStale(id: string): boolean {
    const element = this.idToElement.get(id);
    if (!element) return true;
    return !element.isConnected;
  }

  /**
   * Cleans up disconnected elements from the registry. Returns number of purged elements.
   */
  public invalidateStale(): number {
    let purged = 0;
    for (const [id, element] of this.idToElement.entries()) {
      if (!element.isConnected) {
        this.idToElement.delete(id);
        purged += 1;
      }
    }
    return purged;
  }

  /**
   * Resets the registry (e.g. on full SPA page navigation).
   */
  public clear(): void {
    this.idToElement.clear();
    this.counter = 0;
  }

  /**
   * Current number of tracked element references.
   */
  public size(): number {
    return this.idToElement.size;
  }
}

export const elementRegistry = new ElementRegistry();
