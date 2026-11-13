# AGENTS.md — Development Guidelines for alanton.at & Garden Leave Map

You are an expert full-stack engineer and cartographic visualization specialist working on the `alanton.at` personal site and Garden Leave interactive travel map.

---

## 1. Interaction & Communication Protocols

### Clarification & Intent First (Non-Negotiable)
- **Always ask clarifying questions before executing** whenever a request is ambiguous, involves design/architectural trade-offs, or touches existing visual conventions. Do not assume or guess user preferences.
- **Present concrete choices**: When asking for guidance, provide 2–3 clear options, their pros/cons, and a recommended default.
- **Reference Single Source of Truth**: Before making architectural or styling changes, consult [`ARCHITECTURE_AND_LEARNINGS.md`](./ARCHITECTURE_AND_LEARNINGS.md).

### Git & Remote Push Protocol (Strict Non-Negotiable Rule)
- **NEVER push to remote (`origin main` / `origin/main` / any remote branch) without explicit user permission.**
- Committing locally and pushing to remote are strictly separate actions. A user request to "commit", "commit these changes", or "make a commit" means `git commit` locally ONLY.
- **ALWAYS ASK FOR EXPLICIT APPROVAL BEFORE PUSHING TO MAIN.**
- Do NOT assume or bundle `git push` into a commit command. After committing, inform the user of the local commit and ask if they would like to push to main.

---

## 2. Codebase & Multi-Site Monolith Architecture

- **Stack**: React 18/19, TypeScript 5.6+, Vite 6+ (multi-page rollup), D3.js (`d3-geo`, `d3-zoom`), Tailwind CSS, Lucide icons.
- **Hosting**: 100% static Cloudflare Pages deployment from `dist/` ($0 cost, GitHub CI/CD).
- **Multi-Page Subpaths & Modular Layout**:
  - `/` → `src/sites/landing/` (Master landing portal with interactive canvas `NeuralMeshBackground`)
  - `/gardenleave/` → `src/sites/gardenleave/` (Interactive 2D vector travel map: `GardenLeaveApp.tsx`, `components/`, `config/`, `hooks/`, `utils/`)
  - `/home/` → `src/sites/home/` (Personal home space placeholder using `PlaceholderPage`)
  - `/work/` → `src/sites/work/` (Professional portfolio placeholder using `PlaceholderPage`)
  - Shared modules → `src/sites/shared/` (`mountSite.tsx` standardized React root bootstrap, `PlaceholderPage.tsx` reusable WIP page)

### Multi-Page HTML & Sub-Site Runbook
Vite is configured with a multi-page rollup (`rollupOptions.input` in `vite.config.ts`) mapping HTML files directly to clean Cloudflare Pages URL routes:
- `index.html` → `/` (loads `src/sites/landing/main.tsx`)
- `gardenleave/index.html` → `/gardenleave/` (loads `src/sites/gardenleave/main.tsx`)
- `home/index.html` → `/home/` (loads `src/sites/home/main.tsx`)
- `work/index.html` → `/work/` (loads `src/sites/work/main.tsx`)

To add a new sub-site (e.g. `blog`):
1. Create `<subpath>/index.html` referencing `<script type="module" src="/src/sites/<subpath>/main.tsx"></script>`.
2. Create `src/sites/<subpath>/main.tsx` and invoke `mountSite(<YourApp />)` from `src/sites/shared/mountSite`.
3. Register the new HTML entry in `vite.config.ts` under `rollupOptions.input`.
4. Add a navigation link to `SITE_LINKS` in `src/sites/landing/LandingPage.tsx`.

---

## 3. Core Architectural Invariants & Personal Preferences

Any agent working on this codebase must strictly preserve the following decisions:

1. **Config-Driven Domain Model (`src/sites/gardenleave/config/`)**:
   - Never hardcode city coordinates, transit legs, or region parameters inside component files.
   - Itinerary data lives in `src/sites/gardenleave/config/itinerary.config.ts` as `ITINERARY_STOPS` (ordered array of stops).
   - Coordinates are auto-resolved via `src/sites/gardenleave/utils/cityGeocoder.ts` (Gazetteer → LocalStorage → Open-Meteo/Nominatim API fallback).
   - High-fidelity island polygons live in `src/sites/gardenleave/config/setoInlandIslands.config.ts`.
   - Camera presets, transit modes, and map constants live in `regions.config.ts`, `transit.config.ts`, and `map.config.ts`.

2. **Cartographic Geometry & Antimeridian Shift**:
   - D3 projection uses `rotate([-11, 0])`. This shifts the Pacific seam to **`-169°W`**.
   - Transpacific legs crossing the Pacific (`Tokyo -> LA`) must split across `-169°W` into eastward straight segments.
   - Bidirectional legs (`NYC <-> SF`, `Cairo <-> Luxor`, `Tokyo <-> Niseko`, etc.) must maintain parallel offset via normal vector separation.
   - Dedicated Seto Inland Sea overlay layer (`seto-islands-layer`) must remain synchronized with Japan's visited/active states.

3. **Performance Invariants (60–120fps Native Panning)**:
   - Pan/drag updates mutate `<g ref={cameraGroupRef}>`'s `transform` attribute directly in the DOM. Never route continuous pan coordinates through React state.
   - Country and boundary polygons must use `vectorEffect="non-scaling-stroke"` and stay strictly memoized (`useMemo`).
   - Adaptive LOD: 50m topology below 6x zoom; 10m high-res swapped at $\ge 6x$ zoom (paused during auto-playback).
   - Dynamic arrowhead math: arrowheads are centered in the visible gap between pin edges (`sourceTrimRadius` / `destTrimRadius`), clamped to a minimum scale (`0.72 * invScale`), and rendered in a dedicated top layer above pin halos.

4. **Visual Aesthetics & Decluttered UI (Minimalist Vector)**:
   - **City Pins**: Clean, uniform slate-white dots (`#f8fafc`) with dark outline (`#0f172a`) and dark halo. Do not introduce rainbow or category colors. Only New York City (`NYC`) has the amber Home Base ring and house icon.
   - **Transit Lines**: Solid lines only across all 4 modes (`Flight`, `Train`, `Drive`, `Bike`). Differentiated strictly by color. No dashed/dotted patterns.
   - **Transit Arrows**: Hidden by default. Rendered only on focused legs (hovered, selected, or connected to selected city). Hidden completely during playback.
   - **Playback Controls**: Kept minimal. Follow camera is permanently enabled (no toggle button); ghost future is permanently disabled (no toggle button). Redundant buttons ("Scrub Here", "Restart at Leg #1", leg count badge) are removed.
   - **Cross-Site Navigation**: Maintain the "Back to alanton.at" pill in `RegionSelectorBar` for seamless return navigation to `/`.

---

## 4. Development Workflow & Verification Commands

```bash
# If node/npm are not in PATH, activate local node:
export PATH="$PWD/.node/bin:/Users/alanton/travel_map/.node/bin:$PATH"

# Run local development server
npm run dev

# Run TypeScript type-checking and production build
npm run build

# Preview production build locally
npm run preview
```

### Verification & Commit Protocols
1. Always verify that `npm run build` succeeds with zero TypeScript or Rollup errors before completing a task.
2. **Commit vs. Push**:
   - `git add` and `git commit` are run when the user asks to commit.
   - **`git push` is NEVER run automatically.** Always ask for explicit user approval before pushing to `main` (which triggers automated Cloudflare Pages production deployments). Never bundle push with commit.
