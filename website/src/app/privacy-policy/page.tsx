import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Browsy",
  description:
    "Privacy Policy for the Browsy website and browser extension, detailing data handling, page inspection, and local storage practices.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#FFFFFC] text-[#170404] flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-[#170404]/10 bg-[#FFFFFC]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6 sm:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 text-xl font-semibold tracking-tight text-[#170404] hover:opacity-80 transition-opacity"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#170404] text-[#FFFFFC] text-sm font-medium">
              B
            </span>
            <span>Browsy</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#170404]/20 px-3.5 py-2 text-xs sm:text-sm font-medium text-[#170404] transition-colors hover:bg-[#170404]/5"
          >
            ← Back to Browsy
          </Link>
        </div>
      </header>

      {/* Document Body */}
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-14 sm:px-8 sm:py-20">
        <div className="border-b border-[#170404]/10 pb-8">
          <p className="text-xs font-medium uppercase tracking-widest text-[#9E506E]">
            Legal &amp; Data Practices
          </p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-medium tracking-tight text-[#170404] leading-[1.05]">
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm text-[#A49595]">
            Last updated: October 13, 2026
          </p>
        </div>

        {/* Owner Completion Notice */}
        <div className="mt-8 rounded-xl border border-[#C65A92]/30 bg-[#FDF4F7] p-5 text-sm leading-relaxed text-[#170404]/85">
          <strong className="font-semibold text-[#170404]">
            Note on Project Status &amp; Owner Review:
          </strong>{" "}
          This Privacy Policy describes the actual technical behavior of the
          Browsy web application and browser extension in its current repository
          implementation. Sections marked{" "}
          <span className="rounded bg-[#170404]/10 px-1.5 py-0.5 font-mono text-xs">
            [Owner Completion Required]
          </span>{" "}
          identify organizational, legal entity, retention, and contact details
          that must be completed by the project owner before public distribution.
        </div>

        <div className="mt-10 space-y-10 text-base leading-relaxed text-[#170404]/85">
          {/* 1. Overview */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium text-[#170404]">
              1. Overview
            </h2>
            <p className="text-sm sm:text-base text-[#170404]/80">
              Browsy is a natural-language browser assistant consisting of a web
              interface and a Chromium Manifest V3 browser extension. This page
              explains what information Browsy accesses, processes, and stores
              when you use the website or the browser extension.
            </p>
          </section>

          {/* 2. Account Creation and Sign-In */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium text-[#170404]">
              2. Information Collected During Account Creation &amp; Sign-In
            </h2>
            <p className="text-sm sm:text-base text-[#170404]/80">
              When you use the Sign In or Get Started forms on the Browsy
              website:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm sm:text-base text-[#170404]/80">
              <li>
                The form collects the name and email address you enter, along
                with a password field used for client-side input validation.
              </li>
              <li>
                In the current development configuration, no backend
                authentication server or remote database is connected (the{" "}
                <code className="rounded bg-[#170404]/5 px-1.5 py-0.5 text-xs">
                  backend/
                </code>{" "}
                service directory is reserved and not yet deployed).
              </li>
              <li>
                Your workspace session profile (generated user ID, display name,
                email address, and timestamp) is stored locally in your
                browser&apos;s{" "}
                <code className="rounded bg-[#170404]/5 px-1.5 py-0.5 text-xs">
                  localStorage
                </code>{" "}
                under the key{" "}
                <code className="rounded bg-[#170404]/5 px-1.5 py-0.5 text-xs">
                  browsy_workspace_user_v1
                </code>
                .
              </li>
            </ul>
          </section>

          {/* 3. Website Content the Extension Can Inspect */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium text-[#170404]">
              3. Website Content the Browser Extension Can Inspect
            </h2>
            <p className="text-sm sm:text-base text-[#170404]/80">
              The Browsy browser extension declares{" "}
              <code className="rounded bg-[#170404]/5 px-1.5 py-0.5 text-xs">
                activeTab
              </code>
              ,{" "}
              <code className="rounded bg-[#170404]/5 px-1.5 py-0.5 text-xs">
                storage
              </code>
              , and content script host permissions for{" "}
              <code className="rounded bg-[#170404]/5 px-1.5 py-0.5 text-xs">
                http://*/*
              </code>{" "}
              and{" "}
              <code className="rounded bg-[#170404]/5 px-1.5 py-0.5 text-xs">
                https://*/*
              </code>
              . When loaded on a webpage, the extension&apos;s page-intelligence
              module inspects:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm sm:text-base text-[#170404]/80">
              <li>
                Page URL, hostname, and document title.
              </li>
              <li>
                Visible interactive elements such as buttons, links, search
                inputs, dropdown selects, checkboxes, and form labels.
              </li>
              <li>
                Repeated content structures such as product cards, job listings,
                headings, visible prices, and ratings.
              </li>
            </ul>
            <p className="text-sm sm:text-base text-[#170404]/80">
              <strong>Sensitive Field Safeguards:</strong> Browsy&apos;s
              privacy-filter and action-guard modules are programmed to exclude
              password inputs (
              <code className="rounded bg-[#170404]/5 px-1.5 py-0.5 text-xs">
                type=&quot;password&quot;
              </code>
              ), credit card fields, CVV codes, and one-time password (OTP)
              fields from value extraction and automated action execution.
            </p>
          </section>

          {/* 4. External AI Services & Network Transmission */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium text-[#170404]">
              4. External AI Services &amp; Data Transmission
            </h2>
            <p className="text-sm sm:text-base text-[#170404]/80">
              In the current repository build, Browsy&apos;s intent engine runs
              using a local deterministic intent parser inside the browser
              extension without transmitting page content or user prompts to an
              external AI API. The codebase includes a provider abstraction for
              future AI/LLM backend integration; if an external AI provider is
              enabled in a future deployment, this policy must be updated to
              disclose the provider, transmitted payload, and data-handling
              terms{" "}
              <span className="rounded bg-[#170404]/10 px-1.5 py-0.5 font-mono text-xs">
                [Owner Completion Required]
              </span>
              .
            </p>
          </section>

          {/* 5. Local Storage, Analytics, and Third-Party Services */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium text-[#170404]">
              5. Storage, Analytics &amp; Third-Party Services
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-sm sm:text-base text-[#170404]/80">
              <li>
                <strong>Local Storage:</strong> Session state on the website is
                stored in browser{" "}
                <code className="rounded bg-[#170404]/5 px-1.5 py-0.5 text-xs">
                  localStorage
                </code>
                . Extension state uses in-tab memory and{" "}
                <code className="rounded bg-[#170404]/5 px-1.5 py-0.5 text-xs">
                  chrome.storage
                </code>{" "}
                where applicable.
              </li>
              <li>
                <strong>Analytics &amp; Trackers:</strong> No third-party
                analytics scripts, ad trackers, or telemetry SDKs are configured
                in the current website or extension codebase.
              </li>
            </ul>
          </section>

          {/* 6. Managing or Deleting Your Information */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium text-[#170404]">
              6. Managing or Deleting Your Information
            </h2>
            <p className="text-sm sm:text-base text-[#170404]/80">
              You can clear your local Browsy workspace session at any time by
              clicking <strong>Sign Out</strong> in the Workspace or header, or
              by clearing your browser&apos;s site data. You can stop all
              extension page inspection by disabling or uninstalling the Browsy
              extension in your browser&apos;s extension manager.
            </p>
          </section>

          {/* 7. Contact & Controller Details */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium text-[#170404]">
              7. Contact &amp; Data Controller Information
            </h2>
            <p className="text-sm sm:text-base text-[#170404]/80">
              <span className="rounded bg-[#170404]/10 px-1.5 py-0.5 font-mono text-xs">
                [Owner Completion Required]
              </span>{" "}
              Before publishing Browsy commercially or to the Chrome Web Store,
              the project owner must insert the legal entity name, data
              controller contact email, physical address (if required by
              jurisdiction), and formal data retention schedule here.
            </p>
          </section>
        </div>

        {/* Bottom Navigation */}
        <div className="mt-12 flex flex-wrap items-center gap-4 border-t border-[#170404]/10 pt-8">
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-[#170404] px-6 text-sm font-medium text-[#FFFFFC] transition-colors hover:bg-black"
          >
            Return to Homepage
          </Link>
          <Link
            href="/terms-of-service"
            className="inline-flex h-12 items-center justify-center rounded-lg border border-[#170404]/25 px-6 text-sm font-medium text-[#170404] transition-colors hover:bg-[#170404]/5"
          >
            View Terms of Service
          </Link>
          <Link
            href="/acceptable-use-policy"
            className="inline-flex h-12 items-center justify-center rounded-lg border border-[#170404]/25 px-6 text-sm font-medium text-[#170404] transition-colors hover:bg-[#170404]/5"
          >
            View Acceptable Use Policy
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#170404]/10 py-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-6 text-xs text-[#A49595] sm:px-8">
          <span>Browsy — The web, your way.</span>
          <nav aria-label="Footer" className="flex flex-wrap gap-6">
            <Link href="/virtual-try-on" className="hover:text-[#170404]">
              Virtual Try-On
            </Link>
            <Link href="/privacy-policy" className="text-[#170404] font-medium">
              Privacy Policy
            </Link>
            <Link href="/terms-of-service" className="hover:text-[#170404]">
              Terms of Service
            </Link>
            <Link
              href="/acceptable-use-policy"
              className="hover:text-[#170404]"
            >
              Acceptable Use Policy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
