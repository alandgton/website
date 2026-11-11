# alanton.at — Personal Website & Multi-Site Monolith

The unified codebase for **alanton.at**, hosted on **Cloudflare Pages**. Built with **React 18 + TypeScript + Vite + Tailwind CSS**.

The site serves multiple isolated sub-sites from one repository:
1. **Landing Page (`/`)** — Interactive neural mesh background connecting to each section of the site.
2. **Home (`/home/`)** — Personal home space (under active development).
3. **Work (`/work/`)** — Professional portfolio & projects (under active development).
4. **Garden Leave (`/gardenleave/`)** — Interactive 2D vector travel map (2026–2027) with D3 projection, journey playback, and mobile-optimized physics.

---

## Quick Start

```bash
npm install
npm run dev
```

To build for production static deployment on Cloudflare Pages (`dist/`):

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

---

## Multi-Page Architecture (Cloudflare Pages)

Vite is configured with a multi-page rollup (`rollupOptions.input` in `vite.config.ts`) outputting directly to `dist/`:

| HTML Entry | React Entrypoint | Target URL | Description |
|---|---|---|---|
| `index.html` | `src/sites/landing/main.tsx` | `/` | Root portal with links to Home, Work, Garden Leave |
| `home/index.html` | `src/sites/home/main.tsx` | `/home/` | Home section |
| `work/index.html` | `src/sites/work/main.tsx` | `/work/` | Work section |
| `gardenleave/index.html` | `src/sites/gardenleave/main.tsx` | `/gardenleave/` | Interactive travel map |

Each section compiles to its own static subfolder (`dist/`, `dist/home/`, `dist/work/`, `dist/gardenleave/`), which Cloudflare Pages natively maps to clean subpaths without server-side redirects or URL rewrites.

---

## Repository Structure

```
website/
├── index.html                      # Root landing page HTML
├── home/
│   └── index.html                  # /home/ HTML entry
├── work/
│   └── index.html                  # /work/ HTML entry
├── gardenleave/
│   └── index.html                  # /gardenleave/ HTML entry
├── src/
│   ├── index.css                   # Global Tailwind CSS and fonts
│   └── sites/
│       ├── landing/                # Root landing page
│       │   ├── LandingPage.tsx     # Landing page UI & links
│       │   ├── NeuralMeshBackground.tsx # Canvas neural network background
│       │   └── main.tsx
│       ├── home/                   # Home section
│       │   └── main.tsx
│       ├── work/                   # Work section
│       │   └── main.tsx
│       ├── gardenleave/            # Garden Leave 2D Travel Map
│       │   ├── GardenLeaveApp.tsx  # Root travel map application
│       │   ├── main.tsx
│       │   ├── components/         # Map canvas, drawers, selectors, playback
│       │   ├── config/             # Regions, itinerary, transit, map presets
│       │   ├── hooks/              # LOD topology, resolved cities, camera zoom
│       │   └── utils/              # TopoJSON, geocoding, collision culling, arc math
│       └── shared/                 # Shared across sites
│           ├── mountSite.tsx       # Standardized React root mount bootstrap
│           └── PlaceholderPage.tsx # Reusable "Work in Progress" page
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## Adding New Sections

To add a new sub-site (e.g. `blog`):
1. Create `blog/index.html` pointing to `/src/sites/blog/main.tsx`.
2. Create `src/sites/blog/main.tsx` and invoke `mountSite(<BlogApp />)`.
3. Register the new entry point in `vite.config.ts` under `rollupOptions.input`.
4. Add a navigation link to `SITE_LINKS` in `src/sites/landing/LandingPage.tsx`.
