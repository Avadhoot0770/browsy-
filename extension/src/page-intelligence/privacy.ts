/**
 * Privacy and Sanitization Safeguards for Browsy Page Intelligence
 * Strict policy: Never extract passwords, payment info, tokens, or private user form values.
 */

const SENSITIVE_KEYWORDS = [
  "password",
  "passwd",
  "passcode",
  "pin",
  "cvv",
  "cvc",
  "cc-number",
  "creditcard",
  "cardnumber",
  "ssn",
  "otp",
  "auth",
  "secret",
  "token",
];

/**
 * Checks if an input element is sensitive or carries credential/payment data.
 */
export function isSensitiveField(element: Element): boolean {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    return false;
  }

  // Passwords are unconditionally sensitive
  if (element instanceof HTMLInputElement && element.type.toLowerCase() === "password") {
    return true;
  }

  // Check attributes
  const type = (element.getAttribute("type") || "").toLowerCase();
  if (type === "password") return true;

  const name = (element.getAttribute("name") || "").toLowerCase();
  const id = (element.getAttribute("id") || "").toLowerCase();
  const autocomplete = (element.getAttribute("autocomplete") || "").toLowerCase();
  const placeholder = (element.getAttribute("placeholder") || "").toLowerCase();
  const ariaLabel = (element.getAttribute("aria-label") || "").toLowerCase();

  const combined = `${name} ${id} ${autocomplete} ${placeholder} ${ariaLabel}`;
  return SENSITIVE_KEYWORDS.some((kw) => combined.includes(kw));
}

/**
 * Sanitizes visible text to prevent giant text dumps or token pollution.
 */
export function sanitizeText(text: string | null | undefined, maxLength = 120): string {
  if (!text) return "";
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength).trim() + "…";
}
