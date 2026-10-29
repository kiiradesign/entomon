# Entomon

Realistic 3D insect cursors for the web — a transparent Three.js overlay hides the native pointer while each species keeps its own model, wing kinematics, and motion tuning on a shared interaction controller.

<img width="1200" height="630" alt="Frame 10" src="https://github.com/user-attachments/assets/033517c9-cf22-41ec-b89a-e75404a10917" />

**Shipped:** Monarch butterfly, Common Green Darner dragonfly, Luna moth (*Actias luna*).  
**Planned:** bumble bee and ladybird.

## Local preview (Wikipedia proxy)

```bash
npm install
npm run dev
```

The dev server proxies [en.wikipedia.org](https://en.wikipedia.org) so previews run on real article pages (CSP stripped, assets rewritten). The cursor script is injected automatically.

| Insect | Article | URL |
| --- | --- | --- |
| Monarch butterfly | Butterfly | http://localhost:5173/wiki/Butterfly |
| Common Green Darner | Dragonfly | http://localhost:5173/wiki/Dragonfly |
| Luna moth | Luna moth (dark mode) | http://localhost:5173/wiki/Luna_moth |

Shortcuts: `/` → Butterfly, `/dragonfly` → Dragonfly, `/luna-moth` → Luna moth. The Luna moth article is always served in Wikipedia's night theme.

**Which insect?** By default the slug picks the species (`Butterfly` → monarch, `Dragonfly` / `Common_green_darner` / `Anax_junius` → dragonfly, `Luna_moth` / `Actias_luna` → luna moth). Following links in the same tab keeps that insect; open another mapped article (or `?entomon=…`) to switch. Override anywhere with `?entomon=monarch`, `?entomon=dragonfly` or `?entomon=luna-moth`.

Motion lab (buttons and fields, no Wikipedia chrome): http://localhost:5173/lab.html

**Marketing stills** (transparent PNG + SVG wrapper): [`assets/cursor-stills/`](assets/cursor-stills/). Regenerate with `npm run export:cursors` (requires dev server or Playwright will start one).

### Interaction states

All cursors share the same states: idle hover, cruise, dart on fast moves, slower wide-wing hover over links and controls, wing clap and dip on press, soft settle on release, and follow while dragging. Wings flap in every state; cruise adds occasional flat-wing glides. The luna moth's hindwing tails whip and trail behind each wingbeat.

## Live wikipedia.org

```bash
npm run build:inject
```

Load unpacked **`extension/`** in Chrome (`chrome://extensions`), then open a mapped article or click the Entomon toolbar icon on any Wikipedia tab.

## Build

```bash
npm run build          # playground bundle
npm run build:inject   # extension content script → dist/inject.js
```

## Layout

- `src/motion/` — pointer follow, heading, flap profiles, click/drag states
- `src/insects/<id>/` — per-species config, procedural textures, Three.js rig
- `src/render/` — orthographic overlay renderer, shared soft shadows
- `vite.wiki.ts` — Wikipedia HTML proxy for dev
- `extension/` — MV3 wrapper around the inject bundle
