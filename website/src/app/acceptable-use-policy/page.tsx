import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Acceptable Use Policy — Browsy",
  description:
    "Acceptable Use Policy for Browsy, outlining responsible use and prohibited activities when using the browser assistant.",
};

export default function AcceptableUsePolicyPage() {
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

      {/* Main Content */}
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-14 sm:px-8 sm:py-20">
        <div className="border-b border-[#170404]/10 pb-8">
          <p className="text-xs font-medium uppercase tracking-widest text-[#9E506E]">
            Responsible Use Guidelines
          </p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-medium tracking-tight text-[#170404] leading-[1.05]">
            Acceptable Use Policy
          </h1>
          <p className="mt-4 text-sm text-[#A49595]">
            Last updated: October 13, 2026
          </p>
        </div>

        <p className="mt-8 text-base sm:text-lg leading-relaxed text-[#170404]/85">
          Browsy is built to help everyday users navigate websites through
          transparent, user-approved browser actions. This Acceptable Use Policy
          explains the rules that apply whenever you use Browsy.
        </p>

        <div className="mt-10 space-y-10 text-base leading-relaxed text-[#170404]/85">
          {/* 1. Respect Website Terms & Access Restrictions */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium text-[#170404]">
              1. Respect Website Terms &amp; Access Restrictions
            </h2>
            <p className="text-sm sm:text-base text-[#170404]/80">
              You must only use Browsy on websites you are authorized to access
              and in ways that comply with each website&apos;s terms of service
              and usage rules.
            </p>
          </section>

          {/* 2. Prohibited Activities */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium text-[#170404]">
              2. Prohibited Uses
            </h2>
            <p className="text-sm sm:text-base text-[#170404]/80">
              You may not use Browsy, or modify its code, to engage in any of
              the following activities:
            </p>
            <ul className="list-disc pl-5 space-y-2.5 text-sm sm:text-base text-[#170404]/80">
              <li>
                <strong>Bypassing Security Controls:</strong> Attempting to
                circumvent authentication prompts, login barriers, paywalls,
                CAPTCHAs, rate limits, or other technical access controls.
              </li>
              <li>
                <strong>Unauthorized Actions:</strong> Performing actions on
                accounts, forms, or web applications without the permission of
                the account holder or website operator.
              </li>
              <li>
                <strong>Fraud, Phishing, or Harm:</strong> Using Browsy for
                deceptive practices, impersonation, financial fraud, harassment,
                or any unlawful activity.
              </li>
              <li>
                <strong>Data Extraction &amp; Privacy Misuse:</strong> Scraping,
                harvesting, or misusing personal, confidential, or proprietary
                information from websites.
              </li>
              <li>
                <strong>Spam &amp; Abusive Automation:</strong> Running
                repetitive, unattended, or high-volume requests that submit
                spam, manipulate rankings, or degrade website performance.
              </li>
              <li>
                <strong>Intellectual Property &amp; Legal Violations:</strong>{" "}
                Infringing copyrights, trademarks, privacy rights, or any
                applicable local, national, or international law.
              </li>
            </ul>
          </section>

          {/* 3. Human Supervision & Technical Safeguards */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium text-[#170404]">
              3. Human Supervision &amp; Technical Safeguards
            </h2>
            <p className="text-sm sm:text-base text-[#170404]/80">
              Browsy implements technical safeguards in its codebase—including a
              proposed-only planning state that requires explicit user approval
              before execution, high-risk action confirmation prompts, and
              selector-level blocking for password, credit card, CVV, and OTP
              inputs.
            </p>
            <p className="text-sm sm:text-base text-[#170404]/80">
              However, technical safeguards cannot automatically detect or
              prevent every form of misuse on arbitrary webpages. Users remain
              personally responsible for reviewing every proposed action plan and
              ensuring that their instructions and approved actions comply with
              this policy.
            </p>
          </section>

          {/* 4. Reporting Misuse or Security Concerns */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium text-[#170404]">
              4. Reporting Misuse or Security Concerns
            </h2>
            <p className="text-sm sm:text-base text-[#170404]/80">
              <span className="rounded bg-[#170404]/10 px-1.5 py-0.5 font-mono text-xs">
                [Owner Completion Required]
              </span>{" "}
              Before public distribution, the project owner must provide a
              verified security and abuse reporting contact email or issue
              tracker URL here.
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
            href="/privacy-policy"
            className="inline-flex h-12 items-center justify-center rounded-lg border border-[#170404]/25 px-6 text-sm font-medium text-[#170404] transition-colors hover:bg-[#170404]/5"
          >
            View Privacy Policy
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
            <Link href="/privacy-policy" className="hover:text-[#170404]">
              Privacy Policy
            </Link>
            <Link href="/terms-of-service" className="hover:text-[#170404]">
              Terms of Service
            </Link>
            <Link
              href="/acceptable-use-policy"
              className="text-[#170404] font-medium"
            >
              Acceptable Use Policy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
