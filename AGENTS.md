# AGENTS.md — Development Guidelines for alanton.at & Garden Leave Map

You are an expert full-stack engineer, minimalist UX architect, and cartographic visualization specialist working on the `alanton.at` personal site and Garden Leave interactive travel map.

---

## 1. Interaction & Communication Protocols

### Clarification & Intent First (Non-Negotiable)
- **Always ask clarifying questions before executing** whenever a request is ambiguous, involves design/architectural trade-offs, or touches existing visual conventions. Do not assume or guess user preferences.
- **Present concrete choices**: When asking for guidance, provide 2–3 clear options, their pros/cons, and a recommended default.
- **Interactive HTML Demos (`generative_ui`)**: For visual, layout, or HUD trade-offs, build a compact inline interactive HTML demo via the `generative_ui` skill (`<agent-embed>`) when helpful so the user can inspect and compare options live before choosing.
- **Reference Single Source of Truth**: Before making architectural or styling changes, consult [`ARCHITECTURE_AND_LEARNINGS.md`](./ARCHITECTURE_AND_LEARNINGS.md).

### Git Commit & Remote Push Protocol (Strict Non-Negotiable Rule)
- **Proactive Atomic Local Commits**: Follow software engineering best practices by creating clean, atomic local commits (`git add` + `git commit`) automatically at appropriate milestones—such as after a logical change or swarm pass is complete and verified (`npm run build` + `@qa` sign-off).
- **NEVER push to remote (`origin main` / `origin/main` / any remote branch) without explicit user permission.**
- Committing locally and pushing to remote are strictly separate actions.
- **ALWAYS ASK FOR EXPLICIT APPROVAL BEFORE PUSHING TO MAIN.**
- Do NOT assume or bundle `git push` into a commit command. After committing locally, inform the user of the commit hash/summary and ask if they would like to push to main.

---

## 2. Codebase & Multi-Site Monolith Architecture

- **Stack**: React 18, TypeScript 5.6+, Vite 8+ (multi-page rollup), D3.js (`d3-geo`, `d3-zoom`), Tailwind CSS, Lucide icons.
- **Hosting**: 100% static Cloudflare Pages deployment from `dist/` ($0 cost, GitHub CI/CD).
- **Multi-Page Subpaths & Modular Layout**:
  - `/` → `src/sites/landing/` (Master landing portal with interactive canvas `NeuralMeshBackground`)
  - `/gardenleave/` → `src/sites/gardenleave/` (Interactive 2D vector travel map: `GardenLeaveApp.tsx`, `components/`, `config/`, `hooks/`, `utils/`)
  - `/home/` → `src/sites/home/` (Personal home space placeholder using `PlaceholderPage`)
  - `/work/` → `src/sites/work/` (Mobile-first vertical career experience timeline: `WorkPage.tsx`, `components/`, `config/experience.config.ts`)
  - Shared modules → `src/sites/shared/` (`mountSite.tsx` standardized React root bootstrap, `FloatingHeader.tsx` shared floating header primitives, `PlaceholderPage.tsx` reusable WIP page)

### Multi-Page HTML & Sub-Site Runbook
Vite is configured with a multi-page rollup (`rollupOptions.input` in `vite.config.ts`) mapping HTML files directly to clean Cloudflare Pages URL routes:
- `index.html` → `/` (loads `src/sites/landing/main.tsx`)
- `gardenleave/index.html` → `/gardenleave/` (loads `src/sites/gardenleave/main.tsx`)
- `home/index.html` → `/home/` (loads `src/sites/home/main.tsx`)
- `work/index.html` → `/work/` (loads `src/sites/work/main.tsx`)

---

## 3. Product Scope: Core Essentials & Anti-Bloat Mandate

Future development on the Garden Leave Interactive Travel Map is strictly refocused on **three Core Essentials**. Any feature, overlay, or control that does not directly serve these pillars is considered bloat and must be simplified or removed.

### The 3 Core Essentials
1. **Smooth, Lag-Free Interactive Map (Low-Touch Config)**:
   - Supports fluid 60–120fps zooming and panning across desktop and mobile viewports.
   - Displays visited cities and transit legs defined via a low-touch declarative config (`src/sites/gardenleave/config/itinerary.config.ts` with automatic coordinate resolution via `cityGeocoder.ts`).
2. **Chronological Journey Playback (Unobstructed Source & Destination)**:
   - Shows the viewer the chronological order in which cities were visited.
   - **Strict Viewport Rule**: During Journey Playback, **both the source city and destination city of the active leg must always be simultaneously visible and unobstructed on screen** (never hidden behind top/bottom bars or photo cards) on both desktop and mobile browsers.
   - Camera transitions between cities must be smooth and lag-free.
3. **User-Uploaded City Photos**:
   - Displays user-uploaded photos (`photos/raw/<CityId>/` synced via `npm run photos:sync` into `photos.manifest.ts` / `photos.config.ts`) when a user taps or selects a city on the map, as well as during Journey Playback.

### Feature Scope Decisions (Keep / Simplify / Remove)
- **Legacy City Detail Drawer (`CityDetailDrawer.tsx`) — REMOVED**:
  - The legacy `CityDetailDrawer` (directory list, search bar, leg tables) is deprecated bloat and must remain removed.
- **Read-Only Itinerary Modal (`ItineraryModal.tsx`) — KEEP**:
  - Maintain the centered read-only glassmorphic modal toggled via the `Itinerary` button in `RegionSelectorBar`, offering vertically scrollable multi-month `Calendar` (`StickyMonthGutter`) and monthly `List` views. Browsing dates must never alter map selection or camera state.
- **Photo Postcards & Carousels (`CityPhotoPostcard.tsx`, `CityPhotoCarousel.tsx`) — SIMPLIFY**:
  - Keep photo viewing lightweight, clean, and uncluttered when a city is selected on the map or active in Journey Playback (`16:10` carousel, `bottom-28` mobile manual-tap clearance above the 2-row idle footer, and omitted from the DOM on `< 640px` mobile during playback when `JourneyPlayback`'s docked strip handles photos).
- **Journey Playback (`JourneyPlayback.tsx`) — KEEP & PROTECT**:
  - Maintain chronological playback with `1x` / `2x` speed selector, embedded `TransitModeButtons` legend in its top row (without pulsing `"Journey Playback"` text or `0.7x`), and smooth camera framing (`followRafIdRef`) that guarantees both source and destination pins remain in the unobstructed safe zone.
- **Top Bar & Legend Controls (`RegionSelectorBar.tsx`, `TransitLegendBar.tsx`) — KEEP (Streamlined)**:
  - Retain the centered floating island (`Main`, full `{title}`, `Region` presets, `Granularity` dropdown, `Itinerary` modal trigger, `Grid` toggle; `< 640px` mobile uses a 3-column Row 1 with `Main` left, centered `{title}`, and icon-only `Grid` right, plus Row 2 with `Region`, labeled `Granularity`, and `Itinerary`). Keep `TransitLegendBar` beside `[ ▶ Play Journey ]` when idle and shared `TransitModeButtons` embedded inside `JourneyPlayback`'s top row when active.

---

## 4. Core Architectural & Visual Invariants

Any agent working on this codebase must strictly preserve the following decisions:

1. **Config-Driven Domain Model (`src/sites/gardenleave/config/`)**:
   - Never hardcode city coordinates, transit legs, or region parameters inside component files.
   - Itinerary data lives in `src/sites/gardenleave/config/itinerary.config.ts` as `ITINERARY_STOPS`.
   - Coordinates are auto-resolved via `src/sites/gardenleave/utils/cityGeocoder.ts` (Gazetteer → LocalStorage → Open-Meteo/Nominatim API fallback).
   - City photos are resolved via `src/sites/gardenleave/config/photos.config.ts` and `photos.manifest.ts`.

2. **Cartographic Geometry & Antimeridian Shift**:
   - D3 projection uses `rotate([-11, 0])`, shifting the Pacific seam to **`-169°W`**.
   - Transpacific legs crossing the Pacific (e.g. `Tokyo -> LA`, `Vancouver -> Sapporo`) must split across `-169°W` into eastward straight segments.
   - Bidirectional legs (e.g. `NYC <-> SF`, `Shanghai <-> Nanjing`) must maintain parallel offset via normal vector separation.
   - Dedicated Seto Inland Sea overlay layer (`seto-islands-layer`) must remain synchronized with Japan's visited/active states.

3. **Performance Invariants (60–120fps Native Panning & Zooming)**:
   - Pan/drag updates mutate `<g ref={cameraGroupRef}>`'s `transform` attribute directly in the DOM. Never route continuous pan coordinates through React state (`0` React renders per drag frame).
   - Keep SVG rendering split into memoized layer sub-components (`src/sites/gardenleave/components/map/`: `GeographyLayer`, `TransitLinesLayer`, `CitiesLayer`, `TransitArrowsLayer`, `CityLabelsLayer`) with `vectorEffect="non-scaling-stroke"`, and keep hover tooltips isolated in imperative `MapHoverTooltip` (`0` canvas re-renders on `mousemove`/city hover, clamped to container bounds).
   - Adaptive LOD: 50m topology below 6x zoom; 10m high-res swapped at $\ge 6x$ zoom (paused during auto-playback so camera transitions never stutter).
   - Dynamic arrowhead math: arrowheads are centered in the visible gap between pin edges (`sourceTrimRadius` / `destTrimRadius`), clamped to a minimum scale (`0.72 * invScale`), and rendered in a dedicated top layer above pin halos.

4. **Visual Aesthetics & Decluttered UI (Minimalist Vector)**:
   - **City Pins**: Clean, uniform slate-white dots (`#f8fafc`) with dark outline (`#0f172a`) and dark halo. Only New York City (`NYC`) has the amber Home Base ring and house icon.
   - **Transit Lines**: Solid lines only across all 4 modes (`Flight`, `Train`, `Drive`, `Bike`). Differentiated strictly by color (no dashed/dotted patterns or `strokeDasharray` plumbing).
   - **Transit Arrows**: Hidden by default. Rendered only on focused legs (hovered, selected, or connected to selected city). Hidden completely during playback.
   - **Playback Controls**: Kept minimal (`1x` / `2x` speeds, embedded `TransitModeButtons` legend without count badges). Follow camera is permanently enabled; ghost future is permanently disabled.

---

## 5. Multi-Agent Swarm Workflow (`ux`, `eng`, `qa`)

Refocusing and feature changes are driven via a **Live Multi-Agent Swarm** (using Antigravity's `swarm` tool and `.agents/skills/gardenleave-swarm/SKILL.md`).

### Swarm Roster & Responsibilities

| Agent Name | Role | Core Responsibilities & Guardrails |
| :--- | :--- | :--- |
| **`coordinator`** | Lead Orchestrator (Main Agent) | Translates user goals into swarm tasks, enforces the Clarification First rule (pausing for user approval on UX options—with optional `generative_ui` HTML demos—when trade-offs exist), coordinates handoffs (`@ux` → `@eng` → `@qa`), summarizes completed changes with metrics, creates clean atomic local `git commit`s once `@qa` passes, and asks for explicit user approval before `git push`. Never writes application code directly while running the swarm. |
| **`ux`** | UX Designer | **Scope Gatekeeper & Interaction Critic.** Audits components against the 3 Core Essentials and read-only `ItineraryModal`. Designs clean simplifications across `RegionSelectorBar`, `CityPhotoPostcard`, `CityPhotoCarousel`, and `JourneyPlayback` so desktop and mobile (`390×844` / `360×740`) viewports stay uncluttered and playback never obscures source/destination cities. **Read-only: never edits source code.** |
| **`eng`** | Software Engineer | **React/TS/D3 Implementation Specialist.** Implements `@ux`'s approved spec cleanly, deletes dead code/imports completely, preserves 60–120fps DOM-transform panning, `components/map/` layer separation + imperative `MapHoverTooltip`, unobstructed source+dest playback framing, and `-169°W` seam math. Syncs `ARCHITECTURE_AND_LEARNINGS.md` and verifies `npx tsc --noEmit && npm run build && npm test` before handing off to `@qa`. |
| **`qa`** | QA Tester | **Viewport, Performance & Regression Verifier.** Runs `npx tsc --noEmit`, `npm run build`, and `npm test` (Playwright headless Desktop `1280×800` + Mobile `390×844` E2E suite), and inspects the live app on **Desktop (`1280×800`)** and **Mobile (`390×844` / `360×740`)** browsers (delegating live UI checks to the `browser` subagent when available). Must verify: (1) clean, uncluttered UI (no `CityDetailDrawer`, centered mobile title/controls, read-only `ItineraryModal`), (2) embedded `TransitModeButtons` + `1x`/`2x` controls work during playback, (3) **both source and destination cities are visible and unobstructed during Journey Playback**, (4) **expanding and compacting the mobile photo strip during active Journey Playback never pauses playback**, and (5) `MapHoverTooltip` edge clamping, `0` SVG mutations on pan/hover, and zero console/runtime errors. **Never patches application code directly; reports defects back to `@eng`.** |

### Standard Swarm Pipeline
1. **UX Audit & Spec (`@ux`)**: `@ux` inspects the target feature/files and posts a concise UX Simplification Spec (plus 2–3 options if design choices exist).
2. **User Alignment (`@coordinator`)**: If `@ux` surfaces design options, `@coordinator` presents them to the user for approval before engineering begins.
3. **Implementation (`@eng`)**: `@eng` executes the approved spec, cleans up dead code, verifies `npm run build && npm test`, and tags `@qa`.
4. **QA Verification (`@qa`)**: `@qa` verifies `npm run build && npm test` and tests both desktop and mobile viewports (checking uncluttered layout, source/destination visibility during playback, mobile photo expand/compact during active playback, and lag-free pan/zoom), then posts a pass/fail QA report to `@coordinator` (or back to `@eng` if fixes are needed).

---

## 6. Development Workflow & Verification Commands

```bash
# If node/npm are not in PATH, activate local node:
export PATH="$PWD/.node/bin:/Users/alanton/travel_map/.node/bin:$PATH"

# Sync user-uploaded city photos into public/photos and photos.manifest.ts
npm run photos:sync

# Run local development server
npm run dev

# Run TypeScript type-checking and production build
npm run build

# Run Playwright headless E2E regression tests (Desktop 1280x800 & Mobile 390x844)
npm test

# Preview production build locally
npm run preview
```

### Verification & Commit Protocols
1. Always verify that `npx tsc --noEmit`, `npm run build`, and `npm test` succeed with zero TypeScript, Rollup, or Playwright errors before completing or committing a task.
2. **Proactive Local Commit vs. Gated Remote Push**:
   - Follow software engineering best practices: automatically create clean, atomic local commits (`git add` and `git commit`) when a logical unit of work is complete and verified (`npm run build`, `npm test`, and `@qa` pass).
   - **`git push` is NEVER run automatically.** Always ask for explicit user approval before pushing to `main` (which triggers automated Cloudflare Pages production deployments). Never bundle push with commit.
