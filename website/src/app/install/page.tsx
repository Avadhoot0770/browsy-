"use client";

import { useState } from "react";
import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/virtual-try-on", label: "Virtual Try-On" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms-of-service", label: "Terms of Service" },
  { href: "/acceptable-use-policy", label: "Acceptable Use Policy" },
];

type BrowserKey = "chrome" | "brave" | "edge";

const BROWSER_GUIDES: Record<
  BrowserKey,
  {
    name: string;
    extensionsUrl: string;
    toggleLocation: string;
    loadButton: string;
  }
> = {
  chrome: {
    name: "Google Chrome",
    extensionsUrl: "chrome://extensions",
    toggleLocation: "Enable the “Developer mode” switch in the top-right corner.",
    loadButton: "Click “Load unpacked” in the top-left action bar.",
  },
  brave: {
    name: "Brave Browser",
    extensionsUrl: "brave://extensions",
    toggleLocation: "Enable the “Developer mode” toggle in the top-right corner.",
    loadButton: "Click “Load unpacked” on the top-left of the extensions page.",
  },
  edge: {
    name: "Microsoft Edge",
    extensionsUrl: "edge://extensions",
    toggleLocation: "Turn on “Developer mode” in the left navigation pane.",
    loadButton: "Click “Load unpacked” in the top command bar.",
  },
};

export default function InstallPage() {
  const [selectedBrowser, setSelectedBrowser] = useState<BrowserKey>("chrome");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const activeGuide = BROWSER_GUIDES[selectedBrowser];

  const copyText = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(key);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      setCopiedField(key);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#FFFFFC] text-[#170404]">
      {/* Top Header */}
      <header className="border-b border-[#170404]/10 bg-[#FFFFFC]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6 sm:px-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 text-[#170404] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B84A79] rounded-md"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#170404] text-[#FFFFFC] text-base font-medium">
              B
            </span>
            <span className="text-xl font-medium tracking-[-0.03em]">
              Browsy
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/#try-example"
              className="inline-flex h-10 items-center justify-center rounded-[8px] border border-[#170404]/20 bg-[#FAF8F9] px-4 text-sm font-medium text-[#170404] transition-colors hover:border-[#170404]"
            >
              Try Example
            </Link>
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-[8px] border border-[#170404]/25 bg-[#FFFFFC] px-4 text-sm font-medium text-[#170404] transition-colors hover:border-[#170404] hover:bg-[#F7F2F4]"
            >
              ← Back to Browsy
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12 sm:px-10 sm:py-16">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#B84A79]/30 bg-[#FBF4F7] px-3.5 py-1 text-xs font-medium text-[#9E506E]">
          <span>Manifest V3 Browser Extension · v0.1.0 · Zero-Cloud AI</span>
        </div>

        <h1 className="mt-4 text-3xl sm:text-5xl font-medium tracking-[-0.035em] leading-[1.08] text-[#170404]">
          Install Browsy & Choose Your Mode
        </h1>

        <p className="mt-4 max-w-2xl text-base sm:text-lg leading-relaxed text-[#170404]/80">
          Browsy is built as a Chromium Manifest V3 extension compatible with{" "}
          <strong>Google Chrome</strong>, <strong>Brave</strong>, and{" "}
          <strong>Microsoft Edge</strong>. It works immediately out of the box with zero external setup, and optionally connects to local Ollama AI models.
        </p>

        {/* Section: Understanding Browsy's Two Modes */}
        <section aria-labelledby="modes-heading" className="mt-10">
          <div className="flex items-center justify-between">
            <h2 id="modes-heading" className="text-2xl font-medium tracking-[-0.025em] text-[#170404]">
              Understanding Browsy&apos;s Two Modes
            </h2>
            <span className="text-xs font-medium text-[#8C7A7E] uppercase tracking-wider">
              Architecture Overview
            </span>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Mode 1: Deterministic Engine */}
            <div className="rounded-2xl border-2 border-[#170404]/15 bg-white p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F5E9] px-3 py-1 text-xs font-semibold text-[#2E7D32]">
                    <span className="h-2 w-2 rounded-full bg-[#2E7D32]" />
                    Mode 1: Default & Zero-Setup
                  </span>
                  <span className="text-xs font-mono text-[#8C7A7E]">&lt; 1 ms latency</span>
                </div>
                <h3 className="mt-4 text-xl font-medium text-[#170404]">
                  Deterministic In-Browser Engine
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#170404]/75">
                  Runs 100% inside your browser content script. No backend services, no Ollama, and no downloads required.
                </p>

                <ul className="mt-4 space-y-2.5 text-xs text-[#170404]/85">
                  <li className="flex items-start gap-2">
                    <span className="text-[#2E7D32] font-bold">✓</span>
                    <span><strong>Instant Natural Language Matching:</strong> Parses products, sizes, colors, patterns, and budgets.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#2E7D32] font-bold">✓</span>
                    <span><strong>Multi-Turn Conversational Context:</strong> Remembers category and filters across sequential refinements.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#2E7D32] font-bold">✓</span>
                    <span><strong>Deterministic Invariants:</strong> Rejects out-of-stock items, enforces budget caps, and prevents accidental clicks.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#2E7D32] font-bold">✓</span>
                    <span><strong>100% Private:</strong> Zero network requests leave your machine.</span>
                  </li>
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t border-[#170404]/10">
                <p className="text-xs font-medium text-[#170404]">
                  Ready immediately upon loading the extension.
                </p>
              </div>
            </div>

            {/* Mode 2: Local AI Companion */}
            <div className="rounded-2xl border-2 border-[#B84A79]/30 bg-[#FBF4F7] p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3E5F5] px-3 py-1 text-xs font-semibold text-[#7B1FA2]">
                    <span className="h-2 w-2 rounded-full bg-[#7B1FA2]" />
                    Mode 2: Optional Superpower
                  </span>
                  <span className="text-xs font-mono text-[#7B1FA2]">Local LLM</span>
                </div>
                <h3 className="mt-4 text-xl font-medium text-[#170404]">
                  Local AI Companion (Ollama)
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#170404]/75">
                  Connects Browsy to local open-source models (like Qwen 2.5 1.5B or 3B) running on your computer via loopback.
                </p>

                <ul className="mt-4 space-y-2.5 text-xs text-[#170404]/85">
                  <li className="flex items-start gap-2">
                    <span className="text-[#7B1FA2] font-bold">✦</span>
                    <span><strong>Complex Semantic Reasoning:</strong> Understands vague, expressive, or conversational shopping requests.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#7B1FA2] font-bold">✦</span>
                    <span><strong>Unfamiliar Filter Translation:</strong> Maps uncommon retailer labels (e.g. &ldquo;crimson&rdquo; or &ldquo;rust&rdquo; to red).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#7B1FA2] font-bold">✦</span>
                    <span><strong>Intelligent Error Recovery:</strong> Proposes alternate navigation plans if a site modifies its layout.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#7B1FA2] font-bold">✦</span>
                    <span><strong>Strict Privacy:</strong> Runs entirely on your CPU/GPU. No cloud APIs, no subscriptions, no tracking.</span>
                  </li>
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t border-[#B84A79]/20">
                <p className="text-xs font-medium text-[#9E506E]">
                  Requires Ollama &amp; Companion Service (setup guide below).
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Download & Install Unpacked Extension */}
        <section aria-labelledby="extension-install-heading" className="mt-12">
          <div className="rounded-2xl border border-[#B84A79]/30 bg-[#FBF4F7] p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2
                  id="extension-install-heading"
                  className="text-lg font-medium tracking-[-0.02em] text-[#170404]"
                >
                  Step 1: Download &amp; Load the Browser Extension
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[#170404]/85">
                  Browsy is currently distributed as a pre-built unpacked extension. Download the verified distribution archive or point your browser directly to{" "}
                  <code className="rounded bg-white px-1.5 py-0.5 text-xs font-mono">
                    extension/dist
                  </code>.
                </p>
              </div>
              <a
                href="/downloads/browsy-extension-dist.zip"
                download="browsy-extension-dist.zip"
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-[8px] border-[1.5px] border-[#170404] bg-[#170404] px-5 text-sm font-medium text-[#FFFFFC] transition-colors hover:bg-black"
              >
                Download Extension ZIP
              </a>
            </div>
          </div>

          {/* Browser Selector Tabs */}
          <div className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h3 className="text-lg font-medium tracking-[-0.02em] text-[#170404]">
                Loading into {activeGuide.name}
              </h3>
              <div
                role="tablist"
                aria-label="Select your Chromium browser"
                className="inline-flex rounded-lg border border-[#170404]/15 bg-[#FAF8F9] p-1"
              >
                {(["chrome", "brave", "edge"] as BrowserKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={selectedBrowser === key}
                    onClick={() => setSelectedBrowser(key)}
                    className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      selectedBrowser === key
                        ? "bg-[#170404] text-[#FFFFFC]"
                        : "text-[#170404]/70 hover:text-[#170404]"
                    }`}
                  >
                    {BROWSER_GUIDES[key].name}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Step 1 */}
              <div className="rounded-xl border border-[#170404]/12 bg-[#FAF8F9] p-5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#170404] text-xs font-medium text-[#FFFFFC]">
                    1
                  </span>
                  <span className="text-xs font-medium text-[#8C7A7E]">
                    Unzip Archive
                  </span>
                </div>
                <h4 className="mt-3 text-base font-medium text-[#170404]">
                  Extract the downloaded ZIP
                </h4>
                <p className="mt-1.5 text-sm leading-relaxed text-[#170404]/75">
                  Unzip <code className="rounded bg-white px-1.5 py-0.5 text-xs">browsy-extension-dist.zip</code> to a folder on your computer (or locate <code className="rounded bg-white px-1.5 py-0.5 text-xs">extension/dist</code> if building from source).
                </p>
                <div className="mt-3 flex items-center justify-between rounded-lg border border-[#170404]/12 bg-white px-3 py-2 font-mono text-xs text-[#170404]">
                  <span className="truncate">extension/dist</span>
                  <button
                    type="button"
                    onClick={() => copyText("extension/dist", "dist-path")}
                    className="ml-2 shrink-0 rounded border border-[#170404]/15 px-2 py-0.5 text-[11px] font-sans font-medium text-[#170404] hover:bg-[#FAF8F9] cursor-pointer"
                  >
                    {copiedField === "dist-path" ? "Copied" : "Copy Path"}
                  </button>
                </div>
              </div>

              {/* Step 2 */}
              <div className="rounded-xl border border-[#170404]/12 bg-[#FAF8F9] p-5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#170404] text-xs font-medium text-[#FFFFFC]">
                    2
                  </span>
                  <span className="text-xs font-medium text-[#8C7A7E]">
                    Extensions Manager
                  </span>
                </div>
                <h4 className="mt-3 text-base font-medium text-[#170404]">
                  Navigate to {activeGuide.extensionsUrl}
                </h4>
                <p className="mt-1.5 text-sm leading-relaxed text-[#170404]/75">
                  Paste the address below into a new tab in {activeGuide.name}. {activeGuide.toggleLocation}
                </p>
                <div className="mt-3 flex items-center justify-between rounded-lg border border-[#170404]/12 bg-white px-3 py-2 font-mono text-xs text-[#170404]">
                  <span>{activeGuide.extensionsUrl}</span>
                  <button
                    type="button"
                    onClick={() => copyText(activeGuide.extensionsUrl, "ext-url")}
                    className="ml-2 shrink-0 rounded border border-[#170404]/15 px-2 py-0.5 text-[11px] font-sans font-medium text-[#170404] hover:bg-[#FAF8F9] cursor-pointer"
                  >
                    {copiedField === "ext-url" ? "Copied" : "Copy URL"}
                  </button>
                </div>
              </div>

              {/* Step 3 */}
              <div className="rounded-xl border border-[#170404]/12 bg-[#FAF8F9] p-5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#170404] text-xs font-medium text-[#FFFFFC]">
                    3
                  </span>
                  <span className="text-xs font-medium text-[#8C7A7E]">
                    Load Unpacked
                  </span>
                </div>
                <h4 className="mt-3 text-base font-medium text-[#170404]">
                  Select the extension folder
                </h4>
                <p className="mt-1.5 text-sm leading-relaxed text-[#170404]/75">
                  {activeGuide.loadButton} Select the folder containing <code className="rounded bg-white px-1.5 py-0.5 text-xs">manifest.json</code>.
                </p>
              </div>

              {/* Step 4 */}
              <div className="rounded-xl border border-[#170404]/12 bg-[#FAF8F9] p-5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#170404] text-xs font-medium text-[#FFFFFC]">
                    4
                  </span>
                  <span className="text-xs font-medium text-[#8C7A7E]">
                    Pin &amp; Run
                  </span>
                </div>
                <h4 className="mt-3 text-base font-medium text-[#170404]">
                  Pin Browsy &amp; Visit Any Store
                </h4>
                <p className="mt-1.5 text-sm leading-relaxed text-[#170404]/75">
                  Click the puzzle extensions icon, pin <strong>Browsy</strong>, and navigate to any shopping site (e.g. Myntra, Amazon, or Flipkart). Click <strong>✦ Browsy</strong> to begin!
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Optional Local AI (Ollama) Setup */}
        <section aria-labelledby="ollama-setup-heading" className="mt-14 rounded-2xl border border-[#170404]/15 bg-white p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FBF4F7] px-3 py-1 text-xs font-medium text-[#9E506E]">
                Optional Step
              </span>
              <h2 id="ollama-setup-heading" className="mt-2 text-2xl font-medium tracking-[-0.025em] text-[#170404]">
                Step 2: Enable Local AI with Ollama (Optional)
              </h2>
            </div>
            <span className="text-xs font-mono text-[#8C7A7E]">
              Loopback: 127.0.0.1:8765
            </span>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-[#170404]/80">
            If you want advanced semantic reasoning and error recovery powered by local open-source LLMs, follow these simple steps to run Ollama and the Browsy Companion Service.
          </p>

          <div className="mt-6 space-y-4">
            {/* Ollama Step 1 */}
            <div className="rounded-xl border border-[#170404]/10 bg-[#FAF8F9] p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#170404] text-xs font-medium text-white">
                  A
                </span>
                <h3 className="text-base font-medium text-[#170404]">
                  Install Ollama
                </h3>
              </div>
              <p className="mt-2 text-sm text-[#170404]/75">
                Download and install the free, open-source Ollama desktop application from{" "}
                <a
                  href="https://ollama.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[#B84A79] underline hover:text-[#170404]"
                >
                  ollama.com
                </a>
                . Ollama manages model downloads and runs hardware-accelerated local inference on Windows, macOS, and Linux.
              </p>
            </div>

            {/* Ollama Step 2 */}
            <div className="rounded-xl border border-[#170404]/10 bg-[#FAF8F9] p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#170404] text-xs font-medium text-white">
                  B
                </span>
                <h3 className="text-base font-medium text-[#170404]">
                  Pull the Recommended Model
                </h3>
              </div>
              <p className="mt-2 text-sm text-[#170404]/75">
                Open your terminal (PowerShell, Command Prompt, or Terminal) and download our recommended compact, high-accuracy model:
              </p>
              <div className="mt-3 flex items-center justify-between rounded-lg border border-[#170404]/12 bg-white px-3 py-2 font-mono text-xs text-[#170404]">
                <span className="truncate">ollama pull qwen2.5:1.5b</span>
                <button
                  type="button"
                  onClick={() => copyText("ollama pull qwen2.5:1.5b", "pull-cmd")}
                  className="ml-2 shrink-0 rounded border border-[#170404]/15 px-2 py-0.5 text-[11px] font-sans font-medium text-[#170404] hover:bg-[#FAF8F9] cursor-pointer"
                >
                  {copiedField === "pull-cmd" ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-2 text-xs text-[#170404]/60">
                Tip: On machines with 16 GB or more RAM, you can optionally pull <code className="font-mono text-xs">qwen2.5:3b</code> for even deeper reasoning.
              </p>
            </div>

            {/* Ollama Step 3 */}
            <div className="rounded-xl border border-[#170404]/10 bg-[#FAF8F9] p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#170404] text-xs font-medium text-white">
                  C
                </span>
                <h3 className="text-base font-medium text-[#170404]">
                  Start the Companion Service
                </h3>
              </div>
              <p className="mt-2 text-sm text-[#170404]/75">
                The companion service connects Browsy to your local Ollama daemon on loopback port 8765.
              </p>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-[#170404]/10 bg-white p-3">
                  <p className="text-xs font-semibold text-[#170404]">Windows (1-Click Launcher):</p>
                  <p className="mt-1 text-xs text-[#170404]/75">Double-click the launcher script:</p>
                  <div className="mt-2 flex items-center justify-between rounded bg-[#FAF8F9] px-2 py-1.5 font-mono text-xs">
                    <span className="truncate">backend\scripts\start-companion.bat</span>
                    <button
                      type="button"
                      onClick={() => copyText("backend\\scripts\\start-companion.bat", "bat-start")}
                      className="ml-1 shrink-0 rounded border border-[#170404]/15 px-1.5 py-0.5 text-[10px] font-sans font-medium hover:bg-white cursor-pointer"
                    >
                      {copiedField === "bat-start" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-[#170404]/10 bg-white p-3">
                  <p className="text-xs font-semibold text-[#170404]">Node.js CLI (All Platforms):</p>
                  <p className="mt-1 text-xs text-[#170404]/75">Run via npm in project root:</p>
                  <div className="mt-2 flex items-center justify-between rounded bg-[#FAF8F9] px-2 py-1.5 font-mono text-xs">
                    <span className="truncate">npm run companion</span>
                    <button
                      type="button"
                      onClick={() => copyText("npm run companion", "npm-start")}
                      className="ml-1 shrink-0 rounded border border-[#170404]/15 px-1.5 py-0.5 text-[10px] font-sans font-medium hover:bg-white cursor-pointer"
                    >
                      {copiedField === "npm-start" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Ollama Step 4 */}
            <div className="rounded-xl border border-[#170404]/10 bg-[#FAF8F9] p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#170404] text-xs font-medium text-white">
                  D
                </span>
                <h3 className="text-base font-medium text-[#170404]">
                  Stopping the Companion Service
                </h3>
              </div>
              <p className="mt-2 text-sm text-[#170404]/75">
                Whenever you want to stop the service:
              </p>
              <ul className="mt-2 space-y-1.5 text-xs text-[#170404]/80">
                <li>• Press <kbd className="rounded border bg-white px-1.5 py-0.5 font-mono">Ctrl + C</kbd> in the console launcher window.</li>
                <li>• On Windows, double-click <code className="font-mono bg-white px-1 rounded">backend\scripts\stop-companion.bat</code> to automatically release port 8765.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section: Troubleshooting & Reliability FAQ */}
        <section aria-labelledby="troubleshooting-heading" className="mt-14">
          <div className="flex items-center justify-between">
            <h2 id="troubleshooting-heading" className="text-2xl font-medium tracking-[-0.025em] text-[#170404]">
              Troubleshooting &amp; FAQs
            </h2>
            <span className="text-xs font-medium text-[#8C7A7E] uppercase tracking-wider">
              Reliability Guide
            </span>
          </div>

          <div className="mt-5 space-y-3.5">
            <div className="rounded-xl border border-[#170404]/12 bg-[#FAF8F9] p-5">
              <h3 className="text-base font-medium text-[#170404]">
                What happens if the companion service or Ollama is offline?
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#170404]/75">
                Nothing breaks! Browsy is engineered with an immediate deterministic fallback. If the companion service is not running on port 8765, Browsy automatically handles your requests using the built-in Deterministic Engine in sub-millisecond time. The status badge will honestly show &ldquo;Offline&rdquo;, but your shopping assistant remains 100% functional.
              </p>
            </div>

            <div className="rounded-xl border border-[#170404]/12 bg-[#FAF8F9] p-5">
              <h3 className="text-base font-medium text-[#170404]">
                How do I resolve a port conflict (<code>EADDRINUSE: 8765</code>)?
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#170404]/75">
                If port 8765 is already occupied by a previously running process:
              </p>
              <ul className="mt-2 space-y-1 text-xs text-[#170404]/80">
                <li>• Run <code className="font-mono bg-white px-1 rounded">backend\scripts\stop-companion.bat</code> on Windows to terminate the old instance.</li>
                <li>• Or launch the companion on a custom port by setting an environment variable: <code className="font-mono bg-white px-1 rounded">BROWSY_COMPANION_PORT=8766 npm run companion</code>.</li>
              </ul>
            </div>

            <div className="rounded-xl border border-[#170404]/12 bg-[#FAF8F9] p-5">
              <h3 className="text-base font-medium text-[#170404]">
                Will Windows Defender or Firewall block Browsy?
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#170404]/75">
                No. The Browsy Companion Service binds exclusively to the loopback interface (<code className="font-mono bg-white px-1 rounded">127.0.0.1</code>). It strictly rejects external inbound network traffic, remote hosts, and cross-origin website requests, keeping your system completely secure.
              </p>
            </div>

            <div className="rounded-xl border border-[#170404]/12 bg-[#FAF8F9] p-5">
              <h3 className="text-base font-medium text-[#170404]">
                Does Browsy ever perform actions without my approval?
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#170404]/75">
                Never. Browsy operates under a strict Supervised Approval Model. Every single click, filter toggle, or search action is displayed in an editable action plan that waits for your explicit confirmation before executing. Browsy strictly prohibits touching passwords, payment forms, or financial credentials.
              </p>
            </div>

            <div className="rounded-xl border border-[#170404]/12 bg-[#FAF8F9] p-5">
              <h3 className="text-base font-medium text-[#170404]">
                What is Browsy&apos;s Zero False Claims Invariant?
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#170404]/75">
                Browsy never marks a product verified or an action successful without real DOM evidence. If a product element cannot be located on the page when you click &ldquo;🎯 Show on Page&rdquo;, Browsy alerts you honestly instead of faking a highlight or giving misleading confirmations.
              </p>
            </div>
          </div>
        </section>

        {/* Verified Extension Specification */}
        <section className="mt-14 rounded-2xl border border-[#170404]/12 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-medium tracking-[-0.02em] text-[#170404]">
            Verified Extension Specification (<code>extension/public/manifest.json</code>)
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 text-sm">
            <div className="rounded-xl border border-[#170404]/10 bg-[#FAF8F9] p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-[#8C7A7E]">
                Manifest Version
              </p>
              <p className="mt-1 font-medium text-[#170404]">
                Manifest V3 (v0.1.0)
              </p>
              <p className="mt-1 text-xs text-[#170404]/70">
                Isolated Shadow DOM content script + background service worker.
              </p>
            </div>
            <div className="rounded-xl border border-[#170404]/10 bg-[#FAF8F9] p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-[#8C7A7E]">
                Declared Permissions
              </p>
              <p className="mt-1 font-medium text-[#170404]">
                <code>activeTab</code>, <code>storage</code>
              </p>
              <p className="mt-1 text-xs text-[#170404]/70">
                No browsing history, bookmarks, downloads, or cookie access.
              </p>
            </div>
            <div className="rounded-xl border border-[#170404]/10 bg-[#FAF8F9] p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-[#8C7A7E]">
                Execution Model
              </p>
              <p className="mt-1 font-medium text-[#170404]">
                Supervised Approval
              </p>
              <p className="mt-1 text-xs text-[#170404]/70">
                Every proposed action plan waits for you to click{" "}
                <strong>Run with Browsy</strong>.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 pt-4 border-t border-[#170404]/10">
            <Link
              href="/try-example"
              className="inline-flex h-11 items-center justify-center rounded-[8px] border-[1.5px] border-[#170404] bg-[#170404] px-5 text-sm font-medium text-[#FFFFFC] transition-colors hover:bg-black"
            >
              Try Guided 8-Scene Example Without Installing
            </Link>
            <Link
              href="/workspace"
              className="inline-flex h-11 items-center justify-center rounded-[8px] border-[1.5px] border-[#170404] bg-[#FFFFFC] px-5 text-sm font-medium text-[#170404] transition-colors hover:border-[#170404] hover:bg-[#F7F2F4]"
            >
              Open Web Workspace
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#170404]/10 bg-[#FFFFFC] px-6 py-8">
        <div className="mx-auto flex max-w-4xl flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-[#8C7A7E]">
          <Link href="/" className="font-medium text-[#170404] hover:underline">
            Browsy — The web, your way.
          </Link>
          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5"
          >
            {FOOTER_LINKS.map((item, idx) => (
              <span key={item.href} className="inline-flex items-center gap-2.5">
                {idx > 0 && (
                  <span aria-hidden="true" className="text-[#170404]/25">
                    ·
                  </span>
                )}
                <Link
                  href={item.href}
                  className="transition-colors hover:text-[#170404] hover:underline"
                >
                  {item.label}
                </Link>
              </span>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
