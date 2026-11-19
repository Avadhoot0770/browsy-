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
      // Fallback if clipboard is unavailable
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
          <span>Manifest V3 Browser Extension · v0.1.0</span>
        </div>

        <h1 className="mt-4 text-3xl sm:text-5xl font-medium tracking-[-0.035em] leading-[1.08] text-[#170404]">
          Add Browsy to Your Browser
        </h1>

        <p className="mt-4 max-w-2xl text-base sm:text-lg leading-relaxed text-[#170404]/80">
          Browsy is built as a Chromium Manifest V3 extension compatible with{" "}
          <strong>Google Chrome</strong>, <strong>Brave</strong>, and{" "}
          <strong>Microsoft Edge</strong>.
        </p>

        {/* Honest Distribution Status Callout */}
        <section
          aria-labelledby="distribution-status-heading"
          className="mt-8 rounded-2xl border border-[#B84A79]/30 bg-[#FBF4F7] p-6 sm:p-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2
                id="distribution-status-heading"
                className="text-lg font-medium tracking-[-0.02em] text-[#170404]"
              >
                Current Release Status: Local Unpacked Developer Build
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[#170404]/85">
                Browsy is not yet published on the Chrome Web Store, so it does
                not use a one-click store install link. Instead, you can load
                the verified unpacked extension directly from{" "}
                <code className="rounded bg-white px-1.5 py-0.5 text-xs font-mono">
                  extension/dist
                </code>{" "}
                in under a minute—or explore the 8-scene guided example right in
                your browser without installing anything.
              </p>
            </div>
            <a
              href="/downloads/browsy-extension-dist.zip"
              download="browsy-extension-dist.zip"
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-[8px] border-[1.5px] border-[#170404] bg-[#170404] px-5 text-sm font-medium text-[#FFFFFC] transition-colors hover:bg-black"
            >
              Download Unpacked ZIP
            </a>
          </div>
        </section>

        {/* Browser Selector Tabs */}
        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl font-medium tracking-[-0.02em] text-[#170404]">
              Step-by-Step Installation ({activeGuide.name})
            </h2>
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
                  Build / Locate Bundle
                </span>
              </div>
              <h3 className="mt-3 text-base font-medium text-[#170404]">
                Prepare the unpacked extension directory
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[#170404]/75">
                The pre-built extension is ready in{" "}
                <code className="rounded bg-white px-1.5 py-0.5 text-xs">
                  extension/dist
                </code>{" "}
                (or unzip the downloaded{" "}
                <code className="rounded bg-white px-1.5 py-0.5 text-xs">
                  browsy-extension-dist.zip
                </code>
                ). To rebuild from source at any time:
              </p>
              <div className="mt-3 flex items-center justify-between rounded-lg border border-[#170404]/12 bg-white px-3 py-2 font-mono text-xs text-[#170404]">
                <span className="truncate">cd extension && npm run build</span>
                <button
                  type="button"
                  onClick={() =>
                    copyText("cd extension && npm run build", "build-cmd")
                  }
                  className="ml-2 shrink-0 rounded border border-[#170404]/15 px-2 py-0.5 text-[11px] font-sans font-medium text-[#170404] hover:bg-[#FAF8F9] cursor-pointer"
                >
                  {copiedField === "build-cmd" ? "Copied" : "Copy"}
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
                  Open Extensions Manager
                </span>
              </div>
              <h3 className="mt-3 text-base font-medium text-[#170404]">
                Navigate to {activeGuide.extensionsUrl}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[#170404]/75">
                Paste the address below into a new tab in {activeGuide.name}.{" "}
                {activeGuide.toggleLocation}
              </p>
              <div className="mt-3 flex items-center justify-between rounded-lg border border-[#170404]/12 bg-white px-3 py-2 font-mono text-xs text-[#170404]">
                <span>{activeGuide.extensionsUrl}</span>
                <button
                  type="button"
                  onClick={() =>
                    copyText(activeGuide.extensionsUrl, "ext-url")
                  }
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
                  Load Unpacked Folder
                </span>
              </div>
              <h3 className="mt-3 text-base font-medium text-[#170404]">
                Select the <code className="text-sm">extension/dist</code> folder
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[#170404]/75">
                {activeGuide.loadButton} Choose the{" "}
                <code className="rounded bg-white px-1.5 py-0.5 text-xs">
                  extension/dist
                </code>{" "}
                folder containing{" "}
                <code className="rounded bg-white px-1.5 py-0.5 text-xs">
                  manifest.json
                </code>
                .
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

            {/* Step 4 */}
            <div className="rounded-xl border border-[#170404]/12 bg-[#FAF8F9] p-5">
              <div className="flex items-center justify-between">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#170404] text-xs font-medium text-[#FFFFFC]">
                  4
                </span>
                <span className="text-xs font-medium text-[#8C7A7E]">
                  Pin & Open Assistant
                </span>
              </div>
              <h3 className="mt-3 text-base font-medium text-[#170404]">
                Pin Browsy in your browser toolbar
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[#170404]/75">
                Click the puzzle-piece extensions icon in your toolbar, pin{" "}
                <strong>Browsy</strong>, and open any webpage. Click the{" "}
                <strong>✦ Browsy</strong> launcher or toolbar icon to start.
              </p>
            </div>
          </div>
        </section>

        {/* Verified Extension Manifest Details */}
        <section className="mt-10 rounded-2xl border border-[#170404]/12 bg-white p-6 sm:p-8">
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
              className="inline-flex h-11 items-center justify-center rounded-[8px] border-[1.5px] border-[#170404] bg-[#FFFFFC] px-5 text-sm font-medium text-[#170404] transition-colors hover:bg-[#F7F2F4]"
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
