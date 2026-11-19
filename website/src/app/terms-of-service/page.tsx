import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Browsy",
  description:
    "Terms of Service governing access to and use of the Browsy website and supervised browser assistant extension.",
};

export default function TermsOfServicePage() {
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
            Conditions of Use
          </p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-medium tracking-tight text-[#170404] leading-[1.05]">
            Terms of Service
          </h1>
          <p className="mt-4 text-sm text-[#A49595]">
            Last updated: October 13, 2026
          </p>
        </div>

        {/* Owner / Legal Review Notice */}
        <div className="mt-8 rounded-xl border border-[#C65A92]/30 bg-[#FDF4F7] p-5 text-sm leading-relaxed text-[#170404]/85">
          <strong className="font-semibold text-[#170404]">
            Important Notice for Project Owner &amp; Legal Review:
          </strong>{" "}
          These Terms of Service describe the operational terms for the Browsy
          software project and are not legal advice. Items marked{" "}
          <span className="rounded bg-[#170404]/10 px-1.5 py-0.5 font-mono text-xs">
            [Owner / Legal Review Required]
          </span>{" "}
          must be completed and reviewed by qualified counsel before commercial
          release.
        </div>

        <div className="mt-10 space-y-10 text-base leading-relaxed text-[#170404]/85">
          {/* 1. Acceptance */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium text-[#170404]">
              1. Acceptance of Terms
            </h2>
            <p className="text-sm sm:text-base text-[#170404]/80">
              By accessing the Browsy website, workspace, or browser extension,
              you agree to follow these Terms of Service, our{" "}
              <Link
                href="/privacy-policy"
                className="underline decoration-[#9E506E] underline-offset-4 hover:text-[#9E506E]"
              >
                Privacy Policy
              </Link>
              , and our{" "}
              <Link
                href="/acceptable-use-policy"
                className="underline decoration-[#9E506E] underline-offset-4 hover:text-[#9E506E]"
              >
                Acceptable Use Policy
              </Link>
              . If you do not agree to these terms, do not use Browsy.
            </p>
          </section>

          {/* 2. Eligibility and Account Responsibilities */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium text-[#170404]">
              2. Eligibility &amp; Account Responsibilities
            </h2>
            <p className="text-sm sm:text-base text-[#170404]/80">
              You are responsible for maintaining the security of your device,
              browser profile, and any workspace sessions created on your
              machine. Minimum age and jurisdictional eligibility requirements{" "}
              <span className="rounded bg-[#170404]/10 px-1.5 py-0.5 font-mono text-xs">
                [Owner / Legal Review Required]
              </span>
              .
            </p>
          </section>

          {/* 3. Permitted Access & Supervised Browser Actions */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium text-[#170404]">
              3. User Responsibility for Reviewing &amp; Approving Actions
            </h2>
            <p className="text-sm sm:text-base text-[#170404]/80">
              Browsy is designed as a <strong>supervised</strong> browser
              assistant. Before performing supported browser interactions (such
              as clicking buttons, typing search terms, selecting filters, or
              navigating links), Browsy presents a proposed action plan.
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm sm:text-base text-[#170404]/80">
              <li>
                You are solely responsible for reviewing proposed actions before
                clicking approve.
              </li>
              <li>
                Any action executed in your browser session after your approval
                is performed at your direction and on your behalf.
              </li>
              <li>
                You can cancel or stop execution at any time using the stop
                controls in the Browsy interface.
              </li>
            </ul>
          </section>

          {/* 4. Limitations of Automated Browser Interactions & Accuracy */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium text-[#170404]">
              4. Limitations of Browser Assistance &amp; Accuracy
            </h2>
            <p className="text-sm sm:text-base text-[#170404]/80">
              Websites vary widely in structure and behavior, and they may
              change without notice. As a result:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm sm:text-base text-[#170404]/80">
              <li>
                Browsy may not recognize all controls, filters, prices, or
                product attributes on a given webpage.
              </li>
              <li>
                Results may be partial or incomplete if a website lacks a
                matching filter or updates its page layout dynamically.
              </li>
              <li>
                You should always verify product details, prices, sizes, and
                terms directly on the merchant or target website before making
                any purchase or commitment.
              </li>
            </ul>
          </section>

          {/* 5. Third-Party Websites */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium text-[#170404]">
              5. Third-Party Websites &amp; Terms
            </h2>
            <p className="text-sm sm:text-base text-[#170404]/80">
              Browsy is not affiliated with or endorsed by the third-party
              websites you visit in your browser. Your use of any third-party
              website remains subject to that website&apos;s own terms of
              service, privacy policy, and rules.
            </p>
          </section>

          {/* 6. Availability, Changes & Termination */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium text-[#170404]">
              6. Availability, Service Changes &amp; Termination
            </h2>
            <p className="text-sm sm:text-base text-[#170404]/80">
              Browsy is currently provided as a development-stage software
              project. Features, supported actions, and routes may be modified,
              suspended, or discontinued at any time without prior notice.
            </p>
          </section>

          {/* 7. Intellectual Property */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium text-[#170404]">
              7. Intellectual Property &amp; Licensing
            </h2>
            <p className="text-sm sm:text-base text-[#170404]/80">
              Ownership and software licensing terms for the Browsy codebase,
              branding, and assets{" "}
              <span className="rounded bg-[#170404]/10 px-1.5 py-0.5 font-mono text-xs">
                [Owner / Legal Review Required]
              </span>
              .
            </p>
          </section>

          {/* 8. Disclaimers & Limitation of Liability */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium text-[#170404]">
              8. Disclaimers &amp; Limitation of Liability
            </h2>
            <p className="text-sm sm:text-base text-[#170404]/80">
              To the maximum extent permitted by applicable law, Browsy is
              provided &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo;
              without warranties of any kind, whether express or implied. Formal
              limitation of liability, indemnification, governing law, and
              dispute resolution clauses{" "}
              <span className="rounded bg-[#170404]/10 px-1.5 py-0.5 font-mono text-xs">
                [Owner / Legal Review Required]
              </span>
              .
            </p>
          </section>

          {/* 9. Contact */}
          <section className="space-y-3">
            <h2 className="text-xl font-medium text-[#170404]">
              9. Contact Information
            </h2>
            <p className="text-sm sm:text-base text-[#170404]/80">
              <span className="rounded bg-[#170404]/10 px-1.5 py-0.5 font-mono text-xs">
                [Owner / Legal Review Required]
              </span>{" "}
              Insert the verified project owner contact channel and legal notice
              address prior to public launch.
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
            href="/privacy-policy"
            className="inline-flex h-12 items-center justify-center rounded-lg border border-[#170404]/25 px-6 text-sm font-medium text-[#170404] transition-colors hover:bg-[#170404]/5"
          >
            View Privacy Policy
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
            <Link href="/privacy-policy" className="hover:text-[#170404]">
              Privacy Policy
            </Link>
            <Link
              href="/terms-of-service"
              className="text-[#170404] font-medium"
            >
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
