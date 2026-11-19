# Browsy — Browser Extension (MVP Shell)

**Browsy** is an AI-powered browser assistant that sits on top of whatever website you are already browsing.

> **"The web, your way."**

This is **Stage 1 (Real Product MVP Shell)** of the Browsy browser extension. It establishes the actual extension architecture, Manifest V3 registration, Shadow DOM style isolation, current-page awareness, and the floating launcher / slide-out assistant interaction model.

---

## 🏗️ Architecture

```
extension/
├── src/
│   ├── background/
│   │   └── service-worker.ts      # Manifest V3 service worker (messaging & lifecycle hub)
│   ├── content/
│   │   ├── content-script.tsx      # Mounts Browsy into isolated Shadow DOM root
│   │   ├── BrowsyLauncher.tsx      # Small floating pill launcher on the right viewport edge
│   │   ├── BrowsyPanel.tsx         # Slide-in assistant overlay drawer with current-page awareness
│   │   └── styles.css              # Isolated styles scoped strictly to Shadow DOM
│   ├── popup/
│   │   ├── index.html              # Extension toolbar action popup entry
│   │   ├── popup.tsx               # Toolbar action popup React app
│   │   └── popup.css               # Popup styling
│   ├── shared/
│   │   ├── constants.ts            # Branding, IDs, MVP responses
│   │   ├── messages.ts             # Typed cross-script messages (Content ↔ Background)
│   │   └── types.ts                # PageContext, ChatMessage, ExtensionState
│   └── vite-env.d.ts               # Inline CSS and Vite client declarations
├── public/
│   ├── icons/                      # 16x16, 32x32, 48x48, 128x128 icons
│   └── manifest.json               # Manifest V3 specification
├── scripts/
│   ├── build.mjs                   # Fast multi-bundle build script
│   ├── generate-icons.mjs          # Standalone icon generator
│   └── test-e2e.mjs                # Real Chromium automated end-to-end verification
├── dist/                           # Built, unpackable extension ready for Chrome/Brave
├── package.json
└── tsconfig.json
```

---

## 🔒 Security, Permissions & Style Isolation

1. **Manifest V3 Permissions**:
   - `activeTab`: Permits page context query on the user's active tab.
   - `storage`: Preserves assistant state.
   - **Zero Invasive Permissions**: No `tabs`, `history`, `bookmarks`, `downloads`, or web request interception.
2. **Shadow DOM Style Isolation**:
   - Browsy creates an isolated host element `<browsy-root id="browsy-extension-root">` and attaches an open `ShadowRoot`.
   - All styles are scoped inside the Shadow Root with `:host { all: initial; }`.
   - **Website styles cannot break Browsy, and Browsy styles cannot break the website.**
3. **Privacy**:
   - Browsy does **not** scrape passwords, form fields, keystrokes outside the assistant, or private content.
   - Detects only public metadata: `hostname`, `url`, and `title`.

---

## 🚀 How to Load and Test in Brave or Chrome

### Option A: Manual Loading (Developer Mode)
1. Build the extension:
   ```bash
   cd extension
   npm install
   npm run build
   ```
2. Open your Chromium-based browser (**Chrome**, **Brave**, or **Edge**).
3. Navigate to `chrome://extensions` (or `brave://extensions`).
4. Enable **Developer mode** toggle in the top-right corner.
5. Click **Load unpacked**.
6. Select the `extension/dist` folder:
   ```
   <repo-root>/extension/dist
   ```
7. Open any webpage (e.g. `https://myntra.com`, `https://en.wikipedia.org`, `https://news.ycombinator.com`).
8. You will see the floating **✦ Browsy** launcher on the right side of the screen.
9. Click the launcher to open the assistant, view detected page details, and type your request.

### Option B: Automated Real Browser E2E Test
You can run the automated verification script that boots a real browser with the unpacked extension and tests all 16 interaction requirements:
```bash
npm run test:e2e
```

---

## 🛠️ Development Scripts

- `npm run build` — Compiles TypeScript and packages extension to `dist/`.
- `npm run dev` — Watch mode for rapid content script / background development.
- `npm run lint` — ESLint validation with zero warnings/errors.
- `npm run typecheck` — TypeScript type safety check.
- `npm run test:e2e` — Real Chromium automated E2E test.
