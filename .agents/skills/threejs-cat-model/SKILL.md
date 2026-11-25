---
name: threejs-cat-model
description: >-
  Generates an anatomically realistic, interactive Three.js 3D cat model with
  multi-tone procedural coat textures, volumetric Lengyel fur shells, flush
  blinking/squinting eyelids, petting physics, and turntable orbit from at
  least 5 user-uploaded reference photos. Use this skill whenever the user
  asks to build, customize, or refine a 3D cat model in Three.js from real
  photos of their cat.
---

# Three.js Procedural 3D Cat Generator (5-Photo Closed-Loop Workflow)

Build an interactive, anatomically realistic 3D seated cat in Three.js from real reference photographs of a specific cat, using deterministic procedural coat textures, multi-shell Lengyel volumetric fur, mathematical geometry validation, and multi-angle Playwright WebGL inspection.

---

## 1. Mandatory 5-Photo Intake Gate & Upfront Clarifications

### Hard Gate: Require at Least 5 Reference Photos
Before authoring any 3D geometry or texture code, verify that the user has uploaded **at least 5 distinct reference photos** of their cat. If fewer than 5 photos are provided—or a major view is missing—stop and ask for the missing angles first, explaining what each view determines:

| # | Required / Recommended Angle | What It Unlocks (Geometry & Coat Mapping) |
| :--- | :--- | :--- |
| 1 | **Front Face & Seated Chest** | Inner-eye corner patch boundaries, nose blaze / mustache asymmetry, ear set & tilt, iris gradient, front-leg horizontal spacing, and chest flatness vs leg prominence. |
| 2 | **True Side Profile (Left or Right)** | Nose/muzzle bluntness (avoiding pointy canine snouts), occiput-to-back nape flow, convex seated back arch, tucked non-melting sitting base, foreleg forward clearance ahead of chest, and folded hind-leg angle. |
| 3 | **Opposite Flank or Front-3/4 Seated View** | Asymmetric left vs right shoulder/flank patches and continuous foreleg-to-shoulder coat bridges (e.g., tabby sleeves connecting unbroken into the back). |
| 4 | **Aerial / Top-Down Back & Scalp View** | Occiput cap color, count and spacing of dorsal scalp stripes, crown markings between ears, central spine patches, multi-tone coat accents (e.g., silver-pewter frost, mahogany undertones, tortie brindle flecks), and rump-to-tail base coat. |
| 5 | **Back-of-Head / Nape &/or Closed-Eyes Closeup** | Whether the throat collar stops cleanly on the front/sides or wraps behind the neck, nape coat continuity, and flush closed-eyelid fur lightness & slit contour. |

> Never invent unseen asymmetric markings without calling them out or confirming with the user.

### Upfront Clarification Questions (Ask Before Coding When Ambiguous)
1. **Identity & UI Copy**: Cat's name, mood labels, and pointer/touch interaction hint copy.
2. **Body Build & Size Class**:
   - *Sleek / petite* (narrower limb radii, trimmer waist/cheeks)
   - *Medium adult domestic shorthair*
   - *Large / stout plush* (stouter curved hind legs, fuller rounded cheeks and mid-loin, broader shoulder-neck transition)
3. **Coat Pattern Family & Occluded Details**: Pattern type (*solid*, *bicolor/tuxedo*, *mackerel or classic tabby*, *calico*, *torbie/tabico*, *tortoiseshell*, *colorpoint*) plus any hidden areas (belly, opposite flank, paw socks, tail tip).
4. **Host Integration Target**: Keep the core 3D engine **framework-agnostic** (pure TypeScript + `three`), then optionally wrap it cleanly in the workspace's UI stack (vanilla DOM mount, React component, Vue/Svelte, etc.) using lazy `import()` so `three` never bloats unrelated entry bundles.

---

## 2. Framework-Agnostic 4-Module Architecture

Structure the implementation cleanly across four decoupled modules:

1. **`catConfig.ts`** — Pure data configuration:
   - `CatCoatPalette`: 12–14 hex tokens covering base coat (`cream`, `creamShadow`), warm tones (`gingerLight`, `ginger`, `gingerDeep`), dark/tabby tones (`charcoalLight`/`charcoalHighlight`, `charcoal`, `charcoalDeep`), skin (`nosePink`, `earPink`), iris gradient (`eyeInner`, `eyeOuter`), and plinth/cushion stage (`cushionBase`, `cushionAccent`).
   - Display strings (`name`, `desktopHint`, `touchHint`) and optional build scalars.
2. **`catTextures.ts`** — Procedural `CanvasTexture` generators using deterministic 3D `valueNoise3` + `fbm3` + hair-strand noise (no external image texture downloads):
   - `createHeadTexture(palette, w, h)` — Equirectangular sphere map driven by unit direction `(nx, ny, nz)`.
   - `createTorsoTexture(palette, w, h)` — Cylindrical map driven by angle `phi -> (nx = sin(phi), nz = cos(phi))` and height `ny in [-1, 1]`.
   - `createForelegTexture(palette, side, size)` — Cylindrical arm map (`v = 0` wrist to `v = 1` shoulder cap).
   - `createHindLegTexture(palette, side, size)` — Swept-tube map (`v = 0` upper thigh/hock inside torso to `v = 1` front paw tip).
   - `createTailTexture(palette)`, `createSolidFurTexture(palette, tone)`, `createFurBumpTexture()`, `createFurHeightAlphaTexture()`, and `createCatEyeTexture(palette, w, h)`.
   - Use adaptive bake resolution on mobile/compact viewports (`512×256` coats, `256×128` eyes) vs desktop (`1024×512` coats, `512×256` eyes), and mark color textures `THREE.SRGBColorSpace` (linear for height/bump data maps).
3. **`buildCatRig.ts`** — Procedural geometry sculptors, Lengyel multi-shell volumetric fur attachment, articulated pivots, and clean `.dispose()`:
   - Returns `{ root, catRoot, bodyGroup, headPivot, leftEarPivot, rightEarPivot, leftEyeBall, rightEyeBall, leftUpperLid, rightUpperLid, leftLowerLid, rightLowerLid, leftFrontPawPivot, rightFrontPawPivot, pettableMeshes, updateTail, dispose }`.
4. **`CatSceneController.ts`** — Self-contained scene lifecycle controller (`container: HTMLElement`, `palette`, `onStatusChange?`):
   - `THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })` with `SRGBColorSpace`, `ACESFilmicToneMapping`, `PCFSoftShadowMap`, pixel ratio clamped (`<= 1.5` mobile, `<= 2.0` desktop).
   - Lightweight procedural `PMREMGenerator` softbox studio environment + 4 lights: `HemisphereLight`, shadow-casting warm `keyLight` (`(2.4, 3.7, 3.1)`), cool `rimLight` (`(-2.4, 3.0, -2.5)`), front `fillLight`, and interactive `touchGlowLight`.
   - Pointer raycasting against `pettableMeshes`: dragging over the cat strokes/pets (zones `'head' | 'chin' | 'back' | 'tail'`); dragging outside orbits camera yaw and pitch smoothly (support high overhead orbit up to `~1.18 rad` for aerial inspection).
   - Frame-rate-independent exponential damping (`damp`) for breathing, purring jitter, happy front-paw kneading (`leftFrontPawPivot.position.y`), blink & slow-blink squint, ear twitches, and tail sway.
   - `ResizeObserver` + `IntersectionObserver` (pause RAF loop when offscreen or `document.hidden`), WebGL context loss/restored handlers, and complete GPU `.dispose()`.

### Mandatory Automation & Testing Hooks
Always expose discrete state attributes on the scene mount container so headless tests and screenshot harnesses never rely on arbitrary sleeps:
- `data-cat-state="loading" | "ready"` — set `"ready"` immediately after the initial `renderer.render(scene, camera)` completes.
- `data-cat-mood="relaxed" | "curious" | "purring" | "blissful"` — update only on state changes (zero per-frame DOM thrashing).

---

## 3. Non-Negotiable Anatomical, Geometric & Coat Invariants

These eight constraints directly prevent every visual, anatomical, and shader defect encountered in iterative 3D cat sculpting. Apply them from the start and verify them mathematically.

### Invariant 1: Compact Blunt Feline Muzzle (Never Pointy)
- Keep forward muzzle protrusion modest (`snoutMask * 0.034`), nasal bridge subtle (`bridgeMask * 0.005`), rounded twin whisker pads (`padLobe * 0.020`) nearly flush with the nose pad, compact chin (`chinMask * 0.025`), and gently compress the front-most snout plane (`if (z > 0.294) z = 0.294 + (z - 0.294) * 0.42`) so side profiles match real domestic shorthair proportions.

### Invariant 2: Flush, Non-Bulging Closed Eyelids (Concentric Shallow-Lens Rig)
- Recess orbital eye sockets deeply (`socketMask * 0.044`, `socket.position.z ≈ 0.186`).
- Place the non-uniform flattening scale on a **parent assembly group ABOVE both the eyeball and rotating eyelids**, keeping the eyeball (`r = 0.072`) and upper/lower lid hemispheres (`r = 0.0755` / `0.0750`) uniformly spherical inside it:
  ```ts
  const eyeAssembly = new THREE.Group();
  eyeAssembly.scale.set(1.06, 1.0, 0.56); // parent scale keeps lid rotations strictly concentric!
  socket.add(eyeAssembly);
  eyeAssembly.add(eyeBallGroup, upperLid, lowerLid);
  ```
- **Never** apply non-uniform `scale.z` directly to child eyelid cap meshes (`upperCap` / `lowerCap`)—rotating an ellipsoid child shears it outward through the face.
- Use light, soft face-matched eyelid fur (lower stripe darkness + `undercoatShade ≈ 0.95`) with dark `TorusGeometry` eyelid rims (`#231b18`) so closed eyes form sleek, flat, natural eye slits rather than dark bulging domes.

### Invariant 3: Low-Set Wide-Base Ears Seated Deep Inside the Cranium
- Sculpt ears widest at their skull base (`t = 0`) tapering monotonically to softly rounded tips with a subtle front pinna hollow (`uz > 0`), seated deep into the skull (`position ≈ (±0.118, 0.108, -0.014)`), and fade ear `furWeights` to `0` across `t = 0.10..0.28` so low upward camera angles never reveal an ear seam.

### Invariant 4: Seamless Head-to-Back Nape Transition (Zero Neck Crease, Zero Unwanted White Line, Zero Cheek Overhang)
1. **Constrain Cheek & Jaw Width**: Restrict `cheekMask` (`dirZ > 0.02`) and `frontJawTaper` (`dirZ > -0.12`) toward the front/mid face so fluffy cheeks never overhang the rear neck behind the ears.
2. **Conical-Tangent Nape Collar on Skull**: Replace spherical under-curl on the lower-rear head with separate lateral width (`scaleX` flare `0.11`) and dorsal `-Z` spine flare (`0.14 + backCenterBoost * 0.31`) before tucking smoothly inward below `uy = -0.64`. Every rear angle (`-90°..-20°`) crosses `torsoMesh` cleanly around `y ≈ 1.01..1.04` with a positive outward slope (`Δ < 25°` vs torso), and stays safely inside the torso during head pitch/yaw/roll (`±0.25–0.40 rad`).
3. **Matched Dorsal Torso Nape + Fur Height + Brightness**: Add dorsal/rear-side neck fullness on `torsoMesh` strictly behind the jaw (`z < 0.08..0.22`), match volumetric fur shell thickness across the junction (`~0.0175`), and align `torsoBaseMat` `undercoatShade` (`0.86`) with `headBaseMat` (`0.87`).
4. **No Unintended White Neck Line**: Constrain white front/side throat collars (`rightNeckCollar`, `leftNeckWhitePeek`) to front/side `nz` unless reference photos show a complete white ring around the back of the neck, and echo dorsal scalp stripes cleanly onto the upper torso nape.

### Invariant 5: C² Smooth Arched Seated Back & Non-Melting Tucked Bottom (UV-Invariant Spline Lathe)
- **Never** leave a seated torso at 10–11 coarse raw `LatheGeometry` intervals when sculpting a strong dorsal arch and bottom tuck—coarse vertical segments create visible straight faceted polygon corners in side profiles.
- Keep **11 semantic `anchorPoints`** (`y = 0.008..1.17`, compact base `r = 0.155` at `y = 0.024`, lifted rounded underside `0.258` at `0.12`, mid-loin fullness `0.348–0.350` at `0.41–0.57`, shoulders `0.334` at `0.71`), then sample `new THREE.SplineCurve(anchorPoints)` at **`profileSubdiv = 4`** (`41` rings × `64` radial segs). Because `40` is an exact multiple of `10`, `uv.y = (k * 4) / 40 = k / 10` stays **100% invariant** at every anchor while eliminating all silhouette faceting.
- Center the convex `dorsalArch` (`backZ ≈ -0.46` at `y ≈ 0.49`) directly above the rearward hind legs with `bottomRumpTuck` and `contactFade = smoothstep(0.035, 0.16, y)` so the cat's bottom curves briskly off the cushion rather than flattening into a floor-melting pancake.

### Invariant 6: Wider, Forward-Set Front Legs, Flatter Chest & Flush Shoulder Blend
- Position front legs wide enough for a clear chest/belly gap between them (`x ≈ ±0.144`, `z ≈ 0.280`, front paws at `(±0.144, 0.036, 0.322)`, outward toe angle `rotation.y = ±0.09`).
- Trim front chest projection (`depthFactor = 0.78` on `+Z` + `chestCenterFlat`) so `chestMidZ` stays cleanly behind `legFront` below the upper chest—never bulging out on top of the front legs.
- Sculpt `createAnatomicalForelegGeometry()` with an upper-arm curve (`curveX`, `curveZ`) that sweeps inward and backward above `t = 0.60` into subtle `outerShoulderMerge` chest pads (`|x| ≈ 0.17, t ≈ 0.56`) so `legFront` crosses the chest tangentially (`y ≈ 0.56`) and buries completely inside the shoulder above `y = 0.62` (zero protruding cylinder cap step).
- If a foreleg carries a dark/colored coat sleeve into the torso, paint a matching diagonal bridge (`armSleeveBridge`) across the torso's shoulder exit seam so front-3/4 views show zero white gap between leg and back.

### Invariant 7: Stout, Plush, Monotonic Folded Hind Legs (Zero Floating Paws, Zero Skinny Sticks, Zero Inverted Winding)
- Avoid tiny isolated oval paws placed far forward (`z > 0`), protruding rearward hock balls outside the rump, or straight thin horizontal bars.
- Instead, sweep a plush elliptical tube (`rx`, `ry` scaled to the cat's build—e.g. `rx: 0.092 -> 0.076`, `ry: 0.082 -> 0.044` for large/stout cats) along a **strictly monotonic downward-forward `CatmullRomCurve3`** (`minTanZ > 0.6`, zero hairpin fold-back!) from the furred rear hock inside the lower haunch `(±0.132, 0.152, -0.228)` down through the angled lower leg `(±0.156, 0.098, -0.165)` -> `(±0.174, 0.058, -0.080)` to a rounded paw tip `(±0.184, 0.040, 0.006)` plus snug front toes (`y = 0.028, z = 0.012`).
- **Verify Outward Triangle Winding**: With `sideVec = (+1, 0, 0)` orthogonalized against `tan` and `upVec = tan × sideVec`, use `indices.push(a, d, b, b, d, c)` so every vertex normal points strictly outward (`minOutwardDot > +0.74`). Inverted winding `(a, b, d)` culls the front wall and extrudes fur shells inward into a hollow ring!
- Wrap upper-rear hock coat textures **360°** around `v < 0.42..0.56` before feathering into snowy-white feet/paws so strong rear `rimLight` never illuminates a bright white crescent beneath a dark hip, and verify tail `controlPoints[0..1]` clear the left rear hock (`dist > sumRadii`).

### Invariant 8: Landmark-Anchored Facial Coat & Shadow-Clean Volumetric Fur
- Anchor facial blaze edges, brow flames, inner-eye tear lines, and soft whisker-pad smudges directly to the sphere coordinates of the eye sockets (`nx ≈ ±0.205, ny ≈ +0.041`) and nose pad (`ny ≈ -0.18`). Soften dark whisker-pad smudges rather than feeding them into heavy tabby darkness masks.
- Stack 4–6 Lengyel volumetric fur shells (`alphaMap` + progressive `alphaTest = 0.14..0.72` + root-to-tip `aoShade = 0.85..1.04`) with **`receiveShadow = true` on every shell** to avoid chin-shadow speckle artifacts.

---

## 4. Mandatory Closed-Loop Verification Workflow

Never stop after writing geometry/texture code. Execute this two-tier verification loop until every mathematical check and every rendered angle passes visual comparison against all 5+ user reference photos.

### Tier 1: 1-Second Node Math & Normal Audit (Before Opening Browser)
Run a quick Node ESM script importing `three` directly against the exact constants in `buildCatRig.ts` to catch geometric bugs before rendering:

```bash
node --input-type=module -e '
import * as THREE from "three";
// Paste or import your exact torso spline, head deformation, foreleg curve, and hind-leg sweep builders, then assert:
// 1. Nape crossings at phi = -90°, -70°, -50°, -35°, -20° all occur at y = 1.00..1.05 with Δ(tSlope - hSlope) < 26°
//    and lower skull tuck rim remains safely inside torso under pitch ±0.25, yaw ±0.40, roll ±0.25.
// 2. Foreleg vs torso: (legFront - torsoAtLegX) > 0.10 below y = 0.40, crosses ~0 cleanly around y = 0.56, and < -0.03 above y = 0.62.
// 3. Hind-leg sweep: minTanZ > 0.60 (monotonic forward), maxZSelfFold === 0, minOutwardDot > 0.70 (100% outward normals!),
//    and tail curve minimum distance to left rear hock > sumRadii.
'
```

### Tier 2: 9-Angle Headless Chrome + Playwright WebGL Inspection
Launch the host app's dev server temporarily (remember to kill it afterward), wait deterministically on `[data-cat-state="ready"]`, simulate petting and orbit drags across 9 views, and **read every generated PNG with your vision/file-read tool**:

```javascript
// Save as a scratch script (e.g. inspect-cat.mjs) and run with node
import { chromium } from 'playwright'; // or workspace playwright-core path

const URL = process.env.CAT_URL || 'http://127.0.0.1:4174/home/';
const OUT = process.env.OUT_DIR || '/tmp/cat-inspect';

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-webgl'],
});

const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('[data-cat-state="ready"]') !== null, { timeout: 10000 });

  const container = page.locator('[data-cat-state="ready"]').first();
  const canvas = container.locator('canvas').first();
  const box = await canvas.boundingBox();
  const cx = box.x + box.width * 0.5;
  const headY = box.y + box.height * 0.40;
  const edgeRightX = box.x + box.width - 28;
  const edgeLeftX = box.x + 28;
  const midY = box.y + box.height * 0.50;

  // 1. Desktop relaxed front
  await container.screenshot({ path: `${OUT}/01-front-relaxed.png` });

  // 2. Stroke head -> blissful closed-eyes closeup check
  await page.mouse.move(cx - 40, headY);
  await page.mouse.down();
  for (let i = 0; i < 4; i++) {
    await page.mouse.move(cx + 45, headY + 12, { steps: 10 });
    await page.mouse.move(cx - 45, headY - 6, { steps: 10 });
  }
  await page.waitForTimeout(120);
  await container.screenshot({ path: `${OUT}/02-petting-closed-eyes.png` });
  await page.mouse.up();
  await page.waitForTimeout(800);

  // 3. Left flank
  await page.mouse.move(edgeRightX, midY);
  await page.mouse.down();
  await page.mouse.move(edgeRightX - 150, midY - 10, { steps: 14 });
  await page.mouse.up();
  await page.waitForTimeout(450);
  await container.screenshot({ path: `${OUT}/03-left-flank.png` });

  // Reset helper (click reset button if present, or reload)
  const resetBtn = page.getByRole('button', { name: /reset/i });
  const resetView = async () => {
    if (await resetBtn.count()) {
      await resetBtn.first().click();
      await page.waitForTimeout(500);
    } else {
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.querySelector('[data-cat-state="ready"]') !== null);
    }
  };

  // 4-7. Front-right 3/4 -> Right flank -> Rear -> Aerial top-down
  await resetView();
  for (const [name, dx, dy] of [
    ['04-front-right-3q.png', 95, 0],
    ['05-right-flank.png', 115, -10],
    ['06-rear.png', 200, 0],
  ]) {
    await page.mouse.move(edgeLeftX, midY);
    await page.mouse.down();
    await page.mouse.move(edgeLeftX + dx, midY + dy, { steps: 14 });
    await page.mouse.up();
    await page.waitForTimeout(450);
    await container.screenshot({ path: `${OUT}/${name}` });
  }

  await page.mouse.move(box.x + 24, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 34, box.y + 250, { steps: 16 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  await container.screenshot({ path: `${OUT}/07-aerial.png` });

  // 8. Low upward pitch (checks embedded ears & chin/chest)
  await resetView();
  await page.mouse.move(edgeLeftX, box.y + box.height - 30);
  await page.mouse.down();
  await page.mouse.move(edgeLeftX + 45, box.y + 30, { steps: 14 });
  await page.mouse.up();
  await page.waitForTimeout(450);
  await container.screenshot({ path: `${OUT}/08-low-angle.png` });

  // 9. Mobile 390x844 layout & WebGL scaling check
  await resetView();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(450);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log({ mobileOverflow: overflow, errors });
  await page.screenshot({ path: `${OUT}/09-mobile.png` });
} finally {
  await browser.close();
}
```

### Visual Inspection Checklist (Open Every Screenshot & Compare Against All 5+ Photos)
Fix and re-run Tier 1 + Tier 2 immediately if any check fails:
1. **Front (`01`) & Petting (`02`)**: Do closed eyelids lie 100% flush with smooth soft-colored curved slits (zero bulge)? Are inner-eye coat corners, nose blaze/smudges, whisker pads, wider front-leg spacing, and flatter non-bulging chest faithful to the photos?
2. **Flanks (`03`, `05`) & Front-3/4 (`04`)**: Is the nose/muzzle compact and blunt (not pointy)? Does the upper foreleg merge smoothly into the shoulder with zero cylinder-cap step and continuous sleeve coat markings? Is the arched back 100% C²-smooth (zero straight polygon facets)?
3. **Seated Bottom & Hind Legs (`03`, `05`, `06`)**: Does the bottom curve crisply off the cushion (not melted flat)? Are the hind legs stout, solid (never hollow/inverted), seamlessly merged from thigh/hock down to paws, with zero excess body mass hanging behind them?
4. **Rear (`06`) & Aerial (`07`)**: Is the head-to-back nape completely smooth (no horizontal shadow shelf, no rear-cheek overhang, no unwanted white neck ring)? Does the tail clear the left hind hock without clipping? Are dorsal scalp stripes and spine patches aligned?
5. **Low Angle (`08`), Mobile (`09`), Build & Hygiene**: Are ears embedded cleanly from underneath? Is mobile layout free of horizontal overflow with zero console errors? Did you kill the temporary dev server, and do workspace typecheck, build, and automated tests pass before any local commit?
