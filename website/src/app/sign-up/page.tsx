"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function SignUpPage() {
  const router = useRouter();
  const { user, signUp } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      router.push("/workspace");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await signUp(name, email, password);
    setSubmitting(false);

    if (res.ok) {
      router.push("/workspace");
    } else {
      setError(
        res.error || "Unable to create your session. Please check your details."
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFC] text-[#170404] flex flex-col justify-between p-6 sm:p-10">
      <div className="mx-auto w-full max-w-5xl">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8C7A7E] hover:text-[#170404]"
        >
          ← Back to Browsy
        </Link>
      </div>

      <main className="my-auto flex items-center justify-center py-8">
        <div className="w-full max-w-md rounded-2xl border border-[#170404]/15 bg-[#FFFFFC] p-8 shadow-xl">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 text-xl font-medium tracking-tight text-[#170404]"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#170404] text-[#FFFFFC] text-sm font-medium">
                B
              </span>
              <span>Browsy</span>
            </Link>
            <h1 className="mt-6 text-3xl font-medium tracking-[-0.03em] text-[#170404]">
              Get started
            </h1>
            <p className="mt-1.5 text-sm text-[#8C7A7E]">
              Set up your workspace to plan and review browser tasks.
            </p>
          </div>

          {/* Honest Local Session Notice */}
          <div className="mt-5 rounded-xl border border-[#C65A92]/30 bg-[#FDF4F7] p-3.5 text-xs text-[#170404]/80 leading-relaxed">
            <strong className="font-semibold text-[#170404]">
              Local Workspace Session:
            </strong>{" "}
            Cloud account services are not yet configured. Your profile is saved
            locally in this browser.
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs font-medium text-rose-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label
                htmlFor="name"
                className="block text-xs font-medium text-[#170404]"
              >
                Your name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Sharma"
                className="mt-1.5 w-full rounded-lg border border-[#170404]/25 bg-[#FFFFFC] px-3.5 py-2.5 text-sm text-[#170404] placeholder-[#8C7A7E] focus:border-[#170404] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-[#170404]"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1.5 w-full rounded-lg border border-[#170404]/25 bg-[#FFFFFC] px-3.5 py-2.5 text-sm text-[#170404] placeholder-[#8C7A7E] focus:border-[#170404] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-[#170404]"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="mt-1.5 w-full rounded-lg border border-[#170404]/25 bg-[#FFFFFC] px-3.5 py-2.5 text-sm text-[#170404] placeholder-[#8C7A7E] focus:border-[#170404] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 h-12 w-full rounded-[8px] border-[1.5px] border-[#170404] bg-[#170404] text-sm font-medium text-[#FFFFFC] transition-colors hover:bg-black disabled:opacity-50 cursor-pointer"
            >
              {submitting
                ? "Opening workspace..."
                : "Create Account & Continue"}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-[#8C7A7E]">
            Already have a session?{" "}
            <Link
              href="/sign-in"
              className="font-medium text-[#170404] underline underline-offset-4"
            >
              Sign In
            </Link>
          </div>
        </div>
      </main>

      <footer className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-[#8C7A7E]">
        <Link href="/virtual-try-on" className="hover:text-[#170404]">
          Virtual Try-On
        </Link>
        <span>·</span>
        <Link href="/privacy-policy" className="hover:text-[#170404]">
          Privacy Policy
        </Link>
        <span>·</span>
        <Link href="/terms-of-service" className="hover:text-[#170404]">
          Terms of Service
        </Link>
        <span>·</span>
        <Link href="/acceptable-use-policy" className="hover:text-[#170404]">
          Acceptable Use Policy
        </Link>
      </footer>
    </div>
  );
}
