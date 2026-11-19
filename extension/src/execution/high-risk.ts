/**
 * High-Risk Action Classification and Security Boundaries for Stage 4
 * Enforces strict prohibitions against automated payment, password entry, and authentication,
 * and identifies operations requiring a second explicit user confirmation.
 */

import type { ActionPlanStep } from "../intent/types";
import type { ActionRiskLevel } from "./types";

/**
 * Keywords that indicate high-risk operations (financial, destructive, account).
 */
const HIGH_RISK_KEYWORDS = [
  "purchase",
  "buy",
  "pay",
  "place order",
  "complete order",
  "checkout",
  "charge",
  "transfer",
  "subscribe",
  "billing",
  "delete account",
  "delete profile",
  "remove account",
  "reset password",
  "delete all",
  "terminate",
  "legal agreement",
  "agree to terms",
];

/**
 * Keywords that indicate medium-risk operations (form submission, carts, applications).
 */
const MEDIUM_RISK_KEYWORDS = [
  "submit",
  "send message",
  "apply now",
  "add to cart",
  "add to basket",
  "save changes",
  "update profile",
  "contact us",
  "post comment",
];

/**
 * Attributes and types denoting password or sensitive authentication fields.
 */
const SENSITIVE_INPUT_TYPES = new Set([
  "password",
  "hidden",
]);

const AUTH_FIELD_NAMES = [
  "password",
  "passwd",
  "pwd",
  "secret",
  "otp",
  "totp",
  "2fa",
  "mfa",
  "passcode",
  "security-code",
  "auth-token",
  "ssn",
];

const PAYMENT_FIELD_NAMES = [
  "card",
  "cvv",
  "cvc",
  "cardnumber",
  "card-number",
  "card_number",
  "ccnum",
  "creditcard",
  "debitcard",
  "bank-account",
  "routing-number",
  "upi",
  "upi-pin",
  "billing",
  "expir",
];

/**
 * Determines whether a target DOM element is a prohibited password or authentication field.
 * In Stage 4, interacting with authentication fields is strictly forbidden.
 */
export function isSensitiveAuthField(element: Element): boolean {
  if (element instanceof HTMLInputElement) {
    const inputType = (element.type || "").toLowerCase();
    if (SENSITIVE_INPUT_TYPES.has(inputType)) {
      return true;
    }

    const autocomplete = (element.autocomplete || "").toLowerCase();
    if (autocomplete.includes("password") || autocomplete.includes("one-time-code")) {
      return true;
    }

    const name = (element.name || "").toLowerCase();
    const id = (element.id || "").toLowerCase();
    const placeholder = (element.placeholder || "").toLowerCase();
    const ariaLabel = (element.getAttribute("aria-label") || "").toLowerCase();

    for (const kw of AUTH_FIELD_NAMES) {
      if (
        name.includes(kw) ||
        id.includes(kw) ||
        placeholder.includes(kw) ||
        ariaLabel.includes(kw)
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Determines whether a target DOM element is a payment or financial transaction field.
 * In Stage 4, interacting with payment fields is strictly forbidden.
 */
export function isPaymentOrFinancialField(element: Element): boolean {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const autocomplete = (element instanceof HTMLInputElement ? element.autocomplete || "" : "").toLowerCase();
    if (autocomplete.includes("cc-")) {
      return true;
    }

    const name = (element.name || "").toLowerCase();
    const id = (element.id || "").toLowerCase();
    const placeholder = (element.placeholder || "").toLowerCase();
    const ariaLabel = (element.getAttribute("aria-label") || "").toLowerCase();
    const combined = `${name} ${id} ${placeholder} ${ariaLabel}`;

    for (const term of PAYMENT_FIELD_NAMES) {
      if (combined.includes(term)) return true;
    }
  }

  return false;
}

/**
 * Assesses the risk level of an action plan step.
 * Returns LOW, MEDIUM, or HIGH risk.
 */
export function classifyActionRisk(step: ActionPlanStep): ActionRiskLevel {
  const text = `${step.description} ${step.targetLabel || ""} ${step.value || ""}`.toLowerCase();

  for (const kw of HIGH_RISK_KEYWORDS) {
    if (text.includes(kw)) {
      return "high";
    }
  }

  for (const kw of MEDIUM_RISK_KEYWORDS) {
    if (text.includes(kw)) {
      return "medium";
    }
  }

  return "low";
}

/**
 * Evaluates whether an ActionPlan is eligible for hands-free automatic execution.
 * Only low-risk actions (search, navigation, non-destructive filtering) are eligible.
 * Any plan containing medium or high-risk actions (purchases, payments, messages, submissions)
 * strictly requires explicit user confirmation.
 */
export function isEligibleForAutoExecution(plan: { steps?: ActionPlanStep[] }): boolean {
  if (!plan || !plan.steps || plan.steps.length === 0) return false;
  for (const step of plan.steps) {
    const risk = classifyActionRisk(step);
    if (risk !== "low") return false;
  }
  return true;
}

/**
 * Generates user-friendly warning text for high-risk actions.
 */
export function getHighRiskWarning(step: ActionPlanStep): string {
  const text = step.description.toLowerCase();
  if (text.includes("purchase") || text.includes("buy") || text.includes("order")) {
    return "This action may complete an order or financial commitment. Please confirm you wish to proceed.";
  }
  if (text.includes("delete") || text.includes("remove")) {
    return "This action may delete or permanently remove data. Please confirm you wish to proceed.";
  }
  return "This action performs a sensitive operation on the page. Please confirm you wish to proceed.";
}
