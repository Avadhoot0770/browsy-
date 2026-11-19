import React, { useState } from "react";
import type { PriceInfo, RatingInfo } from "../page-intelligence/types";
import type { ProductFocusResult } from "../execution/product-focus-bridge";

export interface VerifiedProductCardData {
  elementId?: string;
  title: string;
  url?: string;
  price?: PriceInfo | null;
  rating?: RatingInfo;
  imageUrl?: string;
  isFullyVerified?: boolean;
  rejectReason?: string;
  conditions?: {
    category?: { requested?: string; verified: boolean; evidence: string };
    color?: { requested?: string; verified: boolean; evidence: string };
    pattern?: { requested?: string; verified: boolean; evidence: string };
    price?: { maxBudget?: number; amount?: number; verified: boolean; evidence: string };
    size?: { requested?: string; available: boolean; selectable: boolean; status?: string; evidence: string };
  };
}

export interface VerifiedProductCardProps {
  product: VerifiedProductCardData;
  userQuery?: string;
  onOpenLink?: (url: string) => void;
  onFocusProduct?: (product: VerifiedProductCardData) => ProductFocusResult | void;
}

export const VerifiedProductCard: React.FC<VerifiedProductCardProps> = ({
  product,
  onOpenLink,
  onFocusProduct,
}) => {
  const [imgError, setImgError] = useState(false);
  const [focusFeedback, setFocusFeedback] = useState<"none" | "focused" | "not_found">("none");

  const handleCardClick = () => {
    if (!onFocusProduct) return;
    const res = onFocusProduct(product);
    if (res && typeof res === "object") {
      if (res.success) {
        setFocusFeedback("focused");
        setTimeout(() => setFocusFeedback("none"), 2500);
      } else {
        setFocusFeedback("not_found");
        setTimeout(() => setFocusFeedback("none"), 3500);
      }
    }
  };

  const priceText = product.price?.raw
    ? product.price.raw
    : product.price?.amount
    ? `₹${product.price.amount.toLocaleString()}`
    : null;

  const sizeCond = product.conditions?.size;
  const colorCond = product.conditions?.color;
  const patternCond = product.conditions?.pattern;
  const priceCond = product.conditions?.price;
  const catCond = product.conditions?.category;

  const requestedSize = sizeCond?.requested || "XL";
  const sizeStatus = sizeCond?.status || (sizeCond?.available ? "in_stock" : "unverified");
  const isSizeInStock = sizeStatus === "in_stock" && sizeCond?.available;

  // Determine explicit display tier to guarantee partial or unverified candidates are never shown as confirmed
  let displayTier: "fully_verified" | "partial" | "unverified_candidate" | "failed_check" = "unverified_candidate";
  let tierLabel = "○ Unverified Candidate";

  if (product.isFullyVerified) {
    displayTier = "fully_verified";
    tierLabel = "✓ Fully Verified Match";
  } else if (
    product.rejectReason?.includes("HTTP") ||
    product.rejectReason?.includes("timed out") ||
    product.rejectReason?.includes("Network") ||
    product.rejectReason?.includes("error")
  ) {
    displayTier = "failed_check";
    tierLabel = "✕ Inspection Inconclusive / Failed";
  } else if (
    product.conditions &&
    (product.conditions.category?.verified || product.conditions.color?.verified || product.conditions.price?.verified)
  ) {
    displayTier = "partial";
    tierLabel = "⚠ Partial Match (Some Constraints Unverified)";
  }

  return (
    <div
      className={`browsy-verified-product-card ${displayTier} ${onFocusProduct ? "clickable" : ""}`}
      role="region"
      aria-label="Verified Product Result"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick();
        }
      }}
    >
      <div className="browsy-product-badge-row">
        <span className={`browsy-product-status-pill ${displayTier}`}>
          {tierLabel}
        </span>
        {product.rating && (
          <span className="browsy-product-rating-pill" aria-label={`Rating ${product.rating.score} stars`}>
            ★ {product.rating.score.toFixed(1)}
          </span>
        )}
      </div>

      {focusFeedback === "focused" && (
        <div className="browsy-product-focus-notice success" role="status">
          <span>✓ Scrolled and highlighted on page</span>
        </div>
      )}

      {focusFeedback === "not_found" && (
        <div className="browsy-product-focus-notice failed" role="alert">
          <span>ℹ Could not locate element in current view. Click &quot;View on Store ↗&quot; to open the product directly.</span>
        </div>
      )}

      {product.rejectReason && !product.isFullyVerified && (
        <div className="browsy-product-reject-notice" role="note">
          <span>ℹ Note: {product.rejectReason}</span>
        </div>
      )}

      <div className="browsy-product-main">
        {product.imageUrl && !imgError ? (
          <div className="browsy-product-image-container">
            <img
              src={product.imageUrl}
              alt={product.title}
              className="browsy-product-image"
              onError={() => setImgError(true)}
              loading="lazy"
            />
          </div>
        ) : (
          <div className="browsy-product-image-placeholder" aria-hidden="true">
            🛍️
          </div>
        )}

        <div className="browsy-product-details">
          <h4 className="browsy-product-title" title={product.title}>
            {product.title}
          </h4>

          {priceText && (
            <div className="browsy-product-price-row">
              <span className="browsy-product-price">{priceText}</span>
              {priceCond?.maxBudget && (
                <span className="browsy-product-budget-tag">
                  (within ₹{priceCond.maxBudget.toLocaleString()} budget)
                </span>
              )}
            </div>
          )}

          <div className="browsy-product-attribute-pills">
            {requestedSize && (
              <span
                className={`browsy-attr-pill size ${isSizeInStock ? "in-stock" : "oos"}`}
                title={sizeCond?.evidence || `Size ${requestedSize}`}
              >
                Size {requestedSize}: {isSizeInStock ? "In Stock" : sizeStatus.replace(/_/g, " ")}
              </span>
            )}
            {colorCond?.requested && (
              <span className="browsy-attr-pill color" title={colorCond.evidence}>
                {colorCond.requested}
              </span>
            )}
            {patternCond?.requested && (
              <span className="browsy-attr-pill pattern" title={patternCond.evidence}>
                {patternCond.requested}
              </span>
            )}
          </div>

          <div className="browsy-product-action-row">
            {onFocusProduct && (
              <button
                type="button"
                className={`browsy-product-focus-btn ${focusFeedback}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCardClick();
                }}
                title="Locate and highlight this product on the webpage"
              >
                {focusFeedback === "focused"
                  ? "✓ Focused on Page"
                  : focusFeedback === "not_found"
                  ? "⚠ Not in Current View"
                  : "🎯 Show on Page"}
              </button>
            )}

            {product.url && (
              <a
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                className="browsy-product-direct-link"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onOpenLink) {
                    e.preventDefault();
                    onOpenLink(product.url!);
                  }
                }}
                tabIndex={0}
                aria-label={`View ${product.title} on website`}
              >
                View on Store ↗
              </a>
            )}
          </div>
        </div>
      </div>

      {product.conditions && (
        <div className="browsy-checklist-container">
          <div className="browsy-checklist-header">Verified Constraint Checklist</div>
          <ul className="browsy-checklist-list" role="list">
            {catCond && (
              <li className={`browsy-checklist-item ${catCond.verified ? "verified" : "failed"}`}>
                <span className="browsy-checklist-icon">{catCond.verified ? "✓" : "✕"}</span>
                <div className="browsy-checklist-text">
                  <strong>Category:</strong> {catCond.evidence}
                </div>
              </li>
            )}
            {colorCond && (
              <li className={`browsy-checklist-item ${colorCond.verified ? "verified" : "failed"}`}>
                <span className="browsy-checklist-icon">{colorCond.verified ? "✓" : "✕"}</span>
                <div className="browsy-checklist-text">
                  <strong>Color:</strong> {colorCond.evidence}
                </div>
              </li>
            )}
            {patternCond && (
              <li className={`browsy-checklist-item ${patternCond.verified ? "verified" : "failed"}`}>
                <span className="browsy-checklist-icon">{patternCond.verified ? "✓" : "✕"}</span>
                <div className="browsy-checklist-text">
                  <strong>Pattern:</strong> {patternCond.evidence}
                </div>
              </li>
            )}
            {sizeCond && (
              <li
                className={`browsy-checklist-item ${
                  isSizeInStock ? "verified" : sizeCond.status === "out_of_stock" ? "failed" : "partial"
                }`}
              >
                <span className="browsy-checklist-icon">{isSizeInStock ? "✓" : "✕"}</span>
                <div className="browsy-checklist-text">
                  <strong>Size {requestedSize}:</strong> {sizeCond.evidence}
                </div>
              </li>
            )}
            {priceCond && (
              <li className={`browsy-checklist-item ${priceCond.verified ? "verified" : "failed"}`}>
                <span className="browsy-checklist-icon">{priceCond.verified ? "✓" : "✕"}</span>
                <div className="browsy-checklist-text">
                  <strong>Price:</strong> {priceCond.evidence}
                </div>
              </li>
            )}
            <li className="browsy-checklist-item verified">
              <span className="browsy-checklist-icon">✓</span>
              <div className="browsy-checklist-text">
                <strong>Adult Sizing:</strong> Children's and boys' garments excluded
              </div>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};
