/**
 * Catalog Intelligence Engine for Browsy Page Intelligence
 *
 * Safely extracts and normalizes structured catalog metadata embedded in normal page traffic
 * (e.g. window.__myx on Myntra, __NEXT_DATA__ on Next.js storefronts, or application/ld+json).
 *
 * STRICT INVARIANTS:
 * 1. Read-only inspection of permitted, ordinary browser traffic / DOM data already delivered to browser.
 * 2. Never marks an item available in a size merely because the size appears in an offered sizes list.
 * 3. Requires explicit size-specific availability evidence (e.g. inventory > 0 and available: true).
 * 4. Retains product-page inspection when catalog data cannot prove a mandatory constraint.
 */

import { extractPrice, extractRating } from "./price-rating-parser";

export interface CatalogInventorySku {
  label: string;
  available: boolean;
  inventory?: number;
  skuId?: number | string;
}

export interface CatalogProductItem {
  productId: string;
  title: string;
  brand?: string;
  price: number;
  mrp?: number;
  currency: string;
  color?: string;
  gender?: string;
  url: string;
  imageUrl?: string;
  rating?: number;
  ratingCount?: number;
  sizes: string[];
  inventoryInfo?: CatalogInventorySku[];
  rawSource: "myx_catalog" | "next_data" | "ld_json" | "amazon_search" | "flipkart_catalog";
}

export interface CatalogSizeVerification {
  isVerified: boolean;
  status: "in_stock" | "out_of_stock" | "not_offered" | "unverified";
  evidence: string;
}

/**
 * Extracts all available catalog products from the document scripts.
 */
export function extractCatalogProducts(doc?: Document | null): CatalogProductItem[] {
  const documentObj = doc || (typeof document !== "undefined" ? document : null);
  if (!documentObj || typeof documentObj.querySelectorAll !== "function") return [];

  const results: CatalogProductItem[] = [];
  const scripts = Array.from(documentObj.querySelectorAll("script"));

  for (const script of scripts) {
    const text = script.textContent;
    if (!text) continue;

    // 1. Myntra window.__myx Catalog Payload
    if (text.includes("window.__myx") && text.includes("searchData")) {
      try {
        const idx = text.indexOf("window.__myx");
        const eqIdx = text.indexOf("=", idx);
        if (eqIdx !== -1) {
          const jsonStr = text.substring(eqIdx + 1).trim().replace(/;?\s*$/, "");
          const parsed = JSON.parse(jsonStr);
          const rawProducts = parsed.searchData?.results?.products;
          if (Array.isArray(rawProducts)) {
            for (const p of rawProducts) {
              const item = normalizeMyxProduct(p);
              if (item) results.push(item);
            }
            if (results.length > 0) return results;
          }
        }
      } catch (err) {
        console.debug("[Browsy] Failed to parse __myx catalog data:", err);
      }
    }

    // 2. Next.js __NEXT_DATA__ E-Commerce Payload
    if (text.includes("__NEXT_DATA__") && script.id === "__NEXT_DATA__") {
      try {
        const parsed = JSON.parse(text);
        const products =
          parsed.props?.pageProps?.products ||
          parsed.props?.pageProps?.searchData?.products ||
          parsed.props?.pageProps?.initialData?.products;
        if (Array.isArray(products)) {
          for (const p of products) {
            const item = normalizeNextDataProduct(p);
            if (item) results.push(item);
          }
          if (results.length > 0) return results;
        }
      } catch (err) {
        console.debug("[Browsy] Failed to parse __NEXT_DATA__:", err);
      }
    }

    // 3. Schema.org application/ld+json Product or ItemList
    if (script.type === "application/ld+json") {
      try {
        const parsed = JSON.parse(text);
        if (parsed["@type"] === "ItemList" && Array.isArray(parsed.itemListElement)) {
          for (const entry of parsed.itemListElement) {
            const prod = entry.item || entry;
            if (prod["@type"] === "Product") {
              const item = normalizeLdJsonProduct(prod);
              if (item) results.push(item);
            }
          }
        } else if (parsed["@type"] === "Product") {
          const item = normalizeLdJsonProduct(parsed);
          if (item) results.push(item);
        }
      } catch {
        // ignore malformed schema scripts
      }
    }
  }

  if (results.length > 0) return results;

  // 4. Amazon Search / Product Structured Cards
  const amazonProducts = extractAmazonProducts(documentObj);
  if (amazonProducts.length > 0) return amazonProducts;

  // 5. Flipkart Search / Product Structured Cards
  const flipkartProducts = extractFlipkartProducts(documentObj);
  if (flipkartProducts.length > 0) return flipkartProducts;

  return results;
}

/**
 * Normalizes a Myntra __myx product entry into a clean CatalogProductItem.
 */
function normalizeMyxProduct(p: any): CatalogProductItem | null {
  if (!p || !p.productId) return null;

  const rawSizesStr = String(p.sizes || "");
  const sizes = rawSizesStr
    ? rawSizesStr.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : [];

  const inventoryInfo: CatalogInventorySku[] = [];
  if (Array.isArray(p.inventoryInfo)) {
    for (const inv of p.inventoryInfo) {
      if (inv && inv.label) {
        inventoryInfo.push({
          label: String(inv.label).trim().toUpperCase(),
          available: Boolean(inv.available),
          inventory: typeof inv.inventory === "number" ? inv.inventory : undefined,
          skuId: inv.skuId,
        });
      }
    }
  }

  const landingUrl = String(p.landingPageUrl || "");
  const fullUrl = landingUrl.startsWith("http")
    ? landingUrl
    : `https://www.myntra.com/${landingUrl.replace(/^\//, "")}`;

  const brand = p.brand ? String(p.brand).trim() : "";
  const name = p.productName || p.product || "";
  const title = brand && !name.toLowerCase().startsWith(brand.toLowerCase())
    ? `${brand} ${name}`.trim()
    : name || brand || "Product";

  return {
    productId: String(p.productId),
    title,
    brand,
    price: typeof p.price === "number" ? p.price : parseFloat(p.price) || 0,
    mrp: typeof p.mrp === "number" ? p.mrp : parseFloat(p.mrp) || undefined,
    currency: "INR",
    color: p.primaryColour ? String(p.primaryColour).trim() : undefined,
    gender: p.gender ? String(p.gender).trim() : undefined,
    url: fullUrl,
    imageUrl: p.searchImage ? String(p.searchImage) : undefined,
    rating: typeof p.rating === "number" ? p.rating : parseFloat(p.rating) || undefined,
    ratingCount: typeof p.ratingCount === "number" ? p.ratingCount : undefined,
    sizes,
    inventoryInfo,
    rawSource: "myx_catalog",
  };
}

/**
 * Normalizes Next.js product entry.
 */
function normalizeNextDataProduct(p: any): CatalogProductItem | null {
  if (!p || (!p.id && !p.productId)) return null;

  const id = String(p.id || p.productId);
  const title = String(p.title || p.name || "Product");
  const price = typeof p.price === "number" ? p.price : parseFloat(p.price) || 0;
  const url = String(p.url || p.link || "");

  const sizes: string[] = [];
  if (Array.isArray(p.sizes)) {
    for (const s of p.sizes) {
      if (typeof s === "string") sizes.push(s.toUpperCase());
      else if (s && s.name) sizes.push(String(s.name).toUpperCase());
    }
  }

  return {
    productId: id,
    title,
    price,
    currency: p.currency || "INR",
    url,
    sizes,
    rawSource: "next_data",
  };
}

/**
 * Normalizes schema.org Product entry.
 */
function normalizeLdJsonProduct(p: any): CatalogProductItem | null {
  if (!p || !p.name) return null;

  const offers = p.offers || {};
  const price = typeof offers.price === "number" ? offers.price : parseFloat(offers.price) || 0;
  const currency = offers.priceCurrency || "INR";
  const url = p.url || offers.url || "";

  return {
    productId: String(p.sku || p.productID || url || p.name),
    title: String(p.name),
    brand: typeof p.brand === "string" ? p.brand : p.brand?.name,
    price,
    currency,
    url,
    imageUrl: typeof p.image === "string" ? p.image : p.image?.[0],
    sizes: [],
    rawSource: "ld_json",
  };
}

/**
 * Normalizes Amazon search result items from DOM or script data.
 */
export function extractAmazonProducts(doc?: Document | null): CatalogProductItem[] {
  const documentObj = doc || (typeof document !== "undefined" ? document : null);
  if (!documentObj || typeof documentObj.querySelectorAll !== "function") return [];

  const results: CatalogProductItem[] = [];
  const searchCards = Array.from(
    documentObj.querySelectorAll("div[data-component-type='s-search-result'], div.s-result-item[data-asin]")
  );

  for (const card of searchCards) {
    const asin = card.getAttribute("data-asin")?.trim();
    if (!asin) continue;

    const titleEl = card.querySelector("h2 a span, h2 span, h2 a, h2, img[alt]");
    const fallbackImg = card.querySelector("img.s-image, img");
    const title =
      titleEl?.textContent?.trim() ||
      (typeof HTMLImageElement !== "undefined" && titleEl instanceof HTMLImageElement
        ? titleEl.alt
        : (titleEl as any)?.alt || fallbackImg?.getAttribute("alt") || "");
    if (!title) continue;

    const priceEl = card.querySelector(".a-price .a-offscreen, .a-price-whole, .a-color-price");
    const rawPrice = priceEl?.textContent || (card.textContent?.match(/₹\s*([0-9,]+)/)?.[0] || "");
    const parsedPrice = extractPrice(rawPrice);

    const ratingEl = card.querySelector("i.a-icon-star-small span.a-icon-alt, i.a-icon-star span.a-icon-alt");
    const ratingParsed = ratingEl ? extractRating(ratingEl.textContent || "") : null;

    const linkEl = card.querySelector("h2 a.a-link-normal, a.a-link-normal[href*='/dp/'], a.a-link-normal, a[href*='/dp/'], a");
    const rawHref = linkEl?.getAttribute("href") || "";
    const href = rawHref || (asin ? `/dp/${asin}` : "");
    const fullUrl = href.startsWith("http")
      ? href
      : `https://www.amazon.in/${href.replace(/^\//, "")}`;

    const imgEl = card.querySelector("img.s-image") as HTMLImageElement | null;
    const imageUrl = imgEl?.src || undefined;

    // Check availability indication on card (e.g. out of stock or currently unavailable)
    const cardText = card.textContent?.toLowerCase() || "";
    const isOutOfStock =
      cardText.includes("currently unavailable") ||
      cardText.includes("temporarily out of stock") ||
      cardText.includes("out of stock");

    results.push({
      productId: asin,
      title,
      price: parsedPrice?.amount || 0,
      currency: parsedPrice?.currency || "INR",
      url: fullUrl,
      imageUrl,
      rating: ratingParsed?.score,
      sizes: [],
      inventoryInfo: isOutOfStock
        ? [{ label: "ALL", available: false, inventory: 0 }]
        : undefined,
      rawSource: "amazon_search",
    });
  }

  return results;
}

/**
 * Normalizes Flipkart catalog and search items from __INITIAL_STATE__ or DOM cards.
 */
export function extractFlipkartProducts(doc?: Document | null): CatalogProductItem[] {
  const documentObj = doc || (typeof document !== "undefined" ? document : null);
  if (!documentObj || typeof documentObj.querySelectorAll !== "function") return [];

  const results: CatalogProductItem[] = [];

  // 1. Check window.__INITIAL_STATE__ in script tags if present
  const scripts = Array.from(documentObj.querySelectorAll("script"));
  for (const script of scripts) {
    const text = script.textContent;
    if (text && text.includes("__INITIAL_STATE__")) {
      try {
        const idx = text.indexOf("__INITIAL_STATE__");
        const eqIdx = text.indexOf("=", idx);
        if (eqIdx !== -1) {
          const jsonStr = text.substring(eqIdx + 1).trim().replace(/;?\s*$/, "");
          const state = JSON.parse(jsonStr);
          const pageData = state.pageDataV4 || state.pageData || {};
          const slots = pageData.page?.data?.widgetList || [];
          for (const slot of slots) {
            const productList = slot.data?.products || [];
            for (const p of productList) {
              const productInfo = p.productInfo?.value || p;
              if (productInfo && (productInfo.id || productInfo.productId)) {
                const id = String(productInfo.id || productInfo.productId);
                const title = productInfo.titles?.title || productInfo.name || "Product";
                const pricing = productInfo.pricing?.finalPrice || productInfo.price || {};
                const price = typeof pricing.value === "number" ? pricing.value : typeof pricing === "number" ? pricing : 0;
                const url = productInfo.baseUrl ? `https://www.flipkart.com${productInfo.baseUrl}` : "";
                results.push({
                  productId: id,
                  title,
                  price,
                  currency: "INR",
                  url,
                  sizes: [],
                  rawSource: "flipkart_catalog",
                });
              }
            }
          }
        }
      } catch {}
    }
  }

  if (results.length > 0) return results;

  // 2. DOM-based search result extraction on Flipkart
  const cards = Array.from(
    documentObj.querySelectorAll("div[data-id], div._1sdMkc, div.slAVV4, div._75nlfW, div._2kHMtA, div._1AtVbE")
  );

  for (const card of cards) {
    const dataId = card.getAttribute("data-id");
    const titleEl = card.querySelector("a.wjcEIp, a.IRpwTa, div.KzDlHZ, a[title]");
    const title = titleEl?.getAttribute("title") || titleEl?.textContent?.trim() || "";
    if (!title) continue;

    const priceEl = card.querySelector("div.Nx9bqj, div._30jeq3, div._1vC4OE, div.hl05eU, div[class*='Nx9bqj'], div[class*='_30jeq3'], div[class*='price'], span[class*='price']");
    const rawPrice = priceEl?.textContent || (card.textContent?.match(/₹\s*([0-9,]+)/)?.[0] || "");
    const parsedPrice = extractPrice(rawPrice);

    const ratingEl = card.querySelector("div.XQDdHH, div._3LWZlK");
    const ratingParsed = ratingEl ? extractRating(ratingEl.textContent || "") : null;

    const linkEl = card.querySelector("a.wjcEIp, a.VJA3rP, a[href*='/p/']");
    const href = linkEl?.getAttribute("href") || "";
    const fullUrl = href.startsWith("http")
      ? href
      : `https://www.flipkart.com/${href.replace(/^\//, "")}`;

    const imgEl = card.querySelector("img.DByuf4, img._396cs4, img") as HTMLImageElement | null;
    const imageUrl = imgEl?.src || undefined;

    results.push({
      productId: dataId || fullUrl || title,
      title,
      price: parsedPrice?.amount || 0,
      currency: "INR",
      url: fullUrl,
      imageUrl,
      rating: ratingParsed?.score,
      sizes: [],
      rawSource: "flipkart_catalog",
    });
  }

  return results;
}

/**
 * Matches a catalog product against a candidate URL or identifier.
 */
export function findCatalogProductByUrl(
  catalogProducts: CatalogProductItem[],
  href: string
): CatalogProductItem | null {
  if (!href || catalogProducts.length === 0) return null;

  const cleanHref = href.toLowerCase().replace(/https?:\/\/[^/]+/i, "").replace(/\/buy.*$/i, "");
  
  // 1. Myntra Product ID: /(\d{5,12})(?:\/buy|\?|$)/
  const productIdMatch = href.match(/\/(\d{5,12})(?:\/buy|\?|$)/);
  const targetId = productIdMatch ? productIdMatch[1] : "";

  // 2. Amazon ASIN: /(?:dp|product|gp\/product)\/([A-Z0-9]{10})/i
  const asinMatch = href.match(/(?:dp|product|gp\/product)\/([A-Z0-9]{10})/i);
  const asinTarget = asinMatch ? asinMatch[1] : "";

  // 3. Flipkart Product ID: /(?:pid=|itm)([a-zA-Z0-9]+)/i
  const flipkartMatch = href.match(/(?:pid=|itm)([a-zA-Z0-9]+)/i);
  const flipkartTarget = flipkartMatch ? flipkartMatch[1] : "";

  for (const p of catalogProducts) {
    if (targetId && p.productId === targetId) return p;
    if (asinTarget && p.productId === asinTarget) return p;
    if (flipkartTarget && p.productId.toLowerCase().includes(flipkartTarget.toLowerCase())) return p;

    const cleanCatalogUrl = p.url.toLowerCase().replace(/https?:\/\/[^/]+/i, "").replace(/\/buy.*$/i, "");
    if (cleanHref.includes(cleanCatalogUrl) || cleanCatalogUrl.includes(cleanHref)) {
      return p;
    }
  }

  return null;
}

/**
 * Evaluates whether catalog data provides conclusive size-specific inventory proof.
 *
 * STRICT INVARIANT:
 * Mere presence in `sizes` list does NOT prove availability.
 * Requires `inventoryInfo` containing `{ label: requestedSize, available: true }`.
 */
export function evaluateCatalogSizeVerification(
  product: CatalogProductItem,
  requestedSize: string
): CatalogSizeVerification {
  const reqUpper = requestedSize.trim().toUpperCase();

  // 1. Check if size is even offered for this product
  if (product.sizes.length > 0 && !product.sizes.includes(reqUpper)) {
    return {
      isVerified: false,
      status: "not_offered",
      evidence: `Size ${reqUpper} is not offered for this product (offered sizes: ${product.sizes.join(", ")})`,
    };
  }

  // 2. Check if inventoryInfo explicitly confirms the size availability
  if (product.inventoryInfo && product.inventoryInfo.length > 0) {
    const sku = product.inventoryInfo.find((s) => s.label === reqUpper);
    if (sku) {
      if (sku.available && (sku.inventory === undefined || sku.inventory > 0)) {
        const qtyStr = typeof sku.inventory === "number" ? ` (${sku.inventory} in stock)` : "";
        return {
          isVerified: true,
          status: "in_stock",
          evidence: `Verified size ${reqUpper} available in catalog inventory${qtyStr}`,
        };
      } else {
        return {
          isVerified: false,
          status: "out_of_stock",
          evidence: `Size ${reqUpper} is explicitly marked out of stock in catalog inventory`,
        };
      }
    }
  }

  // 3. Size is offered in product.sizes, but inventoryInfo did not include size-specific stock
  // Invariant: MUST NOT assume availability without proof. Retain PDP inspection.
  return {
    isVerified: false,
    status: "unverified",
    evidence: `Size ${reqUpper} is listed in offered sizes, but size-specific stock requires product page inspection`,
  };
}
