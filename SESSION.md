# GW2 Companion — Session State (Jun 13, 2026)

## Major changes this session

### Tailwind CSS + shadcn-svelte redesign
- Replaced ~800 lines of custom CSS across all pages with Tailwind utilities
- Integrated shadcn-svelte components: Button, Card, Input, Badge, Separator, Table (all 14 UI components hand-built for Svelte 5)
- Dark mode via Tailwind `dark:` prefix + `.dark` class on `<html>`
- Inter font, consistent spacing/sizing, responsive sidebar
- **All `<style>` blocks removed** from pages — zero custom CSS

### New layout
- **Sidebar** (collapsible on mobile) with Lucide icons
- **Home page** as default landing: app description + character grid
- Click character → auto-navigates to Inventory with analysis pre-loaded
- Shield logo (clickable → Home) in sidebar header
- Page transitions (fade, 150ms) on navigation

### Builds page improvements
- Two-column equipment comparison: character item (left) vs meta recommendation (right)
- Rarity-colored left borders on equipment items
- Consolidated meta warning badges (per-section instead of per-skill)
- Stat prefix comparison with ✓/✗ indicators
- Generated per-slot meta suggestions (armor weight + prefix + rune/sigil)
- Wider skill slots with hover tooltips for truncated names
- Tighter trait grid (name | checkmark columns)

### Bug fixes
- **Story journal**: Backend now properly fetches `/v2/stories/seasons` and `/v2/stories` to map story IDs → campaigns. Previously treated `char.story` as object instead of flat array.
- **`children` snippet**: All 14 UI components now explicitly destructure `children` from `$props()` — required for Svelte 5 `{@render children?.()}` to work.
- **`class:` directive**: Replaced `class:bg-action-sell-bg/10={condition}` patterns — Svelte's `class:` doesn't support `/` in class names.

### Home page + character selection
- Extracted character grid from Inventory into new `Home.svelte`
- `selectedChar` writable store in `stores.js` — shared between Home and Inventory
- `$effect` in App.svelte auto-navigates to Inventory when character selected

### Post-redesign cleanup (see `plans/issues-and-quick-wins.md`)
- **Repo hygiene** — added root `gw2-companion/.gitignore` (covers `node_modules/`, `frontend/dist/`, `backend/data/config.json`, `*.bak`, etc.) and `backend/data/.gitkeep` so the data dir stays tracked. Deleted `App.svelte.bak`, `Inventory.svelte.bak2`, unused `Badge.svelte` (UI component), and unused `logo-shield.svg`.
- **Tailwind safelist** — Inventory's per-row rarity badges were built via template literal (`bg-rarity-${rarity}-bg`), which Tailwind's content scanner can't see. Added a regex `safelist` in `tailwind.config.js` covering 8 rarities × 2 properties (bg/fg). Build now contains all 16 classes.
- **Shared helpers** — extracted `PROFESSION_COLORS` to `lib/professions.js` (was duplicated in Home/Inventory/Story), `formatGold()` to `lib/format.js` (was duplicated in Inventory/Materials), and a shared `lib/components/Spinner.svelte` using Lucide's `Loader2` (replaced 6 inline spinner SVGs across pages).
- **Polished** — removed 3 debug `console.*` from `main.js`. Simplified `loadStage` init in Inventory (was a non-reactive `$state($selectedChar ? ...)` snapshot). Gated `/api/debug` behind `NODE_ENV !== 'production'` (404 in prod, 200 in dev). Confirmed `PORT` env-var read was already in place.
- **Bundle** — JS dropped 157.4 kB → 155.4 kB after dedup. CSS unchanged.

## How to start

```bash
cd gw2-companion
npm run dev
```
Backend: `http://localhost:3000` | Frontend: `http://localhost:5173`

## Current features (all working)

| Feature | Status |
|---|---|
| API key setup & validation | ✅ |
| Home page (app intro + character grid) | ✅ |
| Character selection → Inventory analysis | ✅ |
| Item categorization: sell / salvage / keep / use | ✅ |
| Trading Post prices | ✅ |
| Light/dark theme (persisted) | ✅ |
| **Material Storage** analyzer | ✅ |
| **Achievement Tracker** (progress bars, filters) | ✅ |
| **Story Journal** (per-character, all campaigns) | ✅ |
| **Build Viewer** (specs/traits/skills vs meta, equipment comparison) | ✅ |
| Sidebar navigation (Home | Inventory | Materials | Builds | Achievements | Story | Setup) | ✅ |

## Key files

```
gw2-companion/
├── .gitignore               # NEW: node_modules/, dist/, config.json, *.bak, ...
└── backend/
    ├── routes/
    │   ├── story.js         # FIXED: fetches /v2/stories/seasons + /v2/stories
    │   ├── builds.js        # extractPrefix() for stat comparison
    │   └── debug.js         # GATED: 404 unless NODE_ENV !== 'production'
    └── data/
        └── meta-builds.json # 9 professions, general equipment (prefix/weapons/runes/sigils)

frontend/src/
├── App.svelte               # Sidebar + header + page routing + fade transitions
├── app.css                  # Tailwind directives + shadcn CSS variables
├── main.js                  # Mount point, imports app.css
├── lib/
│   ├── api.js               # Frontend HTTP client
│   ├── stores.js            # hasKey, loading, error, selectedChar
│   ├── theme.js             # Dark/light toggle via .dark class on <html>
│   ├── utils.js             # cn() classname merger (clsx + tailwind-merge)
│   ├── professions.js       # NEW: PROFESSION_COLORS + professionColor() helper
│   ├── format.js            # NEW: formatGold() helper
│   ├── logo.png             # Sidebar logo
│   ├── components/
│   │   ├── Spinner.svelte   # NEW: shared loading spinner (Loader2 from lucide)
│   │   └── ui/              # 13 shadcn-svelte components (Badge removed in cleanup)
│   │       ├── Button.svelte, Card.svelte, CardHeader.svelte, ...
│   │       ├── Input.svelte, Separator.svelte
│   │       └── Table.svelte, TableHeader.svelte, TableRow.svelte, ...
└── pages/
    ├── Home.svelte          # App intro + character grid
    ├── Setup.svelte         # API key entry
    ├── Inventory.svelte     # Character inventory analysis
    ├── Materials.svelte     # Material storage
    ├── Builds.svelte        # Build viewer + meta comparison + equipment stats
    ├── Achievements.svelte  # Achievement tracking
    └── Story.svelte         # Story journal per character

plans/
└── issues-and-quick-wins.md # Post-redesign cleanup plan (executed this session)
```

## Known quirks

- `util._extend` deprecation warning from npm/concurrently — harmless
- Meta builds use **trait/skill NAMES** (resolved to IDs at runtime via GW2 API)
- Builds backend caches specialization list in memory (`SPEC_CACHE`)
- shadcn-svelte components built manually (CLI requires TTY + Tailwind v4)
- Equipment stat prefix extraction uses hardcoded prefix list — may miss some prefixes
- Meta builds have general equipment recommendations, not per-slot item IDs
- **API key in `backend/data/config.json` is gitignored** — must be entered manually on first run. Out-of-band key rotation still pending (leaked key is in pushed history, treat as compromised).
- **Tailwind `safelist`** in `tailwind.config.js` covers 8 rarities × 2 properties for Inventory's dynamic class names. New rarity colors must be added to the safelist regex + `tailwind.config.js` color block together.

## Next steps / ideas

- [ ] **(Deferred from cleanup)** Unify `selectedChar` model across Home/Inventory/Builds — extend store with `{ char, targetPage }` so Home click can route to Inventory or Builds. Currently Builds has its own page-local state.
- [ ] **(Deferred from cleanup)** Persist `getBuildPages` results back to `meta-builds.json` — currently `/api/builds/refresh-meta` only updates the timestamp.
- [ ] Expand meta-builds.json with per-slot equipment item IDs (GuildJen-style)
- [ ] "All characters" option for Inventory analysis
- [ ] Auto-extract trait/skill names from wiki on Refresh Meta
- [ ] Build template chat code import/export
- [ ] More meta builds per profession (condi, support, open-world)
- [ ] Persistent per-user meta build customization
- [ ] Collapsible sections on Builds/Achievements pages (Svelte `slide` transition)
- [ ] Progress bar animations on Achievements
