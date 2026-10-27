# Cursor stills

Background-free exports of each Entomon cursor (idle pose, heading up, mid wingbeat).

| File | Insect |
| --- | --- |
| `monarch.png` / `monarch.svg` | Monarch butterfly |
| `dragonfly.png` / `dragonfly.svg` | Common Green Darner |

- **PNG** — true transparency, **2048 px on the long edge** (2× internal supersample, 2048 px procedural wing textures, shadows omitted). Captured from a **raised orthographic camera** (not flat plan view) so wing camber and twist are not clipped.
- **SVG** — same pixels embedded in an SVG wrapper so it scales in Figma/Illustrator without re-exporting; not a vector trace of the model.

## Regenerate

```bash
npm run dev          # in one terminal, or let export:cursors start it
npm run export:cursors
```

Preview and manual save: http://localhost:5173/export-cursors.html

The live cursors are WebGL/Three.js renders, so there is no native vector SVG of the textured model—only these raster exports (plus the SVG wrapper above).
