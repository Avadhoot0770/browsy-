/**
 * Semantic Content & Heading Extractor for Browsy Page Intelligence
 * Gathers clean document headings, key images, and textual summaries.
 */

import type { PageHeading, PageImage } from "./types";
import { isBrowsyOwned, isElementVisible } from "./visibility";
import { sanitizeText } from "./privacy";

const MAX_HEADINGS = 25;
const MAX_IMAGES = 15;

/**
 * Extracts visible document headings (H1-H4).
 */
export function extractHeadings(): PageHeading[] {
  const headings: PageHeading[] = [];
  const headingElements = document.querySelectorAll("h1, h2, h3, h4, [role='heading']");

  for (const el of headingElements) {
    if (headings.length >= MAX_HEADINGS) break;
    if (isBrowsyOwned(el) || !isElementVisible(el)) continue;

    const rawText = el.textContent || "";
    const cleaned = sanitizeText(rawText, 80);
    if (!cleaned) continue;

    let level = 2;
    if (el.tagName.startsWith("H")) {
      const parsedLevel = parseInt(el.tagName.charAt(1), 10);
      if (!isNaN(parsedLevel)) level = parsedLevel;
    } else {
      const ariaLevel = el.getAttribute("aria-level");
      if (ariaLevel) {
        const parsed = parseInt(ariaLevel, 10);
        if (!isNaN(parsed)) level = parsed;
      }
    }

    headings.push({
      level,
      text: cleaned,
    });
  }

  return headings;
}

/**
 * Extracts visible key images with alt descriptions.
 */
export function extractKeyImages(): PageImage[] {
  const images: PageImage[] = [];
  const imgElements = document.querySelectorAll("img");

  for (const img of imgElements) {
    if (images.length >= MAX_IMAGES) break;
    if (isBrowsyOwned(img) || !isElementVisible(img)) continue;

    const alt = sanitizeText(img.alt, 60);
    const src = img.currentSrc || img.src || "";
    const rect = img.getBoundingClientRect();

    // Skip tiny icons (< 24px)
    if (rect.width < 24 || rect.height < 24) continue;

    if (src) {
      images.push({
        alt,
        src,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    }
  }

  return images;
}
