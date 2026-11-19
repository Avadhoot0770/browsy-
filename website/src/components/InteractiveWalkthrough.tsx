"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

export type DemoKey = "shopping" | "jobs" | "research" | "travel" | "finale";
export type DemoStage = "start" | "plan" | "result";

export type SceneState =
  | "websiteOverview"      // 1. Wide view of website; cursor glides toward launcher
  | "assistantOpening"     // 2. Cursor clicks launcher; assistant panel slides in
  | "cameraZoomingIn"      // 3. Camera zooms and pans to frame composer prominently
  | "typingRequest"        // 4. Request is typed character-by-character into real visible input
  | "requestSubmitted"     // 5. Cursor clicks Send button (↑); prompt bubbles into conversation
  | "understandingIntent"  // 6. Camera reframes; interpreted criteria parameters appear
  | "reviewingActionPlan"  // 7. Action plan card renders with amber approval banner
  | "awaitingApproval"     // 8. Cursor hovers on "⚡ Approve & Run with Browsy" button
  | "executingActions"     // 9. Cursor clicks Approve; execution checklist ticks steps
  | "cameraZoomingOut"     // 10. Camera smoothly returns to wide overview
  | "revealingResults"     // 11. Results illuminated on website; verified outcome card appears
  | "sceneComplete";       // 12. Stable inspection state; ready for next scenario or replay

export interface InterpretedCriterion {
  label: string;
  value: string;
}

export interface MultiDemoSpec {
  key: DemoKey;
  index: number;
  label: string;
  domain: string;
  urlBefore: string;
  urlAfter: string;
  request: string;
  closingMessage: string;
  videoStartSec: number;
  nextKey?: DemoKey;
  nextLabel?: string;
  interpretedCriteria: InterpretedCriterion[];
  actionPlanSteps: string[];
  executionChecklist: string[];
  outcomeSummary: {
    title: string;
    completed: string;
    evaluation: string;
    limitation: string;
  };
}

export const MULTI_DEMOS: MultiDemoSpec[] = [
  {
    key: "shopping",
    index: 1,
    label: "1. Online Clothing Shopping",
    domain: "threadcraft.store",
    urlBefore: "https://threadcraft.store/",
    urlAfter: "https://threadcraft.store/men-checked-shirts?q=red+checked+shirt",
    request: "Find me a red checked shirt in XL under ₹1,000.",
    closingMessage: "“From a request to verified results.”",
    videoStartSec: 0.0,
    nextKey: "jobs",
    nextLabel: "Next: Job Search →",
    interpretedCriteria: [
      { label: "Colour / Pattern", value: "Red · Checked" },
      { label: "Size / Budget", value: "XL · Under ₹1,000" },
    ],
    actionPlanSteps: [
      "Navigate to Men's Checked Shirts catalogue",
      "Select supported Size filter: XL",
      "Select supported Price filter: Under ₹1,000 & click Apply",
    ],
    executionChecklist: [
      "Navigating to /men-checked-shirts catalogue...",
      "Applying supported Size filter: XL...",
      "Applying supported Price filter: Under ₹1,000...",
      "Evaluating visible product cards for Red + Checked...",
    ],
    outcomeSummary: {
      title: "Shopping Outcome",
      completed: "Navigated to catalogue and applied Size: XL and Price: Under ₹1,000 filters.",
      evaluation: "3 visible XL shirts match Red + Checked (₹749–₹899).",
      limitation: "Store has no sidebar filter for colour or pattern; verified directly from visible card details.",
    },
  },
  {
    key: "jobs",
    index: 2,
    label: "2. Job Search",
    domain: "hirepulse.jobs",
    urlBefore: "https://hirepulse.jobs/search",
    urlAfter: "https://hirepulse.jobs/search?role=data+analyst&city=hyderabad&exp=0-2",
    request:
      "Find entry-level data analyst jobs in Hyderabad requiring less than two years of experience.",
    closingMessage: "“Find opportunities that fit your goals.”",
    videoStartSec: 16.2,
    nextKey: "research",
    nextLabel: "Next: Research Summarisation →",
    interpretedCriteria: [
      { label: "Role & City", value: "Data Analyst · Hyderabad" },
      { label: "Experience", value: "Entry-Level (< 2 yrs)" },
    ],
    actionPlanSteps: [
      "Type “Data Analyst” in role search field",
      "Check Location filter: Hyderabad, TS",
      "Check Experience filter: Entry-Level (0–2 yrs) & click Filter",
    ],
    executionChecklist: [
      "Typing role query: “Data Analyst”...",
      "Applying Location filter: Hyderabad, TS...",
      "Applying Experience filter: 0–2 yrs...",
      "Filtering active job board postings...",
    ],
    outcomeSummary: {
      title: "Job Search Outcome",
      completed: "Applied Role: Data Analyst, Location: Hyderabad, and Experience: 0–2 yrs filters (3 matching listings).",
      evaluation: "3 relevant listings retrieved (₹5.5L – ₹9.5L PA) matching 0–2 years criteria.",
      limitation: "Specific SQL prerequisites and application deadlines are not filterable on board—open individual posts.",
    },
  },
  {
    key: "research",
    index: 3,
    label: "3. Research Summarisation",
    domain: "clearbrief.research",
    urlBefore: "https://clearbrief.research/distributed-cloud-overview",
    urlAfter: "https://clearbrief.research/distributed-cloud-overview#summary",
    request: "Summarize the key information on this page.",
    closingMessage: "“Understand pages faster.”",
    videoStartSec: 36.8,
    nextKey: "travel",
    nextLabel: "Next: Travel Planning →",
    interpretedCriteria: [
      { label: "Task & Scope", value: "Grounded Synthesis · Cloud Monograph" },
      { label: "Safety Boundary", value: "Visible DOM Only (Zero Hallucination)" },
    ],
    actionPlanSteps: [
      "Scan visible page DOM for headings, callouts, and body text",
      "Synthesize 3 visible sections (Elasticity, Service Models, FinOps)",
      "Flag locked Section 4 dataset requiring external authentication",
    ],
    executionChecklist: [
      "Inspecting visible DOM tree and heading structure...",
      "Synthesizing Section 1 (Elasticity) & Section 2 (Service Models)...",
      "Extracting Section 3 (Cost Governance & FinOps)...",
      "Flagging Section 4 dataset (institutional login required)...",
    ],
    outcomeSummary: {
      title: "Grounded Page Summary",
      completed: "Extracted and grounded key insights across 3 visible technical sections.",
      evaluation: "Elasticity (CapEx to OpEx), Service Models (IaaS/PaaS/SaaS), Cost Governance (FinOps).",
      limitation: "Section 4 (Latency Raw Telemetry CSV) requires institutional login and was excluded.",
    },
  },
  {
    key: "travel",
    index: 4,
    label: "4. Travel Planning",
    domain: "stayvista.travel",
    urlBefore: "https://stayvista.travel/weekend-getaways",
    urlAfter: "https://stayvista.travel/weekend-getaways?region=hyderabad&maxPrice=5000",
    request: "Find weekend stays near Hyderabad under ₹5,000 per night.",
    closingMessage: "“Plan your next move with less effort.”",
    videoStartSec: 54.2,
    nextKey: "finale",
    nextLabel: "See Brand Finale →",
    interpretedCriteria: [
      { label: "Destination & Budget", value: "Near Hyderabad · ≤ ₹5,000/night" },
      { label: "Dates", value: "Unspecified Weekend" },
    ],
    actionPlanSteps: [
      "Select Destination filter: Near Hyderabad (≤ 150 km)",
      "Select Nightly Budget cap: Under ₹5,000 / night",
      "Click Update Stays (stops at results—no booking initiated)",
    ],
    executionChecklist: [
      "Applying Destination radius: Near Hyderabad (≤ 150 km)...",
      "Applying Nightly Cap: Under ₹5,000 / night...",
      "Updating weekend stay catalogue...",
      "Verifying ratings, distances, and nightly rates...",
    ],
    outcomeSummary: {
      title: "Travel Search Outcome",
      completed: "Applied Destination: Near Hyderabad and Nightly Cap: Under ₹5,000 (4 verified stays).",
      evaluation: "Stays within 28–145 km range priced between ₹3,850 and ₹4,750 per night.",
      limitation: "Specific dates not provided; live availability requires date selection. No booking performed.",
    },
  },
  {
    key: "finale",
    index: 5,
    label: "5. Brand Finale",
    domain: "browsy.assistant",
    urlBefore: "https://browsy.app/",
    urlAfter: "https://browsy.app/",
    request: "✦ Browsy — The web, your way.",
    closingMessage: "“Your browser assistant. Your approval. Your control.”",
    videoStartSec: 72.5,
    nextKey: "shopping",
    nextLabel: "↺ Replay from Start",
    interpretedCriteria: [],
    actionPlanSteps: [],
    executionChecklist: [],
    outcomeSummary: {
      title: "Browsy Ecosystem",
      completed: "Unified assistant across all web domains.",
      evaluation: "Transparent actions, user approval, verified outcomes.",
      limitation: "None.",
    },
  },
];

interface InteractiveWalkthroughProps {
  initialMode?: "interactive" | "video";
}

interface CursorCoords {
  x: number;
  y: number;
  visible: boolean;
  clicking: boolean;
}

interface CameraTransform {
  tx: number;
  ty: number;
  scale: number;
}

export function InteractiveWalkthrough({
  initialMode = "interactive",
}: InteractiveWalkthroughProps) {
  const [mode, setMode] = useState<"interactive" | "video">(initialMode);
  const [activeDemoKey, setActiveDemoKey] = useState<DemoKey>("shopping");
  const [sceneState, setSceneState] = useState<SceneState>("websiteOverview");
  const [typedLength, setTypedLength] = useState(0);
  const [executionStepIndex, setExecutionStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isUserHovering, setIsUserHovering] = useState(false);

  // Dynamic Camera Transform
  const [cameraTransform, setCameraTransform] = useState<CameraTransform>({
    tx: 0,
    ty: 0,
    scale: 1,
  });

  // Virtual cursor state within the camera canvas coordinate space
  const [cursor, setCursor] = useState<CursorCoords>({
    x: 35,
    y: 40,
    visible: true,
    clicking: false,
  });

  // DOM element references for precise geometry calculations
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const composerContainerRef = useRef<HTMLDivElement | null>(null);
  const composerInputRef = useRef<HTMLInputElement | null>(null);
  const sendButtonRef = useRef<HTMLButtonElement | null>(null);
  const planCardRef = useRef<HTMLDivElement | null>(null);
  const combinedVideoRef = useRef<HTMLVideoElement | null>(null);

  // Timers and animation handlers
  const timerPoolRef = useRef<NodeJS.Timeout[]>([]);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Active scenario spec derived atomically from activeDemoKey
  const activeDemo = useMemo(() => {
    return MULTI_DEMOS.find((d) => d.key === activeDemoKey) || MULTI_DEMOS[0];
  }, [activeDemoKey]);

  // Clean timer disposal helper
  const clearTimelineTimers = useCallback(() => {
    timerPoolRef.current.forEach((t) => clearTimeout(t));
    timerPoolRef.current = [];
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
  }, []);

  const scheduleStep = useCallback((fn: () => void, ms: number) => {
    const timer = setTimeout(() => {
      timerPoolRef.current = timerPoolRef.current.filter((t) => t !== timer);
      fn();
    }, ms);
    timerPoolRef.current.push(timer);
    return timer;
  }, []);

  // Monitor responsive viewport & prefers-reduced-motion
  useEffect(() => {
    const checkViewport = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    checkViewport();
    window.addEventListener("resize", checkViewport);

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(motionQuery.matches);
    const handleMotionChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    motionQuery.addEventListener("change", handleMotionChange);

    return () => {
      window.removeEventListener("resize", checkViewport);
      motionQuery.removeEventListener("change", handleMotionChange);
      clearTimelineTimers();
    };
  }, [clearTimelineTimers]);

  // Map 12 scene states to 3 overarching stages
  const stage: DemoStage = useMemo(() => {
    if (
      sceneState === "websiteOverview" ||
      sceneState === "assistantOpening" ||
      sceneState === "cameraZoomingIn" ||
      sceneState === "typingRequest" ||
      sceneState === "requestSubmitted"
    ) {
      return "start";
    }
    if (
      sceneState === "understandingIntent" ||
      sceneState === "reviewingActionPlan" ||
      sceneState === "awaitingApproval" ||
      sceneState === "executingActions"
    ) {
      return "plan";
    }
    return "result";
  }, [sceneState]);

  // Controlled displayed text in the composer input
  const currentTypedText = useMemo(() => {
    if (
      sceneState === "websiteOverview" ||
      sceneState === "assistantOpening" ||
      sceneState === "cameraZoomingIn"
    ) {
      return "";
    }
    if (sceneState === "typingRequest") {
      return activeDemo.request.slice(0, typedLength);
    }
    if (sceneState === "requestSubmitted") {
      return ""; // Input is cleared upon dispatch into conversation bubble
    }
    return "";
  }, [sceneState, activeDemo.request, typedLength]);

  const isTypingDone = typedLength >= activeDemo.request.length;

  // Recalculate camera position from actual bounding rectangle with strict boundary clamping
  const updateCameraTransform = useCallback(() => {
    if (prefersReducedMotion || !isDesktop) {
      setCameraTransform({ tx: 0, ty: 0, scale: 1 });
      return;
    }

    if (
      sceneState === "websiteOverview" ||
      sceneState === "assistantOpening" ||
      sceneState === "cameraZoomingOut" ||
      sceneState === "revealingResults" ||
      sceneState === "sceneComplete"
    ) {
      setCameraTransform({ tx: 0, ty: 0, scale: 1 });
      return;
    }

    if (
      sceneState === "cameraZoomingIn" ||
      sceneState === "typingRequest" ||
      sceneState === "requestSubmitted"
    ) {
      const vEl = viewportRef.current;
      const cEl = composerContainerRef.current;

      if (!vEl || !cEl) {
        // Fallback for initial paint
        setCameraTransform({ tx: -160, ty: -90, scale: 1.18 });
        return;
      }

      const vRect = vEl.getBoundingClientRect();
      const cRect = cEl.getBoundingClientRect();

      // Diagnostic check: verify composer bounding box
      const isComposerValid = cRect.width > 0 && cRect.height > 0;
      if (process.env.NODE_ENV !== "production") {
        console.log("[Browsy Demo Diagnostics] composerFound:", isComposerValid, {
          width: cRect.width,
          height: cRect.height,
        });
      }

      // Safe, readable scale factor (1.18x) that enhances size without throwing surroundings off-screen
      const desiredScale = 1.18;

      // Current transform applied to canvas
      const currentScale = cameraTransform.scale || 1;
      const currentTx = cameraTransform.tx || 0;
      const currentTy = cameraTransform.ty || 0;

      // If we are already framed at desiredScale for composer, preserve transform to prevent drift
      if (
        (sceneState === "typingRequest" || sceneState === "requestSubmitted") &&
        Math.abs(currentScale - desiredScale) < 0.01
      ) {
        return;
      }

      // Convert current screen rect to unscaled canvas coordinates
      const unscaledX = (cRect.left - vRect.left - currentTx) / currentScale;
      const unscaledY = (cRect.top - vRect.top - currentTy) / currentScale;
      const unscaledW = cRect.width / currentScale;
      const unscaledH = cRect.height / currentScale;

      const targetCenterX = unscaledX + unscaledW / 2;
      const targetCenterY = unscaledY + unscaledH / 2;

      // Position composer comfortably: 70% of viewport width, 84% of viewport height
      let tx = vRect.width * 0.70 - targetCenterX * desiredScale;
      let ty = vRect.height * 0.84 - targetCenterY * desiredScale;

      // Boundary Clamping: Never let composer bottom edge exceed viewport bottom - 20px
      const composerBottomAfter = (unscaledY + unscaledH) * desiredScale + ty;
      if (composerBottomAfter > vRect.height - 20) {
        ty -= (composerBottomAfter - (vRect.height - 20));
      }

      // Boundary Clamping: Never let composer right edge exceed viewport right - 20px
      const composerRightAfter = (unscaledX + unscaledW) * desiredScale + tx;
      if (composerRightAfter > vRect.width - 20) {
        tx -= (composerRightAfter - (vRect.width - 20));
      }

      // Boundary Clamping: Never pan website left by more than 25% of viewport width
      tx = Math.max(-0.25 * vRect.width, tx);

      if (process.env.NODE_ENV !== "production") {
        console.log("[Browsy Demo Diagnostics] cameraTargetCalculated (composer):", {
          tx: Math.round(tx),
          ty: Math.round(ty),
          scale: desiredScale,
        });
      }

      setCameraTransform({ tx: Math.round(tx), ty: Math.round(ty), scale: desiredScale });
    } else if (
      sceneState === "understandingIntent" ||
      sceneState === "reviewingActionPlan" ||
      sceneState === "awaitingApproval" ||
      sceneState === "executingActions"
    ) {
      const vEl = viewportRef.current;
      const pEl = planCardRef.current;

      if (!vEl || !pEl) {
        setCameraTransform({ tx: -120, ty: -30, scale: 1.14 });
        return;
      }

      const vRect = vEl.getBoundingClientRect();
      const pRect = pEl.getBoundingClientRect();
      const desiredScale = 1.14;

      const currentScale = cameraTransform.scale || 1;
      const currentTx = cameraTransform.tx || 0;
      const currentTy = cameraTransform.ty || 0;

      if (
        (sceneState === "reviewingActionPlan" ||
          sceneState === "awaitingApproval" ||
          sceneState === "executingActions") &&
        Math.abs(currentScale - desiredScale) < 0.01
      ) {
        return;
      }

      const unscaledX = (pRect.left - vRect.left - currentTx) / currentScale;
      const unscaledY = (pRect.top - vRect.top - currentTy) / currentScale;
      const unscaledW = pRect.width / currentScale;
      const unscaledH = pRect.height / currentScale;
      const targetCenterX = unscaledX + unscaledW / 2;
      const targetCenterY = unscaledY + unscaledH / 2;

      let tx = vRect.width * 0.72 - targetCenterX * desiredScale;
      let ty = vRect.height * 0.52 - targetCenterY * desiredScale;

      tx = Math.max(-0.22 * vRect.width, Math.min(0, tx));
      ty = Math.max(-0.25 * vRect.height, Math.min(0, ty));

      if (process.env.NODE_ENV !== "production") {
        console.log("[Browsy Demo Diagnostics] cameraTargetCalculated (plan):", {
          tx: Math.round(tx),
          ty: Math.round(ty),
          scale: desiredScale,
        });
      }

      setCameraTransform({ tx: Math.round(tx), ty: Math.round(ty), scale: desiredScale });
    }
  }, [sceneState, isDesktop, prefersReducedMotion]);

  // Trigger camera update whenever sceneState changes
  useEffect(() => {
    updateCameraTransform();
  }, [updateCameraTransform]);

  // Single Authoritative Timeline Driver
  useEffect(() => {
    if (activeDemoKey === "finale" || mode !== "interactive") {
      clearTimelineTimers();
      setTypedLength(activeDemo.request.length);
      setCursor({ x: 50, y: 50, visible: false, clicking: false });
      return;
    }

    if (!isPlaying) {
      // Paused state: retain current frame
      clearTimelineTimers();
      return;
    }

    clearTimelineTimers();

    switch (sceneState) {
      case "websiteOverview": {
        setTypedLength(0);
        setExecutionStepIndex(0);
        setCursor({ x: 35, y: 40, visible: true, clicking: false });

        // Glides toward the floating Browsy launcher pill
        scheduleStep(() => {
          setCursor({ x: 54, y: 88, visible: true, clicking: false });
        }, 350);

        scheduleStep(() => {
          setSceneState("assistantOpening");
        }, 950);
        break;
      }

      case "assistantOpening": {
        // Clicks launcher
        setCursor({ x: 54, y: 88, visible: true, clicking: true });

        scheduleStep(() => {
          setCursor({ x: 54, y: 88, visible: true, clicking: false });
        }, 220);

        // Wait for panel opening animation to finish before moving the camera
        scheduleStep(() => {
          if (process.env.NODE_ENV !== "production") {
            console.log("[Browsy Demo Diagnostics] assistantOpened");
          }
          setSceneState("cameraZoomingIn");
        }, 700);
        break;
      }

      case "cameraZoomingIn": {
        // Camera zooms in; cursor travels into the composer input field
        setCursor({ x: 74, y: 92, visible: true, clicking: false });
        setTypedLength(0);

        // Wait until camera animation settles completely before starting typing
        scheduleStep(() => {
          if (process.env.NODE_ENV !== "production") {
            console.log("[Browsy Demo Diagnostics] cameraAnimationCompleted");
          }
          setSceneState("typingRequest");
        }, 750);
        break;
      }

      case "typingRequest": {
        // Diagnostic check at typing start: confirm composer input exists and has bounding box
        const inputEl = composerInputRef.current;
        if (inputEl) {
          const rect = inputEl.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0;
          if (process.env.NODE_ENV !== "production") {
            console.log("[Browsy Demo Diagnostics] composerVisible:", isVisible, {
              top: rect.top,
              bottom: rect.bottom,
              left: rect.left,
              right: rect.right,
            });
            console.log("[Browsy Demo Diagnostics] typingStarted:", activeDemo.request);
          }
        }

        // Cursor settles inside the input field
        setCursor({ x: 74, y: 92, visible: true, clicking: false });

        if (prefersReducedMotion) {
          setTypedLength(activeDemo.request.length);
          scheduleStep(() => {
            setSceneState("requestSubmitted");
          }, 500);
          break;
        }

        let charCount = 0;
        const total = activeDemo.request.length;
        const charDelay = 38;

        typingIntervalRef.current = setInterval(() => {
          charCount += 1;
          setTypedLength(charCount);

          if (charCount >= total) {
            if (typingIntervalRef.current) {
              clearInterval(typingIntervalRef.current);
              typingIntervalRef.current = null;
            }
            if (process.env.NODE_ENV !== "production") {
              console.log("[Browsy Demo Diagnostics] typingCompleted");
            }
            // Hold briefly after final character so user reads request
            scheduleStep(() => {
              // Cursor moves toward Send button
              setCursor({ x: 94, y: 92, visible: true, clicking: false });

              scheduleStep(() => {
                setSceneState("requestSubmitted");
              }, 450);
            }, 600);
          }
        }, charDelay);
        break;
      }

      case "requestSubmitted": {
        if (process.env.NODE_ENV !== "production") {
          console.log("[Browsy Demo Diagnostics] requestSubmitted");
        }
        // Clicks Send button
        setCursor({ x: 94, y: 92, visible: true, clicking: true });

        scheduleStep(() => {
          setCursor({ x: 94, y: 92, visible: true, clicking: false });
        }, 220);

        scheduleStep(() => {
          setSceneState("understandingIntent");
        }, 650);
        break;
      }

      case "understandingIntent": {
        // Glides up to interpreted criteria tags
        setCursor({ x: 74, y: 46, visible: true, clicking: false });

        scheduleStep(() => {
          setSceneState("reviewingActionPlan");
        }, 1000);
        break;
      }

      case "reviewingActionPlan": {
        // Action plan appears, cursor hovers near proposed steps
        setCursor({ x: 74, y: 56, visible: true, clicking: false });

        scheduleStep(() => {
          setSceneState("awaitingApproval");
        }, 900);
        break;
      }

      case "awaitingApproval": {
        // Cursor moves to "⚡ Approve & Run with Browsy" button and hovers
        setCursor({ x: 76, y: 68, visible: true, clicking: false });

        scheduleStep(() => {
          if (process.env.NODE_ENV !== "production") {
            console.log("[Browsy Demo Diagnostics] approvalCompleted");
          }
          setSceneState("executingActions");
        }, 950);
        break;
      }

      case "executingActions": {
        // Clicks Approve button
        setCursor({ x: 76, y: 68, visible: true, clicking: true });

        scheduleStep(() => {
          setCursor({ x: 76, y: 68, visible: false, clicking: false });
        }, 250);

        // Animated execution checklist steps
        setExecutionStepIndex(0);
        scheduleStep(() => setExecutionStepIndex(1), 450);
        scheduleStep(() => setExecutionStepIndex(2), 900);
        scheduleStep(() => setExecutionStepIndex(3), 1350);
        scheduleStep(() => setExecutionStepIndex(4), 1800);

        scheduleStep(() => {
          if (process.env.NODE_ENV !== "production") {
            console.log("[Browsy Demo Diagnostics] executionCompleted");
          }
          setSceneState("cameraZoomingOut");
        }, 2200);
        break;
      }

      case "cameraZoomingOut": {
        // Camera pulls back smoothly to wide overview
        setCursor({ x: 50, y: 50, visible: false, clicking: false });

        scheduleStep(() => {
          if (process.env.NODE_ENV !== "production") {
            console.log("[Browsy Demo Diagnostics] resultsRevealed");
          }
          setSceneState("revealingResults");
        }, 700);
        break;
      }

      case "revealingResults": {
        // Cursor indicates verified results on the website
        setCursor({ x: 30, y: 46, visible: true, clicking: false });

        scheduleStep(() => {
          setSceneState("sceneComplete");
        }, 2600);
        break;
      }

      case "sceneComplete": {
        // Final rest position, virtual cursor fades out
        setCursor({ x: 80, y: 80, visible: false, clicking: false });
        break;
      }
    }

    return () => clearTimelineTimers();
  }, [
    sceneState,
    activeDemoKey,
    activeDemo.request,
    mode,
    isPlaying,
    prefersReducedMotion,
    clearTimelineTimers,
    scheduleStep,
  ]);

  // Switch demo cleanly with complete atomic state reset
  const switchToDemo = useCallback(
    (nextKey: DemoKey) => {
      clearTimelineTimers();
      setIsTransitioning(true);
      setActiveDemoKey(nextKey);
      setTypedLength(0);
      setExecutionStepIndex(0);
      setSceneState("websiteOverview");
      setCursor({ x: 35, y: 40, visible: true, clicking: false });
      setCameraTransform({ tx: 0, ty: 0, scale: 1 });

      setTimeout(() => {
        setIsTransitioning(false);
      }, 200);
    },
    [clearTimelineTimers]
  );

  // Manual jump to specific stage
  const jumpToStage = (targetStage: DemoStage) => {
    clearTimelineTimers();
    if (targetStage === "start") {
      setTypedLength(0);
      setSceneState("cameraZoomingIn");
    } else if (targetStage === "plan") {
      setTypedLength(activeDemo.request.length);
      setSceneState("reviewingActionPlan");
    } else {
      setTypedLength(activeDemo.request.length);
      setExecutionStepIndex(4);
      setSceneState("revealingResults");
    }
  };

  // Immediate manual trigger for the primary action button
  const handlePrimaryStageAction = () => {
    if (activeDemoKey === "finale") {
      switchToDemo("shopping");
      return;
    }

    clearTimelineTimers();
    if (
      sceneState === "websiteOverview" ||
      sceneState === "assistantOpening" ||
      sceneState === "cameraZoomingIn" ||
      sceneState === "typingRequest"
    ) {
      setTypedLength(activeDemo.request.length);
      setSceneState("requestSubmitted");
    } else if (
      sceneState === "requestSubmitted" ||
      sceneState === "understandingIntent" ||
      sceneState === "reviewingActionPlan" ||
      sceneState === "awaitingApproval"
    ) {
      setSceneState("executingActions");
    } else if (activeDemo.nextKey) {
      switchToDemo(activeDemo.nextKey);
    } else {
      switchToDemo("shopping");
    }
  };

  // Replay from start
  const replayCompleteDemonstration = () => {
    switchToDemo("shopping");
  };

  // Replay current scene
  const replayCurrentScene = () => {
    clearTimelineTimers();
    setTypedLength(0);
    setExecutionStepIndex(0);
    setSceneState("websiteOverview");
    setCursor({ x: 35, y: 40, visible: true, clicking: false });
    setCameraTransform({ tx: 0, ty: 0, scale: 1 });
  };

  // Seek video chapter in video mode
  const seekVideoChapter = (seconds: number) => {
    setMode("video");
    setTimeout(() => {
      if (combinedVideoRef.current) {
        combinedVideoRef.current.currentTime = seconds;
        combinedVideoRef.current.play().catch(() => {});
      }
    }, 80);
  };

  // Smooth scroll handler for the "Try it" callout
  const handleTryItCalloutClick = () => {
    if (mode !== "interactive") {
      setMode("interactive");
    }
    if (activeDemoKey === "finale") {
      switchToDemo("shopping");
    } else {
      replayCurrentScene();
    }
    const container =
      document.getElementById("interactive-walkthrough-tabs") ||
      document.getElementById("try-example");
    if (container) {
      container.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const currentUrl =
    stage === "result" ? activeDemo.urlAfter : activeDemo.urlBefore;

  return (
    <div className="w-full font-sans">
      {/* Top Header: Multi-Website Badge + Mode Toggle */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6">
        <div>
          <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-[#B84A79]/30 bg-[#FBF4F7] px-4 py-1.5 text-xs font-semibold text-[#9E506E]">
            <span>Cinematic Multi-Website Demo</span>
            <span aria-hidden="true">·</span>
            <span>ThreadCraft · HirePulse · ClearBrief · StayVista</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-[#170404]">
              One Assistant Across the Web
            </h2>

            {/* Hand-Sketched "Try it" Callout with Curved Arrow & Smiley Doodle */}
            <button
              type="button"
              onClick={handleTryItCalloutClick}
              aria-label="Try the interactive Browsy demonstration"
              className="group inline-flex items-center gap-2 text-[#B84A79] hover:text-[#932E5A] transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B84A79] focus-visible:ring-offset-2 rounded-lg select-none -rotate-2 hover:-rotate-1 hover:scale-105 active:scale-95"
            >
              <svg
                width="48"
                height="36"
                viewBox="0 0 56 42"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="shrink-0 overflow-visible text-[#B84A79] group-hover:text-[#932E5A] transition-colors"
                aria-hidden="true"
              >
                <path
                  d="M 5 8 C 19 2, 35 4, 43 15 C 47 21, 48.5 27.5, 48 33.5"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="hand-drawn-arrow-path"
                />
                <path
                  d="M 38 25.5 C 41.5 29.5, 45.8 33, 48 34 C 48.5 28.5, 50.5 22.5, 53 17"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="hand-drawn-arrow-path"
                />
              </svg>

              <span
                className="text-2xl sm:text-3xl font-bold tracking-normal underline decoration-[#B84A79]/40 underline-offset-4 group-hover:decoration-[#B84A79] transition-all"
                style={{
                  fontFamily:
                    "'Caveat', 'Patrick Hand', 'Segoe Print', 'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', cursive, sans-serif",
                }}
              >
                Try it
              </span>

              <svg
                width="28"
                height="28"
                viewBox="0 0 34 34"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="shrink-0 overflow-visible text-[#B84A79] group-hover:text-[#932E5A] transition-colors -rotate-6 group-hover:rotate-0 transition-transform duration-200 ml-0.5"
                aria-hidden="true"
              >
                <path
                  d="M 17 3.5 C 24.8 3.2, 30.5 8.9, 30.2 16.8 C 29.9 24.5, 24.2 30.2, 16.5 29.8 C 8.8 29.4, 3.5 24, 3.8 16.2 C 4.1 8.5, 9.5 3.8, 17.5 3.5"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <path
                  d="M 11.8 12 C 11.8 13.6, 12.3 14.2, 12.8 14.2"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
                <path
                  d="M 21.2 12 C 21.2 13.6, 21.7 14.2, 22.2 14.2"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
                <path
                  d="M 10 18.8 C 12.5 23.8, 21.5 23.8, 24 18.8"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <path
                  d="M 9.2 18 C 9.8 18.8, 10.5 19, 11 19"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M 24.8 18 C 24.2 18.8, 23.5 19, 23 19"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          <p className="mt-2 max-w-2xl text-base sm:text-lg text-[#170404]/80 leading-relaxed">
            Experience how Browsy effortlessly adapts across four distinct websites—from{" "}
            <strong>Online Shopping</strong> to <strong>Job Search</strong>,{" "}
            <strong>Research Summarisation</strong>, and{" "}
            <strong>Travel Planning</strong>—always keeping human approval in control.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-end">
          <div
            role="tablist"
            aria-label="Demo presentation mode"
            className="inline-flex rounded-xl border border-[#170404]/15 bg-[#FAF8F9] p-1.5 shadow-sm"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "interactive"}
              onClick={() => setMode("interactive")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
                mode === "interactive"
                  ? "bg-[#170404] text-[#FFFFFC] shadow-sm"
                  : "text-[#170404]/75 hover:text-[#170404]"
              }`}
            >
              Interactive Guided Demo
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "video"}
              onClick={() => setMode("video")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
                mode === "video"
                  ? "bg-[#170404] text-[#FFFFFC] shadow-sm"
                  : "text-[#170404]/75 hover:text-[#170404]"
              }`}
            >
              Cinematic Video (80s)
            </button>
          </div>
        </div>
      </div>

      {/* 5 Scenario Selector Tabs */}
      <div
        id="interactive-walkthrough-tabs"
        role="tablist"
        aria-label="Select website demonstration"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-6"
      >
        {MULTI_DEMOS.map((demo) => {
          const isSelected = demo.key === activeDemoKey;
          return (
            <button
              key={demo.key}
              id={`browsy-scenario-tab-${demo.key}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => {
                if (mode === "video") {
                  setActiveDemoKey(demo.key);
                  seekVideoChapter(demo.videoStartSec);
                } else {
                  switchToDemo(demo.key);
                }
              }}
              className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition-all cursor-pointer ${
                isSelected
                  ? "border-[#170404] bg-[#170404] text-[#FFFFFC] shadow-md ring-1 ring-[#170404]"
                  : "border-[#170404]/12 bg-[#FAF8F9] text-[#170404] hover:border-[#170404]/35 hover:bg-white"
              }`}
            >
              <div className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider">
                <span className={isSelected ? "text-[#F3BFD4]" : "text-[#9E506E]"}>
                  {demo.key === "finale" ? "Finale" : `Demo ${demo.index} of 4`}
                </span>
                <span
                  className={`font-mono text-[11px] lowercase ${
                    isSelected ? "text-white/80" : "text-[#8C7A7E]"
                  }`}
                >
                  {demo.domain}
                </span>
              </div>
              <span className="mt-1 text-sm sm:text-base font-semibold line-clamp-1">
                {demo.label.replace(/^\d+\.\s*/, "")}
              </span>
              <span
                className={`mt-1 line-clamp-1 text-xs ${
                  isSelected ? "text-white/85" : "text-[#170404]/70"
                }`}
              >
                {demo.key === "finale" ? "The web, your way." : `“${demo.request}”`}
              </span>
            </button>
          );
        })}
      </div>

      {mode === "video" ? (
        /* ═══ Combined 4-Website Video Player with Chapter Seek Controls ═══ */
        <div className="overflow-hidden rounded-2xl border border-[#170404]/15 bg-[#170404] shadow-2xl">
          <video
            ref={combinedVideoRef}
            src="/demo/browsy-demo.mp4"
            poster="/demo/browsy-poster.jpg"
            controls
            autoPlay
            loop
            playsInline
            preload="metadata"
            aria-label="Cinematic multi-website product demo video with visible typing, camera zoom choreography, and verified results"
            className="block w-full h-auto aspect-[16/10]"
          />
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-t border-white/10 bg-[#170404] px-5 py-4 text-xs sm:text-sm text-[#FFFFFC]/90">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-[#F3BFD4] mr-1">Jump to Chapter:</span>
              {MULTI_DEMOS.map((demo) => (
                <button
                  key={demo.key}
                  type="button"
                  onClick={() => {
                    setActiveDemoKey(demo.key);
                    seekVideoChapter(demo.videoStartSec);
                  }}
                  className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs sm:text-sm font-medium text-[#FFFFFC] hover:bg-white/25 transition-colors cursor-pointer"
                >
                  {demo.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setMode("interactive")}
              className="shrink-0 rounded-lg border border-[#F3BFD4]/40 bg-[#B84A79] px-4 py-2 font-semibold text-white hover:bg-[#a13d68] transition-colors cursor-pointer"
            >
              Switch to Interactive Mode
            </button>
          </div>
        </div>
      ) : (
        /* ═══ Interactive Step-by-Step Guided Walkthrough ═══ */
        <>
          {/* Top Control Bar: Stage Indicators + Play/Pause & Replay Controls */}
          {activeDemoKey !== "finale" && (
            <div className="mb-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-2xl border border-[#170404]/15 bg-[#FAF8F9] p-4 sm:p-5">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-lg bg-[#170404] px-3 py-1 text-xs font-semibold text-[#FFFFFC]">
                    {activeDemo.label} · {activeDemo.domain}
                  </span>
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => jumpToStage("start")}
                      className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                        stage === "start"
                          ? "bg-[#B84A79] text-white shadow-sm"
                          : "bg-white text-[#170404]/70 border border-[#170404]/15 hover:bg-[#F3EEF4]"
                      }`}
                    >
                      Step 1: Compose & Type
                    </button>
                    <span className="text-[#170404]/40">→</span>
                    <button
                      type="button"
                      onClick={() => jumpToStage("plan")}
                      className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                        stage === "plan"
                          ? "bg-[#B84A79] text-white shadow-sm"
                          : "bg-white text-[#170404]/70 border border-[#170404]/15 hover:bg-[#F3EEF4]"
                      }`}
                    >
                      Step 2: Review Plan & Approval
                    </button>
                    <span className="text-[#170404]/40">→</span>
                    <button
                      type="button"
                      onClick={() => jumpToStage("result")}
                      className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                        stage === "result"
                          ? "bg-[#B84A79] text-white shadow-sm"
                          : "bg-white text-[#170404]/70 border border-[#170404]/15 hover:bg-[#F3EEF4]"
                      }`}
                    >
                      Step 3: Verified Outcome
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#B84A79] animate-pulse" />
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-[#9E506E]">
                    {sceneState === "websiteOverview" && "1. Overview: Storefront ready, launching Browsy"}
                    {sceneState === "assistantOpening" && "2. Opening: Assistant panel slides in"}
                    {sceneState === "cameraZoomingIn" && "3. Zooming: Framing composer input field"}
                    {sceneState === "typingRequest" && "4. Typing Request: Progressive character entry"}
                    {sceneState === "requestSubmitted" && "5. Submitted: Query dispatched into conversation"}
                    {sceneState === "understandingIntent" && "6. Interpreting: Extracting parameters & DOM context"}
                    {sceneState === "reviewingActionPlan" && "7. Action Plan: Human approval barrier active"}
                    {sceneState === "awaitingApproval" && "8. Awaiting Approval: User authorization ready"}
                    {sceneState === "executingActions" && "9. Executing Actions: Real-time browser steps"}
                    {sceneState === "cameraZoomingOut" && "10. Zooming Out: Expanding to wide browser view"}
                    {sceneState === "revealingResults" && "11. Results Revealed: Verified outcome highlighted"}
                    {sceneState === "sceneComplete" && "12. Verified & Complete: Inspected outcome ready"}
                  </p>
                </div>
              </div>

              {/* Playback & Action Controls */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  title={isPlaying ? "Pause cinematic animation" : "Resume animation"}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-[#170404]/20 bg-white px-3 text-xs sm:text-sm font-semibold text-[#170404] hover:bg-[#F7F2F4] transition-colors cursor-pointer"
                >
                  {isPlaying ? "⏸ Pause" : "▶ Resume"}
                </button>
                <button
                  type="button"
                  onClick={replayCurrentScene}
                  title="Replay this scene from start"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-[#170404]/20 bg-white px-3 text-xs sm:text-sm font-semibold text-[#170404] hover:bg-[#F7F2F4] transition-colors cursor-pointer"
                >
                  ↺ Replay Scene
                </button>
                <button
                  type="button"
                  onClick={replayCompleteDemonstration}
                  title="Replay all demos from the beginning"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-[#170404]/20 bg-white px-3 text-xs sm:text-sm font-semibold text-[#170404] hover:bg-[#F7F2F4] transition-colors cursor-pointer"
                >
                  ↺ Replay from Start
                </button>
                <button
                  type="button"
                  onClick={handlePrimaryStageAction}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-[#170404] bg-[#170404] px-4 text-xs sm:text-sm font-semibold text-[#FFFFFC] hover:bg-black transition-colors cursor-pointer shadow-sm"
                >
                  {stage === "start"
                    ? "Enter Request & View Plan →"
                    : stage === "plan"
                    ? activeDemoKey === "research"
                      ? "⚡ Generate Grounded Summary →"
                      : "⚡ Approve & Run with Browsy →"
                    : activeDemo.nextLabel || "↺ Replay from Start"}
                </button>
              </div>
            </div>
          )}

          {/* Browser Window Frame Container */}
          <div
            onMouseEnter={() => setIsUserHovering(true)}
            onMouseLeave={() => setIsUserHovering(false)}
            className="relative overflow-hidden rounded-2xl border border-[#170404]/18 bg-white shadow-[0_24px_60px_-20px_rgba(23,4,4,0.24)]"
          >
            {/* Simulated Browser Toolbar */}
            <div className="relative z-30 flex h-12 items-center justify-between gap-2 border-b border-[#170404]/10 bg-[#F3EEF4] px-4">
              <div className="flex items-center gap-2 shrink-0">
                <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
                <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
                <span className="h-3 w-3 rounded-full bg-[#28C840]" />
                <div className="ml-2 hidden sm:flex items-center gap-2 text-xs font-semibold text-[#6E6270]">
                  <span>←</span>
                  <span>→</span>
                  <span>↻</span>
                </div>
              </div>

              <div
                className={`flex h-8 min-w-0 flex-1 items-center gap-2.5 rounded-lg border px-3.5 text-xs transition-all ${
                  isTransitioning
                    ? "border-[#B84A79] bg-[#FBF4F7] ring-2 ring-[#B84A79]/30"
                    : "border-[#170404]/12 bg-white text-[#170404]"
                }`}
              >
                <span className="text-emerald-600 text-xs shrink-0">🔒</span>
                <span className="truncate font-mono text-xs sm:text-sm">
                  {currentUrl}
                </span>
                <span className="ml-auto hidden sm:inline-block shrink-0 rounded-full bg-[#F3EEF4] px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-[#5A2540]">
                  {activeDemo.domain} · Simulated Browser
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (stage === "start") setSceneState("cameraZoomingIn");
                    else if (stage === "plan") setSceneState("executingActions");
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#170404] px-3 text-xs font-semibold text-[#FFFFFC] cursor-pointer hover:bg-black transition-colors"
                >
                  <span className="text-[#FFB6C1]">✦</span>
                  <span>Browsy</span>
                </button>
              </div>
            </div>

            {/* Viewport Content Container */}
            {activeDemoKey === "finale" ? (
              /* ═══ CINEMATIC BROWSY BRAND FINALE STAGE ═══ */
              <div className="relative min-h-[580px] bg-gradient-to-br from-[#1b0811] via-[#2a0e1c] to-[#14040a] p-8 sm:p-12 flex flex-col items-center justify-center text-center text-white overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(184,74,121,0.22)_0%,transparent_70%)] pointer-events-none" />

                <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-[#F3BFD4]/30 bg-white/10 text-4xl shadow-[0_0_50px_rgba(184,74,121,0.5)] backdrop-blur-md">
                  <span className="text-[#FFB6C1]">✦</span>
                </div>

                <h3 className="text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-[#FFFFFC]">
                  Browsy
                </h3>
                <p className="mt-2 text-2xl sm:text-3xl font-light text-[#F3BFD4] tracking-tight">
                  The web, your way.
                </p>
                <p className="mt-4 max-w-xl text-base sm:text-lg text-white/80 leading-relaxed">
                  “Your browser assistant. Your approval. Your control.”
                </p>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-3 max-w-2xl">
                  <span className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs sm:text-sm font-medium text-white/95 backdrop-blur-sm">
                    👗 ThreadCraft · Clothing Shopping
                  </span>
                  <span className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs sm:text-sm font-medium text-white/95 backdrop-blur-sm">
                    💼 HirePulse · Job Search
                  </span>
                  <span className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs sm:text-sm font-medium text-white/95 backdrop-blur-sm">
                    📄 ClearBrief · Research Summarisation
                  </span>
                  <span className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs sm:text-sm font-medium text-white/95 backdrop-blur-sm">
                    🏖 StayVista · Travel Planning
                  </span>
                </div>

                <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
                  <Link
                    href="/install"
                    className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-6 text-sm font-semibold text-[#170404] hover:bg-[#F3EEF4] transition-colors shadow-lg"
                  >
                    ✦ Add Browsy to Browser
                  </Link>
                  <button
                    type="button"
                    onClick={() => switchToDemo("shopping")}
                    className="inline-flex h-12 items-center justify-center rounded-xl border border-white/30 bg-white/10 px-6 text-sm font-semibold text-white hover:bg-white/20 transition-colors cursor-pointer"
                  >
                    ↺ Replay Complete Walkthrough
                  </button>
                </div>
              </div>
            ) : (
              /* ═══ CINEMATIC SPLIT VIEWPORT WITH CAMERA ZOOM CANVAS ═══ */
              <div
                ref={viewportRef}
                className="relative min-h-[580px] lg:h-[620px] bg-[#FAF7F2] overflow-hidden"
              >
                <div
                  ref={canvasRef}
                  style={{
                    transform: `translate3d(${cameraTransform.tx}px, ${cameraTransform.ty}px, 0) scale(${cameraTransform.scale})`,
                    transformOrigin: "0 0",
                  }}
                  className={`cinematic-camera grid grid-cols-1 lg:grid-cols-12 min-h-[580px] lg:h-[620px] w-full transition-opacity duration-200 ${
                    isTransitioning ? "opacity-60" : "opacity-100"
                  }`}
                >
                  {/* Left Website Column (7 Columns) */}
                  <div className="relative lg:col-span-7 flex flex-col justify-between bg-[#FAF7F2] p-6 sm:p-7 border-b lg:border-b-0 lg:border-r border-[#170404]/10 lg:h-[620px] lg:overflow-y-auto">
                    {/* Floating Compact Launcher Pill (Visible during websiteOverview) */}
                    {sceneState === "websiteOverview" && (
                      <div className="absolute bottom-6 right-6 z-10 animate-fade-in">
                        <div className="inline-flex items-center gap-2 rounded-full border border-[#B84A79]/40 bg-[#170404] px-4 py-2 text-xs font-semibold text-[#FFFFFC] shadow-xl">
                          <span className="text-[#FFB6C1]">✦</span>
                          <span>Browsy</span>
                          <span className="rounded bg-[#B84A79] px-1.5 py-0.5 text-[10px] uppercase font-bold text-white">
                            Assistant
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Scene 1: ThreadCraft Apparel */}
                    {activeDemoKey === "shopping" && (
                      <div className="space-y-5">
                        <div className="flex items-center justify-between border-b border-[#170404]/10 pb-4">
                          <div>
                            <span className="text-xs font-bold uppercase tracking-wider text-[#9E506E]">
                              ThreadCraft Apparel ({activeDemo.domain})
                            </span>
                            <h3 className="text-xl sm:text-2xl font-bold text-[#170404] mt-0.5">
                              {stage === "result"
                                ? "Men's Checked Shirts (Filtered Results)"
                                : "ThreadCraft Official Storefront"}
                            </h3>
                          </div>
                          <span
                            className={`rounded-full border px-3.5 py-1 text-xs font-semibold transition-all ${
                              stage === "result"
                                ? "border-emerald-600/40 bg-emerald-50 text-emerald-900"
                                : "border-[#170404]/15 bg-white text-[#170404]"
                            }`}
                          >
                            {stage === "result"
                              ? "Size: XL · Under ₹1,000 ✓"
                              : "Store Homepage"}
                          </span>
                        </div>

                        {stage !== "result" ? (
                          <div className="space-y-4">
                            <div className="rounded-2xl bg-gradient-to-r from-[#4B152D] via-[#9E3B66] to-[#E28775] p-7 text-white shadow-sm">
                              <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
                                Seasonal Archive Edit
                              </p>
                              <h4 className="mt-1.5 text-2xl sm:text-3xl font-bold">
                                Everyday Wardrobe Essentials
                              </h4>
                              <p className="mt-2 text-sm text-white/90 leading-relaxed">
                                Curated 100% cotton casuals, flannels, and Oxford shirts with direct store filters.
                              </p>
                            </div>
                            <div className="grid grid-cols-2 gap-3.5">
                              <div className="rounded-xl border border-[#170404]/10 bg-white p-4">
                                <p className="text-xs font-bold text-[#9E506E]">
                                  MEN&apos;S CASUALS
                                </p>
                                <p className="text-base font-semibold text-[#170404] mt-1">
                                  Checked & Tartan Shirts
                                </p>
                                <p className="text-xs text-[#8C7A7E] mt-1">
                                  Starting ₹749 · Sizes S–XXL
                                </p>
                              </div>
                              <div className="rounded-xl border border-[#170404]/10 bg-white p-4">
                                <p className="text-xs font-bold text-[#170404]/60">
                                  WORKWEAR
                                </p>
                                <p className="text-base font-semibold text-[#170404] mt-1">
                                  Solid Oxford Shirts
                                </p>
                                <p className="text-xs text-[#8C7A7E] mt-1">
                                  Min. 40% Off · All Sizes
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 animate-result-reveal">
                            {[
                              {
                                title: "Roadster Red Buffalo Checked Shirt",
                                meta: "100% Cotton · Size: XL",
                                price: "₹799",
                                badge: "✓ Verified: Red + Checked + XL ≤ ₹1,000",
                                matched: true,
                              },
                              {
                                title: "Highlander Crimson Red Checked Shirt",
                                meta: "Cotton Blend · Size: XL",
                                price: "₹899",
                                badge: "✓ Verified: Red + Checked + XL ≤ ₹1,000",
                                matched: true,
                              },
                              {
                                title: "Dennis Lingo Ruby Red Gingham Shirt",
                                meta: "Washed Cotton · Size: XL",
                                price: "₹749",
                                badge: "✓ Verified: Red + Checked + XL ≤ ₹1,000",
                                matched: true,
                              },
                              {
                                title: "WROGN Men Deep Maroon Plaid Shirt",
                                meta: "Twill Fabric · Size: XL",
                                price: "₹949",
                                badge: "XL ≤ ₹1,000 (Maroon Plaid — Not Red)",
                                matched: false,
                              },
                            ].map((item) => (
                              <div
                                key={item.title}
                                className={`rounded-xl border bg-white p-4 transition-all duration-300 ${
                                  item.matched
                                    ? "border-[#B84A79] ring-2 ring-[#B84A79]/30 shadow-md"
                                    : "border-[#170404]/10 opacity-75"
                                }`}
                              >
                                <p className="text-sm font-bold text-[#170404]">
                                  {item.title}
                                </p>
                                <p className="text-xs text-[#8C7A7E] mt-1">
                                  {item.meta}
                                </p>
                                <p className="text-base font-bold text-[#170404] mt-2">
                                  {item.price}
                                </p>
                                <span
                                  className={`mt-2.5 inline-block rounded-md px-2.5 py-1 text-xs font-semibold ${
                                    item.matched
                                      ? "bg-emerald-50 text-emerald-800"
                                      : "bg-zinc-100 text-zinc-600"
                                  }`}
                                >
                                  {item.badge}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Scene 2: HirePulse Tech Careers */}
                    {activeDemoKey === "jobs" && (
                      <div className="space-y-5">
                        <div className="flex items-center justify-between border-b border-[#170404]/10 pb-4">
                          <div>
                            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                              HirePulse Tech Careers ({activeDemo.domain})
                            </span>
                            <h3 className="text-xl sm:text-2xl font-bold text-[#170404] mt-0.5">
                              {stage === "result"
                                ? "Filtered: Data Analyst · Hyderabad · 0–2 Yrs"
                                : "Open Analytics & Engineering Board"}
                            </h3>
                          </div>
                          <span
                            className={`rounded-full border px-3.5 py-1 text-xs font-semibold ${
                              stage === "result"
                                ? "border-blue-600/30 bg-blue-50 text-blue-900"
                                : "border-[#170404]/15 bg-white text-[#170404]"
                            }`}
                          >
                            {stage === "result" ? "3 Matching Roles ✓" : "Unfiltered Board"}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs sm:text-sm">
                          <div
                            className={`rounded-xl border p-3 transition-colors ${
                              stage === "result"
                                ? "border-blue-600 bg-blue-50/80 font-semibold text-blue-950"
                                : "border-[#170404]/12 bg-white text-[#170404]/75"
                            }`}
                          >
                            🔍 Role:{" "}
                            <strong>{stage === "result" ? "Data Analyst ✓" : "All Roles"}</strong>
                          </div>
                          <div
                            className={`rounded-xl border p-3 transition-colors ${
                              stage === "result"
                                ? "border-blue-600 bg-blue-50/80 font-semibold text-blue-950"
                                : "border-[#170404]/12 bg-white text-[#170404]/75"
                            }`}
                          >
                            📍 Location:{" "}
                            <strong>{stage === "result" ? "Hyderabad, TS ✓" : "All Cities"}</strong>
                          </div>
                          <div
                            className={`rounded-xl border p-3 transition-colors ${
                              stage === "result"
                                ? "border-blue-600 bg-blue-50/80 font-semibold text-blue-950"
                                : "border-[#170404]/12 bg-white text-[#170404]/75"
                            }`}
                          >
                            ⏳ Experience:{" "}
                            <strong>{stage === "result" ? "0–2 yrs ✓" : "All Levels"}</strong>
                          </div>
                        </div>

                        <div className={`space-y-3 ${stage === "result" ? "animate-result-reveal" : ""}`}>
                          {[
                            {
                              role: "Junior Data Analyst — BI & SQL",
                              company: "QuantGrid Analytics · Hyderabad (HITEC City)",
                              exp: "0 – 1 yr exp",
                              comp: "₹6.5L – ₹8.5L PA · SQL, Python, PowerBI",
                            },
                            {
                              role: "Associate Data Analyst (Product Metrics)",
                              company: "Veridian FinTech · Hyderabad (Gachibowli)",
                              exp: "1 – 2 yrs exp",
                              comp: "₹7.0L – ₹9.5L PA · Tableau, Cohort Analysis",
                            },
                            {
                              role: "Graduate Data Operations Analyst",
                              company: "CloudPulse Health · Hyderabad (Madhapur)",
                              exp: "Fresher / 0 – 1 yr",
                              comp: "₹5.5L – ₹7.2L PA · Excel, PostgreSQL",
                            },
                          ].map((job) => (
                            <div
                              key={job.role}
                              className={`rounded-xl border bg-white p-4 ${
                                stage === "result"
                                  ? "border-blue-600/70 ring-1 ring-blue-500/20 shadow-sm"
                                  : "border-[#170404]/10"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-bold text-[#170404]">
                                    {job.role}
                                  </p>
                                  <p className="text-xs sm:text-sm text-[#170404]/75 mt-0.5">
                                    {job.company}
                                  </p>
                                </div>
                                <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                                  {job.exp}
                                </span>
                              </div>
                              <p className="mt-2 text-xs sm:text-sm text-[#8C7A7E]">
                                {job.comp}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Scene 3: ClearBrief Systems Monograph */}
                    {activeDemoKey === "research" && (
                      <div className="space-y-5">
                        <div className="flex items-center justify-between border-b border-[#170404]/10 pb-4">
                          <div>
                            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                              ClearBrief Systems Monograph ({activeDemo.domain})
                            </span>
                            <h3 className="text-xl sm:text-2xl font-bold text-[#170404] mt-0.5">
                              Core Principles & Trade-offs of Cloud Computing
                            </h3>
                          </div>
                          <span className="rounded-full border border-indigo-600/30 bg-indigo-50 px-3.5 py-1 text-xs font-semibold text-indigo-900">
                            3 Visible Sections · 1 Locked Section
                          </span>
                        </div>

                        <div className="space-y-3 text-sm">
                          <div
                            className={`rounded-xl border bg-white p-4 transition-all ${
                              stage === "result"
                                ? "border-indigo-600/80 bg-indigo-50/40 ring-1 ring-indigo-500/20"
                                : "border-[#170404]/10"
                            }`}
                          >
                            <p className="font-bold text-[#170404]">
                              1. On-Demand Elasticity & Resource Pooling
                            </p>
                            <p className="mt-1.5 text-[#170404]/80 leading-relaxed">
                              Workloads scale horizontally in minutes using shared multi-tenant hardware, converting fixed capital expenditure (CapEx) into metered operational expenditure (OpEx).
                            </p>
                          </div>

                          <div
                            className={`rounded-xl border bg-white p-4 transition-all ${
                              stage === "result"
                                ? "border-indigo-600/80 bg-indigo-50/40 ring-1 ring-indigo-500/20"
                                : "border-[#170404]/10"
                            }`}
                          >
                            <p className="font-bold text-[#170404]">
                              2. Service Abstraction Layers (IaaS, PaaS, SaaS)
                            </p>
                            <p className="mt-1.5 text-[#170404]/80 leading-relaxed">
                              IaaS provides raw compute VMs and VPC networks; PaaS automates runtime environments and database scaling; SaaS delivers turnkey applications without maintenance overhead.
                            </p>
                          </div>

                          <div
                            className={`rounded-xl border bg-white p-4 transition-all ${
                              stage === "result"
                                ? "border-indigo-600/80 bg-indigo-50/40 ring-1 ring-indigo-500/20"
                                : "border-[#170404]/10"
                            }`}
                          >
                            <p className="font-bold text-[#170404]">
                              3. Cost Governance, Egress & Vendor Lock-In
                            </p>
                            <p className="mt-1.5 text-[#170404]/80 leading-relaxed">
                              Sustained high-utilization clusters and cross-region egress fees require proactive FinOps monitoring and containerized architectures for portability.
                            </p>
                          </div>

                          <div className="rounded-xl border border-dashed border-amber-600/50 bg-amber-50/80 p-3.5 text-xs text-amber-950">
                            <strong>🔒 Section 4 — Multi-Region Latency Raw Telemetry CSV:</strong>{" "}
                            Requires institutional login and external download (not visible in the active DOM).
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Scene 4: StayVista Travel Escapes */}
                    {activeDemoKey === "travel" && (
                      <div className="space-y-5">
                        <div className="flex items-center justify-between border-b border-[#170404]/10 pb-4">
                          <div>
                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                              StayVista Escapes ({activeDemo.domain})
                            </span>
                            <h3 className="text-xl sm:text-2xl font-bold text-[#170404] mt-0.5">
                              {stage === "result"
                                ? "Stays Near Hyderabad (Under ₹5,000 / Night)"
                                : "Regional Weekend Getaways & Retreats"}
                            </h3>
                          </div>
                          <span
                            className={`rounded-full border px-3.5 py-1 text-xs font-semibold ${
                              stage === "result"
                                ? "border-emerald-600/30 bg-emerald-50 text-emerald-900"
                                : "border-[#170404]/15 bg-white text-[#170404]"
                            }`}
                          >
                            {stage === "result" ? "4 Filtered Stays ✓" : "11 Regional Stays"}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs sm:text-sm">
                          <div
                            className={`rounded-xl border p-3 transition-colors ${
                              stage === "result"
                                ? "border-emerald-600 bg-emerald-50/80 font-semibold text-emerald-950"
                                : "border-[#170404]/12 bg-white text-[#170404]/75"
                            }`}
                          >
                            📍 Destination:{" "}
                            <strong>{stage === "result" ? "Near Hyderabad (≤ 150 km) ✓" : "All Regions"}</strong>
                          </div>
                          <div
                            className={`rounded-xl border p-3 transition-colors ${
                              stage === "result"
                                ? "border-emerald-600 bg-emerald-50/80 font-semibold text-emerald-950"
                                : "border-[#170404]/12 bg-white text-[#170404]/75"
                            }`}
                          >
                            ₹ Price Cap:{" "}
                            <strong>{stage === "result" ? "Under ₹5,000 / night ✓" : "Any Price"}</strong>
                          </div>
                          <div className="rounded-xl border border-amber-500/40 bg-amber-50/70 p-3 text-xs sm:text-sm text-amber-950">
                            📅 Dates: <strong>Unspecified Weekend</strong>
                          </div>
                        </div>

                        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3.5 ${stage === "result" ? "animate-result-reveal" : ""}`}>
                          {[
                            {
                              name: "Forest Canopy Eco Cottage",
                              loc: "Ananthagiri Hills · 68 km from Hyderabad",
                              price: "₹3,850 / night",
                              meta: "4.7 ★ · Breakfast included · Free cancellation",
                            },
                            {
                              name: "Shamirpet Lakeview Courtyard",
                              loc: "Shamirpet · 28 km from Hyderabad",
                              price: "₹4,450 / night",
                              meta: "4.5 ★ · Garden deck · Pool access",
                            },
                            {
                              name: "Deccan Terracotta Farmstay",
                              loc: "Moinabad · 34 km from Hyderabad",
                              price: "₹4,200 / night",
                              meta: "4.6 ★ · Private lawn · Organic meals",
                            },
                            {
                              name: "Backwater Heritage Pavilion",
                              loc: "Nagarjuna Sagar · 145 km from Hyderabad",
                              price: "₹4,750 / night",
                              meta: "4.4 ★ · Lake view · River rafting nearby",
                            },
                          ].map((stay) => (
                            <div
                              key={stay.name}
                              className={`rounded-xl border bg-white p-4 ${
                                stage === "result"
                                  ? "border-emerald-600/70 ring-1 ring-emerald-500/20 shadow-sm"
                                  : "border-[#170404]/10"
                              }`}
                            >
                              <p className="text-sm sm:text-base font-bold text-[#170404]">
                                {stay.name}
                              </p>
                              <p className="text-xs sm:text-sm text-[#8C7A7E] mt-0.5">
                                {stay.loc}
                              </p>
                              <p className="mt-2 text-base font-bold text-emerald-900">
                                {stay.price}
                              </p>
                              <p className="mt-1 text-xs text-[#170404]/75">
                                {stay.meta}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bottom On-Screen Scenario Message Bar */}
                    <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-[#170404] px-5 py-4 text-[#FFFFFC]">
                      <div>
                        <p className="text-sm font-semibold text-[#F3BFD4]">
                          {activeDemo.label} · {activeDemo.closingMessage}
                        </p>
                        <p className="text-xs sm:text-sm text-[#FFFFFC]/80 mt-0.5">
                          Domain: <code className="text-[#FFB6C1]">{activeDemo.domain}</code> — Same Browsy assistant, safely adapted to this website.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handlePrimaryStageAction}
                        className="shrink-0 rounded-lg bg-[#B84A79] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#a13d68] transition-colors cursor-pointer"
                      >
                        {stage === "start"
                          ? "Inspect Proposed Plan →"
                          : stage === "plan"
                          ? activeDemoKey === "research"
                            ? "View Grounded Summary →"
                            : "⚡ Approve & Run →"
                          : activeDemo.nextLabel || "↺ Replay from Start"}
                      </button>
                    </div>
                  </div>

                  {/* Right Browsy Assistant Column (5 Columns) */}
                  <aside
                    aria-label="Simulated Browsy Assistant Panel"
                    className="lg:col-span-5 bg-[#FAF8F5] flex flex-col p-5 sm:p-6 lg:h-[620px] overflow-hidden"
                  >
                    {/* Assistant Header */}
                    <div className="shrink-0 flex items-center justify-between border-b border-[#170404]/10 pb-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#170404] text-sm text-[#FFFFFC] shadow-sm">
                            ✦
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-bold text-[#170404]">
                                Browsy Assistant
                              </span>
                              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                            </div>
                            <p className="text-xs text-[#8C7A7E]">
                              Active Tab: {activeDemo.domain}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-colors ${
                            stage === "result"
                              ? "border-emerald-600/30 bg-emerald-50 text-emerald-800"
                              : stage === "plan"
                              ? "border-amber-600/30 bg-amber-50 text-amber-900"
                              : "border-[#170404]/15 bg-[#F3EEF4] text-[#5A2540]"
                          }`}
                        >
                          {stage === "result"
                            ? "VERIFIED OUTCOME ✓"
                            : stage === "plan"
                            ? "APPROVAL BARRIER"
                            : "INPUT STAGE"}
                        </span>
                      </div>

                      {/* Conversation Flow Stream */}
                      <div className="flex-1 overflow-y-auto mt-4 space-y-4 text-sm pr-1 scrollbar-thin">
                        {/* User Request Bubble: Renders when submitted or during plan/result */}
                        {stage !== "start" && (
                          <div className="ml-auto max-w-[92%] rounded-2xl bg-[#170404] px-4 py-3 text-sm text-[#FFFFFC] shadow-sm animate-fade-in">
                            {activeDemo.request}
                          </div>
                        )}

                        {/* Step 1 Explanatory Card (Visible during compose) */}
                        {stage === "start" && (
                          <div className="rounded-xl border border-[#B84A79]/40 bg-[#FBF4F7] p-4 sm:p-5 space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="font-bold text-[#170404] text-sm sm:text-base">
                                Step 1 of 3 · Visible Typing Sequence
                              </p>
                              <span className="rounded-md bg-[#B84A79]/15 px-2 py-0.5 text-xs font-semibold text-[#9E506E]">
                                {isTypingDone ? "Ready to Submit" : "Typing..."}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-[#170404]/80 leading-relaxed">
                              Watch the request appear character-by-character into the message composer below, then observe how Browsy interprets intent and page context.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setTypedLength(activeDemo.request.length);
                                setSceneState("requestSubmitted");
                              }}
                              className="w-full rounded-xl bg-[#170404] py-2.5 text-xs sm:text-sm font-semibold text-[#FFFFFC] hover:bg-black transition-colors cursor-pointer"
                            >
                              Skip Typing & Submit Request →
                            </button>
                          </div>
                        )}

                        {/* Interpreted Criteria Card */}
                        {(sceneState === "understandingIntent" ||
                          sceneState === "reviewingActionPlan" ||
                          sceneState === "awaitingApproval" ||
                          sceneState === "executingActions") && (
                          <div className="rounded-xl border border-[#170404]/12 bg-white p-4 shadow-sm animate-fade-in">
                            <div className="flex items-center justify-between mb-2.5">
                              <span className="text-xs font-bold uppercase tracking-wider text-[#170404]">
                                Interpreted Criteria & Constraints
                              </span>
                              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                PARSED DOM
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2.5">
                              {activeDemo.interpretedCriteria.map((c) => (
                                <div key={c.label} className="rounded-lg bg-[#FAF8F5] p-2.5">
                                  <span className="block text-xs text-[#8C7A7E]">{c.label}</span>
                                  <span className="text-xs sm:text-sm font-semibold text-[#170404]">
                                    {c.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Proposed Action Plan Card (Awaiting Approval) */}
                        {(sceneState === "reviewingActionPlan" ||
                          sceneState === "awaitingApproval") && (
                          <div
                            ref={planCardRef}
                            className="rounded-xl border-2 border-[#B84A79] bg-white p-4 space-y-3 shadow-md animate-fade-in"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wider text-[#170404]">
                                Proposed Action Plan
                              </span>
                              <span className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 animate-pulse">
                                AWAITING HUMAN APPROVAL
                              </span>
                            </div>
                            <ol className="list-decimal list-inside space-y-1.5 text-xs sm:text-sm text-[#170404]/85">
                              {activeDemo.actionPlanSteps.map((step, idx) => (
                                <li key={idx}>{step}</li>
                              ))}
                            </ol>
                            <button
                              type="button"
                              onClick={() => setSceneState("executingActions")}
                              className="w-full rounded-xl bg-[#B84A79] py-3 text-sm font-semibold text-white hover:bg-[#a13d68] transition-all cursor-pointer shadow-md hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                            >
                              <span>⚡</span>
                              <span>Approve & Run with Browsy</span>
                            </button>
                          </div>
                        )}

                        {/* Live Execution Progress Checklist */}
                        {sceneState === "executingActions" && (
                          <div className="rounded-xl border-2 border-[#B84A79] bg-white p-4 space-y-3 shadow-md animate-fade-in">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wider text-[#170404]">
                                Executing Approved Actions
                              </span>
                              <span className="rounded-md bg-[#B84A79]/15 px-2.5 py-1 text-xs font-semibold text-[#9E506E]">
                                LIVE EXECUTION
                              </span>
                            </div>
                            <div className="space-y-2 text-xs sm:text-sm">
                              {activeDemo.executionChecklist.map((step, idx) => {
                                const isCompleted = executionStepIndex > idx;
                                const isCurrent = executionStepIndex === idx;
                                return (
                                  <div
                                    key={idx}
                                    className={`flex items-center gap-2.5 rounded-lg p-2 transition-all ${
                                      isCompleted
                                        ? "bg-emerald-50 text-emerald-950 font-medium"
                                        : isCurrent
                                        ? "bg-[#FAF8F5] text-[#170404] font-semibold ring-1 ring-[#B84A79]/30"
                                        : "text-[#170404]/50"
                                    }`}
                                  >
                                    <span className="w-5 text-center text-xs">
                                      {isCompleted ? "✓" : isCurrent ? "⏳" : "○"}
                                    </span>
                                    <span className="truncate">{step}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Verified Outcome Card */}
                        {(sceneState === "cameraZoomingOut" ||
                          sceneState === "revealingResults" ||
                          sceneState === "sceneComplete") && (
                          <div className="rounded-xl border-2 border-emerald-600/40 bg-white p-4 space-y-3 shadow-md animate-fade-in">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wider text-[#170404]">
                                {activeDemo.outcomeSummary.title}
                              </span>
                              <span className="rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900">
                                ✓ Done — Verified
                              </span>
                            </div>
                            <div className="space-y-2 text-xs sm:text-sm leading-relaxed">
                              <p>
                                <strong>✓ Completed & Verified:</strong> {activeDemo.outcomeSummary.completed}
                              </p>
                              <p>
                                <strong>✓ Evaluated:</strong> {activeDemo.outcomeSummary.evaluation}
                              </p>
                              <p className="text-amber-900 bg-amber-50/80 p-2.5 rounded-lg text-xs">
                                <strong>⚠ Limitation / Safety Boundary:</strong> {activeDemo.outcomeSummary.limitation}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              {activeDemo.nextKey ? (
                                <button
                                  type="button"
                                  onClick={() => switchToDemo(activeDemo.nextKey!)}
                                  className="w-full rounded-xl bg-[#170404] py-2.5 text-xs sm:text-sm font-semibold text-[#FFFFFC] hover:bg-black transition-colors cursor-pointer shadow-sm"
                                >
                                  {activeDemo.nextLabel}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={replayCompleteDemonstration}
                                  className="w-full rounded-xl bg-[#170404] py-2.5 text-xs sm:text-sm font-semibold text-[#FFFFFC] hover:bg-black transition-colors cursor-pointer shadow-sm"
                                >
                                  ↺ Replay from Start
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                    {/* Real Controlled Input Composer */}
                    <div className="shrink-0 mt-3 pt-3 border-t border-[#170404]/10">
                      <div
                        ref={composerContainerRef}
                        id="browsy-composer-container"
                        className={`relative flex items-center justify-between rounded-xl border-2 bg-white px-3.5 py-2.5 transition-all duration-300 ${
                          sceneState === "cameraZoomingIn" || sceneState === "typingRequest"
                            ? "border-[#B84A79] ring-4 ring-[#B84A79]/20 shadow-md"
                            : "border-[#170404]/20"
                        }`}
                      >
                        <div className="flex items-center min-w-0 flex-1 relative">
                          <input
                            ref={composerInputRef}
                            id="browsy-composer-input"
                            type="text"
                            readOnly
                            value={currentTypedText}
                            aria-label="Ask Browsy anything on this page"
                            placeholder={
                              stage === "start" && !currentTypedText
                                ? "Ask Browsy anything on this page..."
                                : ""
                            }
                            className="w-full bg-transparent text-[#170404] font-medium text-xs sm:text-sm placeholder-[#8C7A7E] outline-none border-none p-0 m-0 focus:outline-none focus:ring-0"
                          />
                          {sceneState === "typingRequest" && !isTypingDone && (
                            <span
                              aria-hidden="true"
                              className="inline-block w-0.5 h-4 bg-[#B84A79] animate-pulse shrink-0 ml-0.5"
                            />
                          )}
                        </div>
                        <button
                          ref={sendButtonRef}
                          type="button"
                          onClick={handlePrimaryStageAction}
                          id="browsy-send-button"
                          aria-label="Send message"
                          className={`ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all cursor-pointer ${
                            sceneState === "typingRequest" && isTypingDone
                              ? "bg-[#B84A79] text-white ring-2 ring-[#B84A79]/40 scale-110 shadow-sm"
                              : "bg-[#170404] text-[#FFFFFC]"
                          }`}
                          title="Send message"
                        >
                          ↑
                        </button>
                      </div>
                    </div>
                  </aside>

                  {/* Virtual Animated Cursor — Anchored in the Camera Canvas coordinate space */}
                  {cursor.visible && !isUserHovering && (
                    <div
                      className="pointer-events-none absolute z-50 transition-all duration-500 ease-out"
                      style={{
                        left: `${cursor.x}%`,
                        top: `${cursor.y}%`,
                        opacity: cursor.visible ? 1 : 0,
                        transform: cursor.clicking ? "scale(0.85)" : "scale(1)",
                      }}
                    >
                      <svg
                        width="26"
                        height="26"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="drop-shadow-lg"
                      >
                        <path
                          d="M3 3L10.07 20.97L12.58 13.58L19.97 11.07L3 3Z"
                          fill="#170404"
                          stroke="#FFFFFC"
                          strokeWidth="1.6"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {cursor.clicking && (
                        <span className="absolute -left-2 -top-2 h-8 w-8 rounded-full bg-[#B84A79]/50 animate-cursor-ripple pointer-events-none" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Bottom Conversion Bar */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-[#170404]/10 bg-[#FAF8F9] px-6 py-5 text-sm sm:text-base text-[#170404]/80">
        <span>
          Browsy works beside your active browser tab across shopping, jobs, research, and travel sites—always waiting for your approval.
        </span>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            href="/install"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[#170404] bg-[#170404] px-5 text-sm font-semibold text-[#FFFFFC] hover:bg-black transition-colors"
          >
            Add to Browser
          </Link>
          <button
            type="button"
            onClick={() => setMode(mode === "video" ? "interactive" : "video")}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[#170404]/25 bg-white px-5 text-sm font-semibold text-[#170404] hover:bg-[#F7F2F4] transition-colors cursor-pointer"
          >
            {mode === "video" ? "Try Interactive Step-by-Step" : "Watch Cinematic Video (80s)"}
          </button>
        </div>
      </div>
    </div>
  );
}
