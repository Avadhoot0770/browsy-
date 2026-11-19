/**
 * Generic Repeated Content and Card Detector for Browsy Page Intelligence
 * Identifies repeated collections (products, jobs, articles, search results)
 * without site-specific selectors or hardcoded class names.
 */

import type {
  RepeatedItemGroup,
  RepeatedItem,
  RepeatedItemType,
  PriceInfo,
  RatingInfo,
} from "./types";
import { elementRegistry } from "./element-registry";
import { isBrowsyOwned, isElementVisible, getBounds } from "./visibility";
import { extractPrice, extractRating } from "./price-rating-parser";
import { sanitizeText } from "./privacy";

const MIN_REPEATED_COUNT = 3;
const MAX_GROUPS = 5;
const MAX_ITEMS_PER_GROUP = 40;

/**
 * Generates a lightweight structural fingerprint for an element based on its tagName and classes.
 */
function getStructuralKey(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const classes = Array.from(element.classList)
    .filter((c) => !c.startsWith("browsy-") && !c.includes("active") && !c.includes("hover"))
    .sort()
    .slice(0, 3)
    .join(".");
  return classes ? `${tag}.${classes}` : tag;
}

/**
 * Extracts item metadata from a candidate repeated card.
 */
function extractCardItem(cardEl: Element): RepeatedItem {
  const elementId = elementRegistry.register(cardEl);
  const bounds = getBounds(cardEl);

  // 1. Title: check heading tags first, then strong/bold, then first prominent text
  let title = "";
  const heading = cardEl.querySelector("h1, h2, h3, h4, h5, h6, [role='heading']");
  if (heading && !isBrowsyOwned(heading)) {
    title = sanitizeText(heading.textContent, 90);
  } else {
    const boldEl = cardEl.querySelector("strong, b");
    if (boldEl && !isBrowsyOwned(boldEl)) {
      title = sanitizeText(boldEl.textContent, 90);
    } else {
      const firstLink = cardEl.querySelector("a[href]");
      if (firstLink && !isBrowsyOwned(firstLink) && firstLink.textContent) {
        title = sanitizeText(firstLink.textContent, 90);
      } else {
        title = sanitizeText(cardEl.textContent, 60);
      }
    }
  }

  // 2. Price detection
  let price: PriceInfo | null = null;
  const fullText = cardEl.textContent || "";
  price = extractPrice(fullText);

  // 3. Rating detection
  let rating: RatingInfo | null = null;
  rating = extractRating(fullText);

  // 4. Primary Link
  let link: { href: string; text: string } | undefined = undefined;
  const anchorEl = cardEl.tagName === "A" ? cardEl : cardEl.querySelector("a[href]");
  if (anchorEl instanceof HTMLAnchorElement && !isBrowsyOwned(anchorEl) && anchorEl.href) {
    link = {
      href: anchorEl.href,
      text: sanitizeText(anchorEl.textContent || title, 60),
    };
  }

  // 5. Image info
  let imageUrl: string | undefined = undefined;
  let imageAlt: string | undefined = undefined;
  const imgEl = cardEl.querySelector("img");
  if (imgEl instanceof HTMLImageElement && !isBrowsyOwned(imgEl)) {
    imageUrl = imgEl.src || imgEl.getAttribute("data-src") || undefined;
    imageAlt = imgEl.alt ? sanitizeText(imgEl.alt, 60) : undefined;
  }

  // 6. Meta text (e.g. sizes, brands, categories, attributes, tags)
  const metaText: string[] = [];
  const metaNodes = cardEl.querySelectorAll(
    "h3, h4, h5, h6, p, span, [class*='size'], [class*='brand'], [class*='desc'], [class*='meta'], [class*='attr'], [class*='badge'], [class*='tag']"
  );
  for (let i = 0; i < metaNodes.length; i++) {
    const node = metaNodes[i];
    if (isBrowsyOwned(node)) continue;
    if (node.children.length > 4) continue;
    const txt = sanitizeText(node.textContent, 80);
    if (txt && !metaText.includes(txt) && txt !== title) {
      metaText.push(txt);
      if (metaText.length >= 12) break;
    }
  }

  return {
    elementId,
    title: title || "Item",
    price: price || undefined,
    rating: rating || undefined,
    link,
    imageUrl,
    imageAlt,
    metaText: metaText.length > 0 ? metaText : undefined,
    bounds,
  };
}

/**
 * Infers whether a group of items resembles products, jobs, articles, or generic cards.
 */
function inferGroupType(items: RepeatedItem[]): RepeatedItemType {
  let priceCount = 0;
  let ratingCount = 0;
  let jobKeywordCount = 0;
  let articleKeywordCount = 0;

  for (const item of items) {
    if (item.price) priceCount += 1;
    if (item.rating) ratingCount += 1;

    const lower = `${item.title} ${item.imageAlt || ""}`.toLowerCase();
    if (/salary|experience|apply|full-time|part-time|remote|engineer|manager/i.test(lower)) {
      jobKeywordCount += 1;
    }
    if (/author|published|read time|min read|blog|article|byline/i.test(lower)) {
      articleKeywordCount += 1;
    }
  }

  const ratio = items.length > 0 ? priceCount / items.length : 0;
  if (ratio >= 0.25 || (priceCount >= 2 && ratingCount >= 1)) {
    return "product-like";
  }
  if (jobKeywordCount >= 2) {
    return "job-like";
  }
  if (articleKeywordCount >= 2) {
    return "article-like";
  }

  return "generic";
}

/**
 * Scans the DOM for repeated sibling clusters representing collections of cards.
 */
export function detectRepeatedContent(): RepeatedItemGroup[] {
  const groups: RepeatedItemGroup[] = [];
  const processedParents = new Set<Element>();

  // Target containers likely to host repeated lists: ul, ol, div, section, main, grid containers
  const containerCandidates = document.querySelectorAll(
    "ul, ol, div, section, main, [role='list'], [role='feed'], [role='grid']"
  );

  for (const container of containerCandidates) {
    if (groups.length >= MAX_GROUPS) break;
    if (processedParents.has(container)) continue;
    if (isBrowsyOwned(container) || !isElementVisible(container)) continue;
    if (typeof (container as any).closest === "function" && (container as any).closest("nav, header, footer, [role='navigation'], [class*='breadcrumb' i]")) {
      continue;
    }

    const children = Array.from(container.children).filter(
      (child) => !isBrowsyOwned(child) && isElementVisible(child)
    );

    if (children.length < MIN_REPEATED_COUNT) continue;

    // Cluster direct children by structural key
    const clusters = new Map<string, Element[]>();
    for (const child of children) {
      const key = getStructuralKey(child);
      const list = clusters.get(key) || [];
      list.push(child);
      clusters.set(key, list);
    }

    // Find largest cluster meeting the minimum threshold
    for (const [key, clusterItems] of clusters.entries()) {
      if (clusterItems.length >= MIN_REPEATED_COUNT) {
        processedParents.add(container);

        const items: RepeatedItem[] = [];
        const limit = Math.min(clusterItems.length, MAX_ITEMS_PER_GROUP);

        for (let i = 0; i < limit; i++) {
          const item = extractCardItem(clusterItems[i]);
          items.push(item);
        }

        const inferredType = inferGroupType(items);
        const containerSelector = container.id
          ? `#${container.id}`
          : `${container.tagName.toLowerCase()} > ${key}`;

        groups.push({
          containerSelector,
          inferredType,
          count: clusterItems.length,
          items,
        });

        break; // Only take one primary group per container
      }
    }
  }

  // Prioritize product-like groups over generic link clusters
  groups.sort((a, b) => {
    const scoreA = a.inferredType === "product-like" ? 2 : a.inferredType === "job-like" ? 1 : 0;
    const scoreB = b.inferredType === "product-like" ? 2 : b.inferredType === "job-like" ? 1 : 0;
    return scoreB - scoreA;
  });

  return groups;
}
