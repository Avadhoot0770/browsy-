"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface TaskPreset {
  id: string;
  label: string;
  request: string;
  understood: { key: string; val: string }[];
  steps: string[];
}

const PRESETS: TaskPreset[] = [
  {
    id: "shirt",
    label: "Shopping: Red checked shirt",
    request: "Find me a red checked shirt in XL under ₹1,000.",
    understood: [
      { key: "Item", val: "Shirt" },
      { key: "Color", val: "Red" },
      { key: "Style", val: "Checked" },
      { key: "Size", val: "XL" },
      { key: "Budget", val: "Under ₹1,000" },
    ],
    steps: [
      "Search the current store for red checked shirts",
      "Select size XL in the filter options",
      "Set the maximum price filter to ₹1,000",
      "Check the resulting items and highlight matches",
    ],
  },
  {
    id: "headphones",
    label: "Shopping: Wireless headphones",
    request: "Find wireless headphones under ₹3,000 with 4+ star ratings.",
    understood: [
      { key: "Item", val: "Wireless Headphones" },
      { key: "Budget", val: "Under ₹3,000" },
      { key: "Rating", val: "4+ Stars" },
    ],
    steps: [
      "Search for wireless headphones",
      "Apply customer rating filter: 4 stars and above",
      "Apply price filter: under ₹3,000",
      "Highlight matching headphones on the page",
    ],
  },
  {
    id: "hotel",
    label: "Travel: Hotel in Jaipur",
    request: "Find hotels in Jaipur with free breakfast and free cancellation.",
    understood: [
      { key: "Destination", val: "Jaipur" },
      { key: "Amenity 1", val: "Free Breakfast" },
      { key: "Amenity 2", val: "Free Cancellation" },
    ],
    steps: [
      "Search stays in Jaipur",
      "Check the 'Free breakfast included' filter",
      "Check the 'Free cancellation' filter",
      "Highlight qualifying stays on the results page",
    ],
  },
];

export default function WorkspacePage() {
  const router = useRouter();
  const { user, isLoading, signOut } = useAuth();

  const [activeTab, setActiveTab] = useState<"composer" | "settings">(
    "composer"
  );
  const [requestText, setRequestText] = useState(PRESETS[0].request);
  const [understoodTags, setUnderstoodTags] = useState(PRESETS[0].understood);
  const [proposedSteps, setProposedSteps] = useState<string[]>(
    PRESETS[0].steps
  );
  const [planStatus, setPlanStatus] = useState<
    "awaiting_approval" | "approved_waiting_extension" | "cancelled"
  >("awaiting_approval");
  const [showExtensionGuide, setShowExtensionGuide] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFFFFC] flex items-center justify-center text-sm text-[#8C7A7E]">
        Loading workspace...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FFFFFC] text-[#170404] flex flex-col justify-between p-6 sm:p-10">
        <div className="mx-auto w-full max-w-5xl">
          <Link
            href="/"
            className="text-xs font-medium text-[#8C7A7E] hover:text-[#170404]"
          >
            ← Back to Browsy
          </Link>
        </div>

        <main className="my-auto mx-auto w-full max-w-md rounded-2xl border border-[#170404]/15 bg-[#FFFFFC] p-8 text-center shadow-xl">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#170404] text-lg font-medium text-[#FFFFFC]">
            B
          </div>
          <h1 className="mt-5 text-2xl font-medium tracking-[-0.03em] text-[#170404]">
            Sign in to open the Workspace
          </h1>
          <p className="mt-2 text-sm text-[#8C7A7E] leading-relaxed">
            Please sign in or create a local session to access the Browsy task
            composer, action plans, and account settings.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/sign-in?redirect=/workspace"
              className="inline-flex h-12 w-full items-center justify-center rounded-[8px] border-[1.5px] border-[#170404] bg-[#170404] text-sm font-medium text-[#FFFFFC] hover:bg-black"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex h-12 w-full items-center justify-center rounded-[8px] border-[1.5px] border-[#170404] bg-[#FFFFFC] text-sm font-medium text-[#170404] hover:bg-[#F7F2F4]"
            >
              Get Started
            </Link>
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

  const handleSelectPreset = (preset: TaskPreset) => {
    setRequestText(preset.request);
    setUnderstoodTags(preset.understood);
    setProposedSteps(preset.steps);
    setPlanStatus("awaiting_approval");
  };

  const handleComposePlan = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = requestText.trim();
    if (!trimmed) return;

    const matchedPreset = PRESETS.find(
      (p) => p.request.toLowerCase() === trimmed.toLowerCase()
    );

    if (matchedPreset) {
      setUnderstoodTags(matchedPreset.understood);
      setProposedSteps(matchedPreset.steps);
    } else {
      setUnderstoodTags([{ key: "Goal", val: trimmed }]);
      setProposedSteps([
        `Inspect the active webpage for controls related to "${trimmed}"`,
        "Enter relevant search terms or select matching page filters",
        "Check the updated page results and highlight matches",
      ]);
    }
    setPlanStatus("awaiting_approval");
  };

  return (
    <div className="min-h-screen bg-[#FFFFFC] text-[#170404] flex flex-col justify-between">
      {/* Workspace Header */}
      <header className="border-b border-[#170404]/10 bg-[#FFFFFC]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 sm:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-lg font-medium tracking-tight text-[#170404]"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#170404] text-[#FFFFFC] text-sm font-medium">
                B
              </span>
              <span>Browsy</span>
            </Link>
            <span className="text-[#170404]/25">/</span>
            <span className="text-sm font-medium text-[#8C7A7E]">
              Workspace
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveTab("composer")}
              className={`rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                activeTab === "composer"
                  ? "bg-[#170404] text-[#FFFFFC]"
                  : "text-[#8C7A7E] hover:text-[#170404]"
              }`}
            >
              Task Composer
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("settings")}
              className={`rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                activeTab === "settings"
                  ? "bg-[#170404] text-[#FFFFFC]"
                  : "text-[#8C7A7E] hover:text-[#170404]"
              }`}
            >
              Account Settings
            </button>
            <button
              type="button"
              onClick={() => {
                signOut();
                router.push("/");
              }}
              className="ml-2 text-xs sm:text-sm font-medium text-[#8C7A7E] hover:text-[#170404] cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:px-8">
        {/* Honest Extension Dependency Banner */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#C65A92]/30 bg-[#FDF4F7] p-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#9E506E]">
              <span className="h-2 w-2 rounded-full bg-[#B84A79]" />
              <span>Extension Required for Live Website Execution</span>
            </div>
            <p className="mt-1.5 text-xs sm:text-sm text-[#170404]/80">
              To perform actions on real websites, open the Browsy extension
              side panel directly on the website you are visiting. Here you can
              compose tasks and review how Browsy builds action plans.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowExtensionGuide(!showExtensionGuide)}
            className="shrink-0 rounded-lg border border-[#170404] bg-[#FFFFFC] px-4 py-2 text-xs font-medium text-[#170404] hover:bg-[#F7F2F4] cursor-pointer"
          >
            {showExtensionGuide
              ? "Hide Setup Steps"
              : "How to Install Extension"}
          </button>
        </div>

        {showExtensionGuide && (
          <div className="mb-8 rounded-2xl border border-[#170404]/15 bg-white p-6">
            <h2 className="text-base font-medium text-[#170404]">
              Load the Browsy Extension in Chrome or Brave
            </h2>
            <ol className="mt-3 list-decimal pl-5 space-y-2 text-xs sm:text-sm text-[#170404]/80">
              <li>
                Open a new tab and go to{" "}
                <code className="rounded bg-[#170404]/5 px-1.5 py-0.5 font-mono">
                  chrome://extensions
                </code>
              </li>
              <li>
                Turn on <strong>Developer mode</strong> in the top-right corner.
              </li>
              <li>
                Click <strong>Load unpacked</strong> and select the{" "}
                <code className="rounded bg-[#170404]/5 px-1.5 py-0.5 font-mono">
                  extension/dist
                </code>{" "}
                folder from this project.
              </li>
              <li>
                Visit any website and click the Browsy launcher on the right
                edge of the page.
              </li>
            </ol>
          </div>
        )}

        {activeTab === "composer" ? (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Left Column: Task Composer */}
            <div className="lg:col-span-6 space-y-6">
              <div className="rounded-2xl border border-[#170404]/15 bg-white p-6">
                <h1 className="text-xl font-medium text-[#170404]">
                  Compose a task
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-[#8C7A7E]">
                  Describe what you want Browsy to find or filter on a webpage.
                </p>

                <form onSubmit={handleComposePlan} className="mt-4 space-y-4">
                  <div>
                    <label htmlFor="task-input" className="sr-only">
                      Your task request
                    </label>
                    <textarea
                      id="task-input"
                      rows={3}
                      value={requestText}
                      onChange={(e) => setRequestText(e.target.value)}
                      placeholder="e.g., Find me a red checked shirt in XL under ₹1,000."
                      className="w-full rounded-xl border border-[#170404]/25 bg-[#FFFFFC] p-3.5 text-sm text-[#170404] placeholder-[#8C7A7E] focus:border-[#170404] focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="h-12 w-full rounded-[8px] border-[1.5px] border-[#170404] bg-[#170404] text-sm font-medium text-[#FFFFFC] hover:bg-black cursor-pointer"
                  >
                    Create Action Plan
                  </button>
                </form>

                {/* Suggested Task Examples */}
                <div className="mt-6 pt-5 border-t border-[#170404]/10">
                  <div className="text-xs font-medium uppercase tracking-wider text-[#8C7A7E]">
                    Try an example request
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset)}
                        className="rounded-lg border border-[#170404]/20 bg-[#FAF8F9] px-3 py-1.5 text-xs font-medium text-[#170404] hover:border-[#170404] transition-colors cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Action Plan Preview & Approval Controls */}
            <div className="lg:col-span-6 space-y-6">
              <div className="rounded-2xl border border-[#170404]/15 bg-white p-6">
                <div className="flex items-center justify-between pb-4 border-b border-[#170404]/10">
                  <h2 className="text-xl font-medium text-[#170404]">
                    Action Plan Preview
                  </h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      planStatus === "awaiting_approval"
                        ? "bg-[#FDF4F7] text-[#9E506E]"
                        : planStatus === "approved_waiting_extension"
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-stone-100 text-[#8C7A7E]"
                    }`}
                  >
                    {planStatus === "awaiting_approval"
                      ? "Awaiting Approval"
                      : planStatus === "approved_waiting_extension"
                      ? "Plan Approved"
                      : "Cancelled"}
                  </span>
                </div>

                {/* What Browsy Understands */}
                <div className="mt-5">
                  <div className="text-xs font-medium uppercase tracking-wider text-[#8C7A7E]">
                    What Browsy Understands
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {understoodTags.map((item) => (
                      <span
                        key={item.key}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#C65A92]/30 bg-[#FDF4F7] px-2.5 py-1 text-xs font-medium text-[#170404]"
                      >
                        <span className="text-[#8C7A7E]">{item.key}:</span>
                        <span className="font-semibold text-[#170404]">
                          {item.val}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Proposed Steps */}
                <div className="mt-5">
                  <div className="text-xs font-medium uppercase tracking-wider text-[#8C7A7E]">
                    Proposed Steps
                  </div>
                  <ul className="mt-2.5 space-y-2 text-xs sm:text-sm">
                    {proposedSteps.map((step, i) => (
                      <li
                        key={step}
                        className="flex items-center gap-3 rounded-xl border border-[#170404]/12 bg-[#FAF8F9] px-3.5 py-2.5 text-[#170404]"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#170404] text-xs font-medium text-[#FFFFFC]">
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Approval Controls */}
                <div className="mt-6 pt-5 border-t border-[#170404]/10">
                  {planStatus === "awaiting_approval" && (
                    <div>
                      <p className="text-xs text-[#8C7A7E] mb-3">
                        Review the proposed actions above. Approving confirms
                        this plan.
                      </p>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setPlanStatus("approved_waiting_extension")
                          }
                          className="flex-1 h-11 rounded-[8px] border-[1.5px] border-[#170404] bg-[#170404] text-xs sm:text-sm font-medium text-[#FFFFFC] hover:bg-black cursor-pointer"
                        >
                          Approve Plan
                        </button>
                        <button
                          type="button"
                          onClick={() => setPlanStatus("cancelled")}
                          className="h-11 rounded-[8px] border-[1.5px] border-[#170404] bg-[#FFFFFC] px-4 text-xs sm:text-sm font-medium text-[#170404] hover:bg-[#F7F2F4] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {planStatus === "approved_waiting_extension" && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs sm:text-sm text-[#170404] space-y-2">
                      <div className="font-semibold text-emerald-900">
                        ✓ Action Plan Approved
                      </div>
                      <p className="text-[#170404]/80 leading-relaxed">
                        <strong>Execution Status:</strong> Because this is the
                        web workspace and no browser extension is connected to a
                        live store tab, no live website actions were executed
                        here. Use the Browsy browser extension on the target
                        website to run approved actions on the live page.
                      </p>
                    </div>
                  )}

                  {planStatus === "cancelled" && (
                    <div className="flex items-center justify-between rounded-xl border border-[#170404]/15 bg-[#FAF8F9] p-3.5 text-xs text-[#170404]/80">
                      <span>Plan cancelled. No actions were taken.</span>
                      <button
                        type="button"
                        onClick={() => setPlanStatus("awaiting_approval")}
                        className="font-medium text-[#170404] underline cursor-pointer"
                      >
                        Review again
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-xl rounded-2xl border border-[#170404]/15 bg-white p-6 sm:p-8">
            <h1 className="text-xl font-medium text-[#170404]">
              Account Settings
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#8C7A7E]">
              Manage your local workspace session and safety preferences.
            </p>

            <div className="mt-6 space-y-4 border-t border-[#170404]/10 pt-6 text-sm">
              <div className="flex items-center justify-between py-2">
                <span className="text-[#8C7A7E]">Name</span>
                <span className="font-medium text-[#170404]">{user.name}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-[#170404]/10">
                <span className="text-[#8C7A7E]">Email</span>
                <span className="font-medium text-[#170404]">{user.email}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-[#170404]/10">
                <span className="text-[#8C7A7E]">Approval Requirement</span>
                <span className="rounded-full bg-[#FDF4F7] px-3 py-1 text-xs font-medium text-[#9E506E]">
                  Always Ask Before Running (Required)
                </span>
              </div>
            </div>

            <div className="mt-8 border-t border-[#170404]/10 pt-6">
              <button
                type="button"
                onClick={() => {
                  signOut();
                  router.push("/");
                }}
                className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-800 hover:bg-rose-100 cursor-pointer"
              >
                Sign Out of Workspace
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-[#170404]/10 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 text-xs text-[#8C7A7E] sm:px-8">
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
