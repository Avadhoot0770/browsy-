import { performance } from "node:perf_hooks";
import {
  collectAccessibleRoots,
  extractPdpSizeOptions,
} from "../src/execution/product-verifier";

class MockElement {
  public tagName: string;
  public className = "";
  public textContent = "";
  public attributes = new Map<string, string>();
  public shadowRoot: MockShadowRoot | null = null;
  public children: MockElement[] = [];
  public disabled = false;
  public parentElement: MockElement | null = null;

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  public setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  public getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  public hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  public attachShadow(init: { mode: "open" | "closed" }): MockShadowRoot {
    const sr = new MockShadowRoot(this, init.mode);
    if (init.mode === "open") {
      this.shadowRoot = sr;
    } else {
      this.shadowRoot = null;
    }
    return sr;
  }

  public appendChild(child: MockElement): void {
    child.parentElement = this;
    this.children.push(child);
  }

  public querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];
    for (const child of this.children) {
      if (child.matches(selector)) results.push(child);
      results.push(...child.querySelectorAll(selector));
    }
    return results;
  }

  public matches(selector: string): boolean {
    if (selector === "*") return true;
    const s = selector.toLowerCase();
    const tag = this.tagName.toLowerCase();
    const cls = this.className.toLowerCase();
    if (s === tag) return true;
    if (s.startsWith(".") && cls.includes(s.slice(1).toLowerCase())) return true;
    if (s.includes("size") && (cls.includes("size") || tag.includes("size"))) return true;
    if (s.includes("option") && (tag === "option" || cls.includes("option"))) return true;
    if (s.includes("button") && (tag === "button" || cls.includes("button"))) return true;
    return false;
  }
}

class MockShadowRoot {
  public host: MockElement;
  public mode: "open" | "closed";
  public children: MockElement[] = [];

  constructor(host: MockElement, mode: "open" | "closed") {
    this.host = host;
    this.mode = mode;
  }

  public appendChild(child: MockElement): void {
    this.children.push(child);
  }

  public querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];
    for (const child of this.children) {
      if (child.matches(selector)) results.push(child);
      results.push(...child.querySelectorAll(selector));
    }
    return results;
  }
}

function runBenchmark(): void {
  const ITERATIONS = 500;

  // 1. Light DOM baseline (500 elements)
  const lightDomRoot = new MockElement("DIV");
  for (let i = 0; i < 500; i++) {
    const el = new MockElement("DIV");
    el.className = i % 10 === 0 ? "size-button" : "product-card";
    if (i % 10 === 0) el.textContent = "XL";
    lightDomRoot.appendChild(el);
  }

  // Warmup
  for (let i = 0; i < 50; i++) {
    collectAccessibleRoots(lightDomRoot as any, 15);
    extractPdpSizeOptions(lightDomRoot as any);
  }

  const t0 = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    collectAccessibleRoots(lightDomRoot as any, 15);
    extractPdpSizeOptions(lightDomRoot as any);
  }
  const t1 = performance.now();
  const lightDomAvgMs = (t1 - t0) / ITERATIONS;

  // 2. Realistic Web Component Storefront (Polymer pattern: 24 shadow roots across depth 1 & 2)
  const polymerRoot = new MockElement("SHOP-APP");
  const appShadow = polymerRoot.attachShadow({ mode: "open" });
  for (let i = 0; i < 22; i++) {
    const comp = new MockElement(`SHOP-ITEM-${i}`);
    const sr = comp.attachShadow({ mode: "open" });
    const btn = new MockElement("BUTTON");
    btn.className = "size-btn";
    btn.textContent = "M";
    sr.appendChild(btn);
    appShadow.appendChild(comp);
  }
  const detail = new MockElement("SHOP-DETAIL");
  const detailSr = detail.attachShadow({ mode: "open" });
  const select = new MockElement("SELECT");
  const optS = new MockElement("OPTION");
  optS.textContent = "S";
  const optXL = new MockElement("OPTION");
  optXL.textContent = "XL";
  select.appendChild(optS);
  select.appendChild(optXL);
  detailSr.appendChild(select);
  appShadow.appendChild(detail);

  const t2 = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    collectAccessibleRoots(polymerRoot as any, 15);
    extractPdpSizeOptions(polymerRoot as any);
  }
  const t3 = performance.now();
  const polymerAvgMs = (t3 - t2) / ITERATIONS;

  // 3. Deeply Nested Open Shadow Roots (20 levels, maxDepth=15 guard)
  const deepRoot = new MockElement("DEEP-0");
  let currHost = deepRoot;
  for (let d = 1; d <= 20; d++) {
    const sr = currHost.attachShadow({ mode: "open" });
    const nextHost = new MockElement(`DEEP-${d}`);
    sr.appendChild(nextHost);
    currHost = nextHost;
  }
  const deepLeaf = new MockElement("BUTTON");
  deepLeaf.className = "size-pill";
  deepLeaf.textContent = "XL";
  currHost.appendChild(deepLeaf);

  const t4 = performance.now();
  let deepRes: any;
  for (let i = 0; i < ITERATIONS; i++) {
    deepRes = collectAccessibleRoots(deepRoot as any, 15);
    extractPdpSizeOptions(deepRoot as any);
  }
  const t5 = performance.now();
  const deepAvgMs = (t5 - t4) / ITERATIONS;

  console.log("======================================================================");
  console.log("⚡ BROWSY REALISTIC PDP SHADOW DOM TRAVERSAL BENCHMARK (500 ITERATIONS)");
  console.log("======================================================================");
  console.log(`1. Standard Light DOM (500 nodes):               ${lightDomAvgMs.toFixed(3)} ms / extraction`);
  console.log(`2. Realistic Polymer Web Components (24 roots):  ${polymerAvgMs.toFixed(3)} ms / extraction`);
  console.log(`3. Deeply Nested Host (20 levels, maxDepth=15):  ${deepAvgMs.toFixed(3)} ms / extraction`);
  console.log(`   - Roots traversed in deep tree:               ${deepRes.shadowRootsEncountered} (Bounded strictly at 15)`);
  console.log("======================================================================\n");
}

runBenchmark();
