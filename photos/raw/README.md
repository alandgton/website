# Garden Leave Raw City Photos (`photos/raw/`)

Drop your original camera or phone photos here organized by **City ID** (matching the city names in `src/sites/gardenleave/config/itinerary.config.ts`).

All raw files inside `photos/raw/` are `.gitignore`d so large camera originals (`HEIC`, `JPG`, `PNG`) are never committed to Git.

---

## Quick Start

1. **Create a folder for any visited city**:
   ```text
   photos/raw/
   ├── NYC/
   │   ├── 01_west-village-sunset.jpg
   │   └── 02_brooklyn-bridge.HEIC
   ├── Grindelwald/
   │   └── 01_eiger-north-face.jpg
   └── Kyoto/
       ├── 01_fushimi-inari.jpg
       ├── 02_arashiyama.jpg
       └── captions.json          # (Optional) custom captions & dates
   ```

2. **Optimize & sync into the app**:
   ```bash
   npm run photos:sync
   ```
   *(This also runs automatically before `npm run build`).*

3. **What `npm run photos:sync` does**:
   - Auto-rotates and converts `.jpg`, `.jpeg`, `.png`, `.webp`, `.heic`, `.heif`, and `.tiff` files into compressed `WebP` (`max 960px`, quality `82`, `~35–65 KB` each).
   - **Strips all EXIF & GPS metadata** for privacy and smaller payloads.
   - Outputs static files to `public/gardenleave/photos/<CityId>/`.
   - Auto-generates `src/sites/gardenleave/config/photos.manifest.ts` with image dimensions and captions.

---

## Captions & Ordering

- **Sort Order**: Files are sorted alphabetically within each city folder (prefix with `01_`, `02_`, etc. to control order).
- **Automatic Captions from Filenames**:
  - Camera default names (`IMG_1234.HEIC`, `DSC0012.JPG`, `PXL_20261204.jpg`, `01.jpg`) are automatically treated as **uncaptioned**.
  - Descriptive names like `01_Arashiyama_Bamboo_Grove.jpg` or `02-shimanami-kaido-bridge.jpg` automatically format as `"Arashiyama Bamboo Grove"` or `"Shimanami Kaido Bridge"`.
- **Optional `captions.json`**:
  You can also place a `captions.json` inside `photos/raw/<CityId>/` (or override in `src/sites/gardenleave/config/photos.config.ts`):
  ```json
  {
    "01_fushimi-inari.jpg": {
      "caption": "Early morning hike through Fushimi Inari Taisha",
      "date": "2026-12-04"
    }
  }
  ```
