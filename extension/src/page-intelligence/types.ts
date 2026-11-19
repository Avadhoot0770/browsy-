/**
 * Strong TypeScript types for Browsy Stage 2 Page Intelligence
 * Provides generic, structured semantic models for webpage inspection.
 */

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type InteractiveElementType =
  | "search"
  | "button"
  | "link"
  | "input"
  | "textarea"
  | "select"
  | "checkbox"
  | "radio"
  | "tab"
  | "menuitem"
  | "other";

export interface InteractiveElement {
  /** Stable runtime in-memory handle (e.g. browsy-el-001) */
  elementId: string;
  type: InteractiveElementType;
  role: string;
  tagName: string;
  text: string;
  ariaLabel?: string;
  placeholder?: string;
  name?: string;
  href?: string;
  disabled: boolean;
  bounds: BoundingBox;
  inputType?: string;
  checked?: boolean;
  options?: string[];
  nearbyLabel?: string;
  formId?: string;
  formName?: string;
  isObstructed?: boolean;
}

export interface FormInfo {
  elementId: string;
  name?: string;
  action?: string;
  method?: string;
  inputCount: number;
  buttonCount: number;
  hasSearchRole: boolean;
}

export type CurrencyCode = "INR" | "USD" | "EUR" | "GBP" | "UNKNOWN";

export interface PriceInfo {
  raw: string;
  amount: number;
  currency: CurrencyCode;
}

export interface RatingInfo {
  raw: string;
  score: number;
  maxScore: number;
}

export type RepeatedItemType = "product-like" | "job-like" | "article-like" | "generic";

export interface RepeatedItem {
  elementId: string;
  title: string;
  price?: PriceInfo;
  rating?: RatingInfo;
  link?: {
    href: string;
    text: string;
  };
  imageUrl?: string;
  imageAlt?: string;
  metaText?: string[];
  badges?: string[];
  bounds: BoundingBox;
}

export interface RepeatedItemGroup {
  containerSelector: string;
  inferredType: RepeatedItemType;
  count: number;
  items: RepeatedItem[];
}

export interface PageHeading {
  level: number;
  text: string;
}

export interface PageImage {
  alt: string;
  src: string;
  width: number;
  height: number;
}

export interface PaginationControl {
  elementId: string;
  type: "next" | "prev" | "page";
  pageNumber?: number;
  text: string;
}

export interface TableInfo {
  elementId: string;
  rowCount: number;
  columnCount: number;
  headers: string[];
}

export interface PageIntelligenceStats {
  analysisDurationMs: number;
  totalInteractiveCount: number;
  buttonCount: number;
  linkCount: number;
  inputCount: number;
  searchCount: number;
  formCount: number;
  repeatedItemCount: number;
  repeatedGroupCount: number;
  headingCount: number;
  imageCount: number;
  priceCount: number;
  ratingCount: number;
  timestamp: number;
}

export interface StructuredPageIntelligence {
  url: string;
  hostname: string;
  pathname: string;
  title: string;
  summary: string;
  headings: PageHeading[];
  searchInputs: InteractiveElement[];
  buttons: InteractiveElement[];
  inputs: InteractiveElement[];
  links: InteractiveElement[];
  forms: FormInfo[];
  repeatedGroups: RepeatedItemGroup[];
  detectedPrices: PriceInfo[];
  detectedRatings: RatingInfo[];
  keyImages: PageImage[];
  pagination?: PaginationControl[];
  tables?: TableInfo[];
  stats: PageIntelligenceStats;
  timestamp: number;
}
