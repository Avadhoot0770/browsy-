import type { Metadata } from "next";
import Link from "next/link";
import { InteractiveWalkthrough } from "@/components/InteractiveWalkthrough";

export const metadata: Metadata = {
  title: "Try Example — Browsy Multi-Website Guided Product Walkthrough",
  description:
    "Experience Browsy without installing the extension or signing in. Step through our guided 4-website walkthrough covering online clothing shopping, job search, research & information gathering, and travel planning.",
};

const FOOTER_LINKS = [
  { href: "/virtual-try-on", label: "Virtual Try-On" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms-of-service", label: "Terms of Service" },
  { href: "/acceptable-use-policy", label: "Acceptable Use Policy" },
];

export default function TryExamplePage() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#FFFFFC] text-[#170404]">
      {/* Top Header */}
      <header className="border-b border-[#170404]/10 bg-[#FFFFFC]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 sm:px-10">
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
              href="/install"
              className="inline-flex h-10 items-center justify-center rounded-[8px] border-[1.5px] border-[#170404] bg-[#170404] px-4 text-sm font-medium text-[#FFFFFC] transition-colors hover:bg-black"
            >
              Add to Browser
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
      <main className="mx-auto w-full max-w-[1280px] 2xl:max-w-[1400px] flex-1 px-4 py-10 sm:px-8 sm:py-14">
        <InteractiveWalkthrough initialMode="interactive" />
      </main>

      {/* Footer */}
      <footer className="border-t border-[#170404]/10 bg-[#FFFFFC] px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-[#8C7A7E]">
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
