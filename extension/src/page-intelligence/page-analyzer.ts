/**
 * Central Page Analyzer for Browsy Page Intelligence
 * Orchestrates DOM inspection, semantic extraction, and structured context assembly.
 */

import type {
  StructuredPageIntelligence,
  PageIntelligenceStats,
  PriceInfo,
  RatingInfo,
} from "./types";
import { elementRegistry } from "./element-registry";
import { detectInteractiveElements, detectPaginationAndTables } from "./interactive-detector";
import { detectRepeatedContent } from "./repeated-content-detector";
import { extractHeadings, extractKeyImages } from "./content-extractor";
import { generatePageSummary } from "./page-summary";

export class PageAnalyzer {
  private cachedIntel: StructuredPageIntelligence | null = null;
  private cacheTimestamp = 0;
  private cachedUrl = "";
  private readonly CACHE_TTL_MS = 1200; // 1.2s short-lived cache

  /**
   * Explicitly clears the short-lived analysis cache (e.g. after user actions or navigation).
   */
  public invalidateCache(): void {
    this.cachedIntel = null;
    this.cacheTimestamp = 0;
    this.cachedUrl = "";
  }

  /**
   * Executes a full, controlled analysis pass of the current visible webpage.
   * If force is false and cache is fresh, returns short-lived cached result to avoid main-thread freeze.
   */
  public analyzeCurrentPage(force = false): StructuredPageIntelligence {
    const currentUrl = typeof window !== "undefined" && window.location ? window.location.href : "";
    const now = Date.now();

    if (
      !force &&
      this.cachedIntel &&
      this.cachedUrl === currentUrl &&
      now - this.cacheTimestamp < this.CACHE_TTL_MS
    ) {
      return this.cachedIntel;
    }

    const startTime = performance.now();
    console.debug("[BROWSY PAGE] Analysis started");

    // Clean up any previously registered elements that are no longer connected
    elementRegistry.invalidateStale();

    // 1. Extract Headings and Images
    const headings = extractHeadings();
    const keyImages = extractKeyImages();

    // 2. Detect Interactive Elements (Search, Buttons, Inputs, Links, Forms)
    const { searchInputs, buttons, links, inputs, forms } = detectInteractiveElements();
    const { pagination, tables } = detectPaginationAndTables();

    // 3. Detect Repeated Content Collections
    const repeatedGroups = detectRepeatedContent();

    // 4. Aggregate Detected Prices and Ratings from repeated groups
    const detectedPrices: PriceInfo[] = [];
    const detectedRatings: RatingInfo[] = [];

    for (const group of repeatedGroups) {
      for (const item of group.items) {
        if (item.price && !detectedPrices.some((p) => p.raw === item.price?.raw)) {
          detectedPrices.push(item.price);
        }
        if (item.rating && !detectedRatings.some((r) => r.raw === item.rating?.raw)) {
          detectedRatings.push(item.rating);
        }
      }
    }

    const durationMs = Math.round(performance.now() - startTime);

    const stats: PageIntelligenceStats = {
      analysisDurationMs: durationMs,
      totalInteractiveCount:
        searchInputs.length + buttons.length + links.length + inputs.length + forms.length,
      buttonCount: buttons.length,
      linkCount: links.length,
      inputCount: inputs.length,
      searchCount: searchInputs.length,
      formCount: forms.length,
      repeatedItemCount: repeatedGroups.reduce((acc, g) => acc + g.count, 0),
      repeatedGroupCount: repeatedGroups.length,
      headingCount: headings.length,
      imageCount: keyImages.length,
      priceCount: detectedPrices.length,
      ratingCount: detectedRatings.length,
      timestamp: Date.now(),
    };

    const summary = generatePageSummary({
      hostname: window.location.hostname,
      title: document.title,
      headings,
      searchInputs,
      buttons,
      inputs,
      links,
      forms,
      repeatedGroups,
      prices: detectedPrices,
      ratings: detectedRatings,
    });

    console.debug(
      `[BROWSY PAGE] Analysis completed in ${durationMs}ms:`,
      `${stats.totalInteractiveCount} interactive controls,`,
      `${stats.repeatedItemCount} repeated items,`,
      `${stats.searchCount} search fields`
    );

    const result: StructuredPageIntelligence = {
      url: window.location.href,
      hostname: window.location.hostname,
      pathname: window.location.pathname,
      title: document.title || window.location.hostname,
      summary,
      headings,
      searchInputs,
      buttons,
      inputs,
      links,
      forms,
      repeatedGroups,
      detectedPrices,
      detectedRatings,
      keyImages,
      pagination,
      tables,
      stats,
      timestamp: Date.now(),
    };

    this.cachedIntel = result;
    this.cacheTimestamp = Date.now();
    this.cachedUrl = currentUrl;

    return result;
  }
}

export const pageAnalyzer = new PageAnalyzer();
