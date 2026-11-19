import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Virtual Try-On — Browsy",
  description:
    "Learn about virtual try-on technology and how Browsy's natural-language browser assistance differs from visual garment fitting.",
};

export default function VirtualTryOnPage() {
  return (
    <div className="min-h-screen bg-[#FFFFFC] text-[#170404] flex flex-col justify-between">
      {/* Top Navigation */}
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
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-widest text-[#9E506E]">
            Product Clarification
          </p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-medium tracking-tight text-[#170404] leading-[1.05]">
            Virtual Try-On
          </h1>
          <p className="mt-6 text-lg sm:text-xl leading-relaxed text-[#170404]/90">
            Virtual try-on technology helps shoppers preview how clothing or
            other products might look before making a purchase.
          </p>
        </div>

        {/* Core Clarification Box */}
        <div className="mt-10 rounded-2xl border border-[#C65A92]/30 bg-gradient-to-br from-[#FDF4F7] to-[#F7F1FA] p-6 sm:p-8">
          <h2 className="text-lg font-medium text-[#170404]">
            Does Browsy include virtual try-on?
          </h2>
          <p className="mt-3 text-base leading-relaxed text-[#170404]/85">
            Browsy helps you interact with websites using natural-language
            instructions and supervised browser actions.{" "}
            <strong className="font-semibold text-[#170404]">
              Virtual clothing try-on is a separate capability and is not
              currently part of Browsy.
            </strong>
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[#170404]/70">
            Browsy does not access your camera, generate garment overlays on
            photos or live video, or perform AI body visualization.
          </p>
        </div>

        {/* Clear Comparison */}
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-[#170404]/12 bg-white p-6">
            <span className="inline-block rounded-full bg-[#170404] px-3 py-1 text-xs font-medium text-[#FFFFFC]">
              Included in Browsy
            </span>
            <h3 className="mt-4 text-lg font-medium text-[#170404]">
              Shopping &amp; Web Navigation Assistance
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#170404]/75">
              When you browse an online store, Browsy helps you find items that
              match your criteria without clicking through dozens of menus:
            </p>
            <ul className="mt-4 space-y-2.5 text-sm text-[#170404]/80">
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 text-[#9E506E]">✓</span>
                <span>
                  Understand natural-language shopping requests such as{" "}
                  <em>&ldquo;Find a red checked shirt in XL under ₹1,000.&rdquo;</em>
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 text-[#9E506E]">✓</span>
                <span>
                  Inspect search boxes, size filters, and price controls on the
                  current page.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 text-[#9E506E]">✓</span>
                <span>
                  Propose a step-by-step action plan and wait for your explicit
                  approval before running it.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 text-[#9E506E]">✓</span>
                <span>
                  Report what matched on the page and what criteria could not
                  be verified.
                </span>
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-[#170404]/12 bg-[#FAF8F9] p-6">
            <span className="inline-block rounded-full border border-[#170404]/20 px-3 py-1 text-xs font-medium text-[#170404]/70">
              Not Part of Browsy
            </span>
            <h3 className="mt-4 text-lg font-medium text-[#170404]">
              Visual Garment Fitting &amp; Camera Overlay
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#170404]/75">
              Visual try-on tools focus on rendering how an item of clothing
              appears on a person&apos;s body:
            </p>
            <ul className="mt-4 space-y-2.5 text-sm text-[#170404]/70">
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 text-[#A49595]">—</span>
                <span>Live webcam garment overlays or virtual mirrors</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 text-[#A49595]">—</span>
                <span>Photo-based clothing replacement or avatar fitting</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 text-[#A49595]">—</span>
                <span>Body measurement estimation from camera feeds</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Return CTA */}
        <div className="mt-12 flex flex-wrap items-center gap-4 border-t border-[#170404]/10 pt-8">
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-[#170404] px-6 text-sm font-medium text-[#FFFFFC] transition-colors hover:bg-black"
          >
            Return to Browsy Homepage
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex h-12 items-center justify-center rounded-lg border border-[#170404] bg-[#FFFFFC] px-6 text-sm font-medium text-[#170404] transition-colors hover:bg-[#F7F2F4]"
          >
            Get Started with Browsy
          </Link>
        </div>
      </main>

      {/* Bottom Legal Navigation */}
      <footer className="border-t border-[#170404]/10 py-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-6 text-xs text-[#A49595] sm:px-8">
          <span>Browsy — The web, your way.</span>
          <nav aria-label="Footer" className="flex flex-wrap gap-6">
            <Link href="/virtual-try-on" className="text-[#170404] font-medium">
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
