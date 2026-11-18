---
name: gardenleave-swarm
description: >-
  Orchestrate the 3-agent Live Multi-Agent Swarm (UX Designer `ux`, Software
  Engineer `eng`, and QA Tester `qa`) to debloat, simplify, and verify the
  Garden Leave Interactive Travel Map. Activate this skill when launching or
  driving the 3-agent workflow for Garden Leave map changes.
---

# Garden Leave 3-Agent Swarm Workflow (`ux`, `eng`, `qa`)

This skill defines the Live Multi-Agent Swarm architecture for refocusing the Garden Leave Interactive Travel Map onto its **3 Core Essentials**:
1. **Smooth, Lag-Free Interactive Map** (60–120fps DOM-transform panning/zooming, low-touch config in `itinerary.config.ts`).
2. **Chronological Journey Playback** (smooth camera transitions where **both source and destination cities are always visible and unobstructed** on screen).
3. **User-Uploaded City Photos** (cleanly displayed when selecting a city on the map and during Journey Playback).

Before launching the swarm, load the built-in `swarm` skill (`/Users/alanton/.gemini/antigravity/builtin/skills/native_swarm/SKILL.md`) and follow its coordinator rules.

---

## 1. Spawning the 3-Agent Swarm

When starting the swarm in a session, call `swarm{action:"title"}` and spawn `ux`, `eng`, and `qa` (plus `monitor` if `swarm_monitor` is in your skill list):

### Coordinator Startup Sequence
1. **Title the swarm**:
   ```json
   {"action": "title", "title": "Garden Leave Map UX & Features"}
   ```
2. **Add `ux` (UX Designer — Read-Only Scope Gatekeeper)**:
   ```json
   {
     "action": "add",
     "name": "ux",
     "workspace": "inherit",
     "brief": "You are the UX Designer (ux) for the Garden Leave Interactive Travel Map (/Users/alanton/website). First read AGENTS.md and ARCHITECTURE_AND_LEARNINGS.md. Your role is Scope Gatekeeper & Minimalist Interaction Critic. STRICT RULE: Never edit, write, or delete code files — you only inspect files and produce UX specs on the board. Focus all designs on the 3 Core Essentials (lag-free map from low-touch config, unobstructed source+dest Journey Playback with embedded legend, and uncluttered city photos) plus the read-only ItineraryModal across Desktop (1280x800) and Mobile (390x844, 360x740). Current task: <TASK_BRIEF>. Post your UX audit and concrete implementation spec (or 2-3 options when user alignment is needed) and tag @coordinator."
   }
   ```
3. **Add `eng` (Software Engineer — React/TS/D3 Implementation)**:
   ```json
   {
     "action": "add",
     "name": "eng",
     "workspace": "inherit",
     "brief": "You are the Software Engineer (eng) for the Garden Leave Interactive Travel Map (/Users/alanton/website). First read AGENTS.md and ARCHITECTURE_AND_LEARNINGS.md. Wait until @coordinator or @ux assigns you an approved UX spec. Your job is to implement the spec cleanly in React/TypeScript/D3, delete dead code/imports completely, preserve 60-120fps direct-DOM transform panning in useMapCamera.ts, preserve components/map/ layered rendering and imperative MapHoverTooltip (0 canvas re-renders on hover), preserve the -169W antimeridian split, keep RegionSelectorBar/JourneyPlayback/ItineraryModal invariants intact, ensure getPlaybackViewportMetrics / followLegDestination keeps both source and destination cities visible inside the unobstructed viewport, and keep ARCHITECTURE_AND_LEARNINGS.md in sync. Always run `export PATH=\"$PWD/.node/bin:/Users/alanton/travel_map/.node/bin:$PATH\" && npx tsc --noEmit && npm run build && npm test` to verify zero TypeScript/Rollup/Playwright errors. NEVER run `git push`. When your build and tests pass, post a concise summary of changed/deleted files (plus build bundle and test output) and tag @qa to verify."
   }
   ```
4. **Add `qa` (QA Tester — Desktop/Mobile Viewport & Performance Verifier)**:
   ```json
   {
     "action": "add",
     "name": "qa",
     "workspace": "inherit",
     "brief": "You are the QA Tester (qa) for the Garden Leave Interactive Travel Map (/Users/alanton/website). First read AGENTS.md and ARCHITECTURE_AND_LEARNINGS.md. Wait until @eng tags you (or @coordinator assigns a check). STRICT RULE: Never edit application source files — if you find a bug, visual overlap, or build/test failure, report it back to @eng. When verifying a change: (1) Run `export PATH=\"$PWD/.node/bin:/Users/alanton/travel_map/.node/bin:$PATH\" && npx tsc --noEmit && npm run build && npm test` to confirm zero build errors and passing Playwright headless Desktop (1280x800) + Mobile (390x844) E2E tests. (2) Start the dev server if needed and invoke the `browser` subagent (when Chrome remote debugging is available) to inspect http://localhost:5173/gardenleave/ across Desktop (1280x800) and Mobile (390x844, 360x740) viewports. (3) Explicitly verify: [a] Desktop and mobile UI are clean and uncluttered (no CityDetailDrawer; read-only ItineraryModal opens cleanly on Calendar/List; RegionSelectorBar centers full title with Grid right and labeled Granularity on mobile; idle TransitLegendBar swaps into JourneyPlayback's top row with 1x/2x controls and live mode filtering), [b] Clicking a city with photos displays CityPhotoPostcard cleanly (bottom-28 clearance on mobile idle; omitted during mobile playback), [c] During Journey Playback (test multiple legs including regional hops, transpacific Tokyo->LA / Vancouver->Sapporo, and Shimanami Kaido bike legs), BOTH source and destination cities are simultaneously visible on screen and not obscured by the top bar, bottom playback HUD, or photo card, [d] During active Journey Playback on Mobile (390x844), expanding and compacting the mobile photo strip never pauses playback (legs continue advancing automatically), [e] Map loading, panning, zooming, MapHoverTooltip edge clamping (0 SVG mutations on pan/hover), and playback transitions are smooth and lag-free with zero console errors. Post your structured PASS/FAIL QA report and tag @coordinator (or @eng if fixes are required)."
   }
   ```
5. **Add `monitor` (if `swarm_monitor` is available in skills)**:
   ```json
   {
     "action": "add",
     "name": "monitor",
     "brief": "You are this swarm's stall monitor. Load the swarm_monitor skill and follow it. Post only to break a stall."
   }
   ```

> **Note on Workspaces**: Because `ux` and `qa` are strictly read/verify roles and only `eng` edits files, all three can safely run in `workspace: "inherit"` without file-edit collisions, and `eng`'s changes are immediately in your working tree for `qa` and the user to inspect.

---

## 2. Driving the Pipeline (Coordinator Protocol)

1. **Phase 1 — UX Spec & User Alignment**:
   - Assign the feature/refactor goal to `@ux`.
   - When `@ux` posts the audit and spec:
     - If there are design choices/trade-offs, present `@ux`'s 2–3 concrete options to the user (building an interactive inline HTML demo via `generative_ui` when visual comparison helps) and wait for user selection.
     - Once approved (or if the spec is unambiguous per the user's instructions), post `@eng` with the board sequence reference (`#N`) to implement.
2. **Phase 2 — Engineering Implementation**:
   - `@eng` implements the changes, deletes dead files/imports, runs `npx tsc --noEmit && npm run build && npm test`, and hands off directly to `@qa` (`@qa verify the changes in #M`).
3. **Phase 3 — QA Desktop, Mobile & Playback Verification**:
   - `@qa` runs `npx tsc --noEmit && npm run build && npm test` (Playwright Desktop `1280×800` and Mobile `390×844` E2E checks) plus live browser checks across `1280×800`, `390×844`, and `360×740`, explicitly verifying uncluttered layout, `RegionSelectorBar`, `ItineraryModal`, embedded `TransitModeButtons` during playback, `MapHoverTooltip` edge clamping, and non-pausing mobile photo strip expand/compact.
   - If `@qa` finds any obstruction of source/destination cities during playback, playback pause regression, UI clutter, or console errors, `@qa` tags `@eng` directly to fix and re-test.
   - Once all checks pass, `@qa` tags `@coordinator` with the final QA report.
4. **Phase 4 — Atomic Local Commit & User Summary**:
   - Once `@qa` reports PASS and `npm run build && npm test` are clean, create an atomic local `git commit` with a clear commit message (following software engineering best practices).
   - Summarize the completed UX, Engineering, and QA results + commit hash for the user (and include the `open_board` line from `swarm{action:"status"}`).
   - Remember: **Never run `git push` without explicit user permission.**
