"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { InteractiveWalkthrough } from "@/components/InteractiveWalkthrough";

const FOOTER_LINKS = [
  { href: "/virtual-try-on", label: "Virtual Try-On" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms-of-service", label: "Terms of Service" },
  { href: "/acceptable-use-policy", label: "Acceptable Use Policy" },
];

export default function Home() {
  const { user, signOut } = useAuth();
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [videoFailed, setVideoFailed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Respect prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) {
      if (heroVideoRef.current) {
        heroVideoRef.current.pause();
      }
      setIsPlaying(false);
    }

    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        heroVideoRef.current?.pause();
        setIsPlaying(false);
      } else {
        heroVideoRef.current?.play().catch(() => {});
        setIsPlaying(true);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const toggleHeroVideo = () => {
    const vid = heroVideoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play().catch(() => {});
      setIsPlaying(true);
    } else {
      vid.pause();
      setIsPlaying(false);
    }
  };

  const handleTryExample = () => {
    const exampleSection = document.getElementById("try-example");
    if (exampleSection) {
      exampleSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div id="top" className="min-h-screen bg-[#FFFFFC] text-[#170404]">
      <a href="#main-hero" className="skip-link">
        Skip to content
      </a>

      {/* ═══ First Viewport: Full-Height Two-Column Split-Screen Stage ═══ */}
      <main
        id="main-hero"
        className="grid min-h-screen grid-cols-1 lg:grid-cols-12"
      >
        {/* ── Left Panel (Warm-White, ~46% width on desktop) ── */}
        <section
          aria-labelledby="browsy-hero-heading"
          className="animate-panel-rise relative flex flex-col justify-between bg-[#FFFFFC] px-6 py-9 sm:px-12 sm:py-12 lg:col-span-6 xl:col-span-5 xl:px-16 xl:py-14"
        >
          {/* Top Row: Browsy Wordmark + Subtle Secondary Auth Link */}
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 text-[#170404] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B84A79] rounded-md"
              aria-label="Browsy"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#170404] text-[#FFFFFC] text-base font-medium tracking-tight">
                B
              </span>
              <span className="text-2xl font-medium tracking-[-0.03em] text-[#170404]">
                Browsy
              </span>
            </Link>

            <div className="flex items-center gap-4 text-sm">
              {user ? (
                <>
                  <Link
                    href="/workspace"
                    className="font-medium text-[#170404] underline decoration-[#170404]/30 underline-offset-4 hover:decoration-[#170404]"
                  >
                    Workspace
                  </Link>
                  <button
                    type="button"
                    onClick={signOut}
                    className="text-[#8C7A7E] hover:text-[#170404] cursor-pointer"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <Link
                  href="/sign-in"
                  className="text-sm font-medium text-[#8C7A7E] transition-colors hover:text-[#170404] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B84A79] rounded"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>

          {/* Center Editorial Block */}
          <div className="my-auto max-w-[540px] py-10 lg:py-8">
            <h1
              id="browsy-hero-heading"
              className="text-[clamp(44px,5.4vw,68px)] font-medium tracking-[-0.04em] leading-[0.99] text-[#170404]"
            >
              The web,
              <br />
              your way.
            </h1>

            <p className="mt-6 max-w-[440px] text-lg sm:text-[20px] font-normal leading-[1.38] tracking-[-0.025em] text-[#170404]/90">
              Tell Browsy what you want. It understands the page, plans
              supported actions, and helps you navigate the web—with you in
              control.
            </p>

            {/* Two Primary CTAs: "Add to Browser" and "Try Example" */}
            <div className="mt-9 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Link
                href="/install"
                className="inline-flex h-[58px] w-full sm:w-[210px] items-center justify-center rounded-[8px] border-[1.5px] border-[#170404] bg-[#170404] px-6 text-[16px] font-medium tracking-[-0.02em] text-[#FFFFFC] transition-all hover:bg-black active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B84A79] focus-visible:ring-offset-2"
              >
                Add to Browser
              </Link>

              <button
                type="button"
                onClick={handleTryExample}
                className="inline-flex h-[58px] w-full sm:w-[210px] items-center justify-center gap-2 rounded-[8px] border-[1.5px] border-[#170404] bg-[#FFFFFC] px-6 text-[16px] font-medium tracking-[-0.02em] text-[#170404] transition-all hover:bg-[#F7F2F4] active:translate-y-px cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B84A79] focus-visible:ring-offset-2"
              >
                <span>Try Example</span>
              </button>
            </div>

            {/* Subtle Supporting Line Beneath Buttons */}
            <p className="mt-5 text-[14px] tracking-[-0.01em] text-[#8C7A7E]">
              Your browser assistant. Your approval. Your control.
            </p>
          </div>

          {/* Bottom-Positioned Footer Links (Desktop Left Panel) */}
          <nav
            aria-label="Legal and informational links"
            className="hidden lg:flex flex-wrap items-center gap-x-2 gap-y-1.5 pt-4 text-[13px] text-[#8C7A7E]"
          >
            {FOOTER_LINKS.map((item, index) => (
              <span key={item.href} className="inline-flex items-center gap-2">
                {index > 0 && (
                  <span aria-hidden="true" className="text-[#170404]/25">
                    ·
                  </span>
                )}
                <Link
                  href={item.href}
                  className="transition-colors hover:text-[#170404] hover:underline hover:underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B84A79] rounded"
                >
                  {item.label}
                </Link>
              </span>
            ))}
          </nav>
        </section>

        {/* ── Right Panel (Atmospheric Mesh Gradient + Cinematic Browser-Framed Video) ── */}
        <section
          aria-label="Browsy product demonstration"
          style={{
            backgroundColor: "#eadff2",
            backgroundImage: [
              "radial-gradient(circle at 16% 18%, rgba(238, 226, 250, 0.95) 0%, transparent 52%)",
              "radial-gradient(circle at 84% 15%, rgba(232, 134, 148, 0.82) 0%, transparent 50%)",
              "radial-gradient(circle at 52% 48%, rgba(214, 108, 152, 0.76) 0%, transparent 58%)",
              "radial-gradient(circle at 20% 82%, rgba(238, 152, 136, 0.78) 0%, transparent 54%)",
              "radial-gradient(circle at 86% 84%, rgba(92, 34, 68, 0.85) 0%, transparent 58%)",
              "radial-gradient(circle at 50% 92%, rgba(78, 70, 130, 0.6) 0%, transparent 52%)",
              "linear-gradient(145deg, #f3ecf9 0%, #f1bfd3 38%, #c9698e 74%, #5e2240 100%)",
            ].join(", "),
          }}
          className="browsy-atmosphere relative flex flex-col items-center justify-center overflow-hidden px-3 py-6 sm:px-6 sm:py-8 lg:col-span-7 xl:col-span-7 lg:px-8 xl:px-12"
        >
          <div className="w-full max-w-[980px] xl:max-w-[1100px] 2xl:max-w-[1240px] flex flex-col items-start gap-4 animate-panel-rise">
            {/* Atmospheric Pill */}
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/65 bg-white/70 px-4 py-2 text-[13px] font-medium tracking-[-0.01em] text-[#5A2540] shadow-[0_6px_20px_rgba(120,40,70,0.14)] backdrop-blur-md">
              <svg
                className="h-3.5 w-3.5 shrink-0 text-[#B84A79]"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 2l1.6 6.4a2 2 0 0 0 1.5 1.5L22 12l-6.4 1.6a2 2 0 0 0-1.5 1.5L12 22l-1.6-6.4a2 2 0 0 0-1.5-1.5L2 12l6.4-1.6a2 2 0 0 0 1.5-1.5z" />
              </svg>
              <span className="truncate">
                Multi-Website Walkthrough · ThreadCraft · HirePulse · ClearBrief · StayVista · Finale
              </span>
            </div>

            {/* Large Browser-Framed Product Demo Video */}
            <div className="browsy-browser-frame w-full overflow-hidden rounded-[18px] bg-white shadow-[0_34px_90px_-20px_rgba(74,18,40,0.48),0_12px_32px_rgba(30,0,15,0.18),0_0_0_1px_rgba(255,255,255,0.4)]">
              {/* Refined Browser Chrome */}
              <div className="flex h-[42px] items-center justify-between gap-2.5 border-b border-black/[0.06] bg-[#F3EEF4] px-4">
                <div className="flex shrink-0 items-center gap-2">
                  <span className="h-[11px] w-[11px] rounded-full bg-[#FF5F57]" />
                  <span className="h-[11px] w-[11px] rounded-full bg-[#FEBC2E]" />
                  <span className="h-[11px] w-[11px] rounded-full bg-[#28C840]" />
                </div>

                <div className="flex h-[26px] min-w-0 flex-1 items-center rounded-[7px] bg-black/[0.05] px-3 text-[12px] font-medium tracking-[0.01em] text-[#5A2540]">
                  <span className="truncate">
                    Browsy Assistant · Multi-Website Cinematic Demonstration (Controlled Environments)
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={toggleHeroVideo}
                    aria-label={
                      isPlaying ? "Pause demo video" : "Play demo video"
                    }
                    className="rounded-md px-2.5 py-1 text-[12px] font-medium text-[#5A2540] hover:bg-black/[0.06] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B84A79]"
                  >
                    {isPlaying ? "Pause" : "Play"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalOpen(true)}
                    aria-label="Expand demo video"
                    className="rounded-md px-2.5 py-1 text-[12px] font-medium text-[#5A2540] hover:bg-black/[0.06] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B84A79]"
                  >
                    Expand ⤢
                  </button>
                </div>
              </div>

              {/* Real HTML Video Element with Poster & Graceful Fallback */}
              <div className="relative bg-[#170404] leading-none">
                {!videoFailed ? (
                  <video
                    ref={heroVideoRef}
                    src="/demo/browsy-demo.mp4"
                    poster="/demo/browsy-poster.jpg"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    onError={() => setVideoFailed(true)}
                    aria-label="Browsy multi-website product walkthrough demonstrating Online Clothing Shopping on threadcraft.store, Job Search on hirepulse.jobs, Research Summarisation on cloudnotes.research, and Travel Planning on stayvista.travel."
                    className="block w-full h-auto aspect-[16/10] object-cover"
                  >
                    Your browser does not support embedded HTML5 video.
                  </video>
                ) : (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/demo/browsy-poster.jpg"
                      alt="Browsy assistant panel open alongside a webpage showing verified results across Shopping, Jobs, Research, and Travel"
                      className="block w-full h-auto aspect-[16/10] object-cover"
                    />
                    <div className="bg-[#170404] p-4 text-xs leading-relaxed text-[#FFFFFC]">
                      Controlled multi-website walkthrough preview: Browsy
                      assists across Online Shopping, Job Search, Research
                      Summarisation, and Travel Planning with human approval at
                      every step.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ═══ Guided Multi-Website Interactive Example Section (#try-example) ═══ */}
      <section
        id="try-example"
        aria-label="Interactive multi-website Browsy guided example"
        className="border-t border-[#170404]/10 bg-[#FFFFFC] px-4 py-16 sm:px-8 sm:py-24"
      >
        <div className="mx-auto max-w-[1280px] 2xl:max-w-[1400px]">
          <InteractiveWalkthrough initialMode="interactive" />
        </div>
      </section>

      {/* Mobile & Tablet Footer Links (Placed cleanly after primary content and demo) */}
      <footer className="border-t border-[#170404]/10 bg-[#FFFFFC] px-6 py-8 lg:hidden">
        <nav
          aria-label="Legal and informational links"
          className="mx-auto flex max-w-md flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center text-[13px] text-[#8C7A7E]"
        >
          {FOOTER_LINKS.map((item, index) => (
            <span key={item.href} className="inline-flex items-center gap-3">
              {index > 0 && (
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
      </footer>

      {/* Enlarged Demo Modal (When clicking Expand ⤢) */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Browsy multi-website product demonstration video"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#170404]/75 p-4 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-white/20 bg-[#FFFFFC] p-4 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#170404]/10">
              <div>
                <h3 className="text-base font-medium text-[#170404]">
                  Browsy Multi-Website Walkthrough (Controlled Demo)
                </h3>
                <p className="text-xs text-[#8C7A7E]">
                  1. Clothing Shopping · 2. Job Search · 3. Research
                  Summarisation · 4. Travel Planning
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close video modal"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#170404]/20 text-sm text-[#170404] hover:bg-[#170404]/5 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 overflow-hidden rounded-xl border border-[#170404]/15 bg-[#170404]">
              <video
                src="/demo/browsy-demo.mp4"
                poster="/demo/browsy-poster.jpg"
                controls
                autoPlay
                loop
                playsInline
                className="block w-full h-auto aspect-[16/10]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
