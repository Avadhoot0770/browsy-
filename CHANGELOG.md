# Changelog

All notable changes to **Browsy** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0-beta] - 2026-11-20

### Initial Public Beta Release

Browsy is a website-agnostic, privacy-preserving AI browser assistant built as a Chrome Extension (Manifest V3) that understands natural-language instructions and helps users perform tasks directly on any website.

### Added

#### Universal Page Intelligence (Stage 2)
- **Semantic DOM & Open Shadow DOM Scanner**: Recursively inspects live web documents and open shadow roots (up to 15 levels deep) without hardcoded site selectors.
- **Automated Entity Classification**: Discovers interactive search inputs, buttons, links, form associations (`formId`/`formName`), pagination controls, data tables, and repeated card items.
- **Stable In-Memory Handles**: Generates deterministic runtime identifiers (`browsy-el-001`) with complete exclusion of the assistant's own Shadow DOM root (`<browsy-root data-browsy-root="true">`).
- **Catalog Script Extraction**: Native parsing for `__myx` (Myntra), `__NEXT_DATA__`, and JSON-LD `schema.org/Product` metadata for fast-path grounded attribute discovery.

#### Deterministic In-Browser Intent Engine (Stage 3)
- **Zero-Latency Heuristic NLU**: 100% offline rule-based parser extracting categories, brands, colors, patterns, sizes, ratings, and price budgets in $< 1\text{ ms}$ with zero API keys.
- **Multi-Turn Conversational Memory**: Context propagation across follow-up queries (e.g., updating size while preserving category, color, pattern, and budget constraints).
- **Brand Targeting & Exclusion**: Supports positive brand filtering and explicit negations (e.g., *"Exclude Roadster"*).
- **Price & Number Normalization**: Parses numerical budgets, text numbers (e.g., *"one thousand"*, *"3k"*), and currency units (INR, USD, EUR, GBP).

#### Supervised Action Planning & Pre-Interaction Visual Explainability (Stages 3.5 & 3.6)
- **Generic Action Planner**: Generates minimal observable steps with strict `status: "proposed"` invariant. Zero automated execution without explicit user approval.
- **Pre-Interaction Visual Overlays**: Non-blocking (`pointer-events: none`) visual boundary boxes and numbered badges rendered directly over targeted DOM controls on the host webpage.
- **Pending & Dynamic Step Badging**: Transparently flags navigation-dependent and dynamically loaded steps in the assistant panel without drawing misleading highlights.

#### Supervised Execution & Semantic Recovery (Stage 4)
- **Native Event Dispatching**: Dispatches realistic `input`, `change`, and `click` events with boundary guards and configurable timeouts.
- **Semantic Re-resolution**: Dynamically re-binds unmounted or stale DOM elements in dynamic single-page applications by matching tag, role, accessible name, and nearby labels.
- **Condition-Based Polling**: Efficiently awaits SPA DOM mutations without arbitrary sleep delays.
- **Security Guardrails**: Unconditionally blocks execution on password fields, financial checkout controls, credit card/CVV inputs, and SSNs. High-risk actions require secondary explicit confirmation.

#### Grounded Outcome Verification & Product Focus Bridge (Stage 4.5)
- **Truthful Completion Reporting**: Returns empirical status codes: `COMPLETED`, `PARTIALLY COMPLETED`, `FAILED`, or `NEEDS USER INPUT`.
- **Zero Hallucination Invariant**: Strictly rejects out-of-stock, sold-out, or over-budget items without fabricating prices, discounts, or sizes.
- **Host-Page Product Focus Bridge**: Clicking a verified product card or *"Show on Page"* button locates the product card in the retailer DOM, smoothly scrolls the viewport, and applies a temporary highlight with verified badge. Truthfully reports when an element cannot be located.

#### Local AI Companion Service (Optional)
- **Local LLM Integration**: Connects Browsy to local Ollama instances (recommended: `qwen2.5:1.5b`) for optional neural NLU and comparison assistance.
- **Zero-Dependency Companion Bridge**: Dual implementation in Node.js ([`backend/companion-service.mjs`](backend/companion-service.mjs)) and Python ([`backend/companion_service.py`](backend/companion_service.py)).
- **Windows 1-Click Launchers**: Added [`backend/scripts/start-companion.bat`](backend/scripts/start-companion.bat) and [`backend/scripts/stop-companion.bat`](backend/scripts/stop-companion.bat) for automated port detection, Ollama probing, process startup, and clean shutdown.
- **Hardened Loopback Security**: Strict loopback-only binding (`127.0.0.1:8765`), exact CORS origin reflection (no wildcard `*`), DNS rebinding protection via `Host` header validation, and graceful `EADDRINUSE` port conflict diagnostics.

#### Demonstration & Documentation Web Platform
- **Next.js 16.4.6 Platform**: Built on Next.js App Router with Turbopack, Tailwind CSS, and Framer Motion.
- **Comprehensive Onboarding**: Interactive walkthrough and dedicated `/install` page with step-by-step instructions for extension installation, deterministic mode, optional Ollama setup, and companion management.
- **Downloadable Extension Archive**: Clean, pre-packaged distribution ZIP ([`website/public/downloads/browsy-extension-dist.zip`](website/public/downloads/browsy-extension-dist.zip)) containing verified production assets.

### Security & Invariants
- **Treats Web Content as Untrusted Data**: Webpage text, headings, and alt text cannot inject prompt directives, modify approved plans, or bypass safety gates.
- **Closed Shadow DOM & IFrame Isolation**: Respects browser sandbox boundaries without attempting undocumented bypasses.
- **Bot Detection & CAPTCHA Integrity**: Strictly respects bot challenges (Amazon Robot Check, Cloudflare Turnstile, Flipkart Shield) by pausing for human resolution rather than attempting unauthorized bypasses.

---

### Verification Summary
- **Extension Automated Test Suite**: 170 / 170 passing (100%)
- **Deterministic Validation Suite**: 15 / 15 passing (100%)
- **Companion Security & Tooling**: 19 / 19 passing (100%)
- **Live Real-Browser Matrix**: Tested on Myntra, Amazon India, Flipkart, Polymer Shop, Wikipedia, Hacker News, Google Search, and Python Docs.
- **Production Builds**: Website (Next.js 16.4.6) and Extension (Vite + TypeScript) passing with 0 errors.
