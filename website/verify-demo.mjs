import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9225;
const TARGET_URL = "http://localhost:3000";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (e) {
      // retry
    }
    await sleep(250);
  }
  throw new Error(`Timeout waiting for HTTP ${url}`);
}

async function main() {
  console.log("=== BROWSY CINEMATIC DEMO AUTOMATED VERIFICATION ===");

  // 1. Launch Chrome Headless
  console.log("1. Spawning Chrome headless on port", PORT);
  const chromeProcess = spawn(CHROME_PATH, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--window-size=1440,900",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ], {
    stdio: "ignore",
  });

  try {
    await waitForHttp(`http://localhost:${PORT}/json/version`);

    const newTabRes = await fetch(`http://localhost:${PORT}/json/new?${TARGET_URL}`, { method: "PUT" });
    const tabInfo = await newTabRes.json();
    console.log("2. Connected to tab at:", TARGET_URL);

    const ws = new WebSocket(tabInfo.webSocketDebuggerUrl);

    let messageId = 0;
    const pendingPromises = new Map();
    const consoleLogs = [];
    const diagnosticLogs = [];
    const hydrationWarnings = [];

    const sendCdp = (method, params = {}) => {
      const id = ++messageId;
      return new Promise((resolve, reject) => {
        pendingPromises.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    };

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pendingPromises.has(msg.id)) {
        const { resolve } = pendingPromises.get(msg.id);
        pendingPromises.delete(msg.id);
        resolve(msg.result);
      } else if (msg.method === "Runtime.consoleAPICalled") {
        const text = msg.params.args.map((a) => (a.value !== undefined ? a.value : JSON.stringify(a))).join(" ");
        consoleLogs.push(text);
        if (text.includes("[Browsy Demo Diagnostics]")) {
          diagnosticLogs.push(text);
          console.log("   [DIAGNOSTIC EVENT]", text);
        }
        if (text.toLowerCase().includes("hydration") || text.includes("did not match")) {
          hydrationWarnings.push(text);
          console.log("   [HYDRATION WARNING]", text);
        }
      }
    };

    await sendCdp("Runtime.enable");
    await sendCdp("Page.enable");

    console.log("3. Monitoring typing & bounding box geometry across 6 seconds...");

    const typingSamples = [];
    let composerClampedProperly = true;
    let worstBottomDiff = 999;
    let worstRightDiff = 999;

    const startTime = Date.now();
    while (Date.now() - startTime < 6500) {
      const evalRes = await sendCdp("Runtime.evaluate", {
        expression: `(() => {
          const input = document.getElementById("browsy-composer-input");
          const container = document.getElementById("browsy-composer-container");
          const vp = document.querySelector(".cinematic-camera")?.parentElement;
          if (!input || !container || !vp) return null;
          const iRect = input.getBoundingClientRect();
          const cRect = container.getBoundingClientRect();
          const vRect = vp.getBoundingClientRect();
          return {
            inputValue: input.value,
            inputVisible: iRect.width > 0 && iRect.height > 0,
            composerBottom: Math.round(cRect.bottom),
            viewportBottom: Math.round(vRect.bottom),
            diffBottom: Math.round(vRect.bottom - cRect.bottom),
            diffRight: Math.round(vRect.right - cRect.right),
            isClippedBottom: cRect.bottom > vRect.bottom + 1,
            isClippedRight: cRect.right > vRect.right + 1,
          };
        })()`,
        returnByValue: true,
      });

      if (evalRes?.result?.value) {
        const data = evalRes.result.value;
        if (data.inputValue && !typingSamples.includes(data.inputValue)) {
          typingSamples.push(data.inputValue);
          console.log(`   [TYPING IN PROGRESS] Length ${data.inputValue.length}: "${data.inputValue}"`);
        }
        if (data.diffBottom < worstBottomDiff) worstBottomDiff = data.diffBottom;
        if (data.diffRight < worstRightDiff) worstRightDiff = data.diffRight;
        if (data.isClippedBottom || data.isClippedRight) {
          composerClampedProperly = false;
        }
      }
      await sleep(120);
    }

    console.log("4. Shopping Verification Summary:");
    console.log("   Total Typing Samples Observed:", typingSamples.length);
    console.log("   First Sample:", typingSamples[0] || "(none)");
    console.log("   Final Sample:", typingSamples[typingSamples.length - 1] || "(none)");
    console.log("   Composer Clamped Inside Viewport (Zero Bottom Clipping):", composerClampedProperly);
    console.log("   Composer Safety Margin Bottom (pixels inside):", worstBottomDiff);
    console.log("   Composer Safety Margin Right (pixels inside):", worstRightDiff);

    // Capture screenshot of shopping typing state
    const screenshot1 = await sendCdp("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync("./shopping-typing.png", Buffer.from(screenshot1.data, "base64"));
    console.log("   Saved screenshot: shopping-typing.png");

    // 5. Test switching to HirePulse / Jobs scenario
    console.log("5. Testing Scenario Isolation: Clicking #browsy-scenario-tab-jobs...");
    const clickRes = await sendCdp("Runtime.evaluate", {
      expression: `(() => {
        const tab = document.getElementById("browsy-scenario-tab-jobs");
        if (tab) {
          tab.click();
          return { clicked: true, text: tab.textContent.trim() };
        }
        return { clicked: false };
      })()`,
      returnByValue: true,
    });
    console.log("   Clicked Tab:", clickRes?.result?.value);

    await sleep(1500);

    const jobsCheckRes = await sendCdp("Runtime.evaluate", {
      expression: `(() => {
        const text = document.body.innerText;
        return {
          hasHirePulseDomain: text.includes("hirepulse.jobs") || text.includes("hirepulse.io"),
          hasRazorpayRole: text.includes("Razorpay") && text.includes("Senior Frontend Engineer"),
          hasSwiggyRole: text.includes("Swiggy") && text.includes("Product Designer"),
          hasZeptoRole: text.includes("Zepto") && text.includes("Staff Backend Engineer"),
          hasThreadcraftLeaking: text.includes("ThreadCraft"),
          hasShirtPromptLeaking: text.includes("red checked shirt"),
        };
      })()`,
      returnByValue: true,
    });
    console.log("   Jobs Scenario Check Outcome:", jobsCheckRes?.result?.value);

    // Capture screenshot of jobs scenario
    const screenshot2 = await sendCdp("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync("./jobs-scenario.png", Buffer.from(screenshot2.data, "base64"));
    console.log("   Saved screenshot: jobs-scenario.png");

    // 6. Test /sign-in route for hydration mismatch
    console.log("6. Testing /sign-in route for React hydration warnings...");
    await sendCdp("Page.navigate", { url: "http://localhost:3000/sign-in" });
    await sleep(2000);

    console.log("7. Final Check for React Hydration Warnings:");
    console.log("   Hydration Warnings Detected:", hydrationWarnings.length);
    if (hydrationWarnings.length > 0) {
      console.log("   Warnings:", hydrationWarnings);
    } else {
      console.log("   ZERO hydration warnings across both / and /sign-in!");
    }

    ws.close();
  } catch (err) {
    console.error("Verification error:", err);
  } finally {
    console.log("Closing Chrome...");
    chromeProcess.kill();
  }
}

main();
