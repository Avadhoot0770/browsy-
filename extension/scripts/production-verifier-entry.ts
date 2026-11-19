/**
 * Production Verifier Bundle Entry
 * Exposes actual Browsy production functions on window for live browser verification.
 */

import {
  collectAccessibleRoots,
  extractPdpSizeOptions,
  parseSizeAvailability,
  verifyProductAttributes,
  parseProductSellingPrice,
  isElementDisabled,
  inspectProductDetail,
  inspectCandidateProducts,
} from "../src/execution/product-verifier";

(window as any).__browsyProductionVerifier = {
  collectAccessibleRoots,
  extractPdpSizeOptions,
  parseSizeAvailability,
  verifyProductAttributes,
  parseProductSellingPrice,
  isElementDisabled,
  inspectProductDetail,
  inspectCandidateProducts,
};
