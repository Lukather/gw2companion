# GW2 Companion — Session State (Jun 13–14, 2026)

> Pick up here tomorrow: see **"What to do next"** at the bottom.

---

## Day 2 — Jun 14, 2026: repo linking, brand cleanup

### What changed

- **Linked local folder to GitHub.** Initialized git, kept the existing remote `LICENSE` (MIT, 2026 Lorenzo Strambi) as the parent commit, first push was a clean fast-forward (no force needed). Repo: <https://github.com/Lukather/gw2companion.git>
- **Deleted the stray `nul` file** (47 bytes, Windows reserved device name — artifact of a botched `>nul` shell redirect). Just `rm`'d, not `git rm`'d.
- **Rewrote `README.md`** to match reality. Was meaningfully out of date: only mentioned 2 pages (real: 7), listed shipped features as "Future Features", missed 3 of 6 API key permissions, Project Structure tree was missing ~80% of files. Now has a hero banner, Tech Stack section, complete permissions list, accurate Project Structure, and a Security & Privacy section that calls out the leaked-key note.
- **Added `CONTRIBUTING.md`** establishing [Conventional Commits](https://www.conventionalcommits.org/) as the project convention. Going forward: `feat:`, `fix:`, `docs:`, `refactor:`, `style:`, `perf:`, `chore:` etc. with optional scope. The two docs commits and the three follow-up commits all use the format.
- **Added SVG favicon** (`frontend/public/favicon.svg`) — extracted the shield from the existing horizontal lockup into an icon-sized SVG. Replaces Vite's 1×1 transparent placeholder.
- **Fixed sidebar logo bug.** `frontend/src/lib/logo.png` was 1.4 MB and turned out to be the **README banner** (same MD5 as `img/gw2Companion.png`), rendered at h-11 (~44 px). Replaced with `frontend/src/lib/logo.svg` (1.6 KB), −1,386,140 bytes on disk, same artwork as the favicon.

### Commits added today (chronological)

```
678b5d1 perf(frontend): replace 1.4 MB sidebar logo with SVG
8380d73 feat(frontend): add SVG favicon
acd4e0e docs: add CONTRIBUTING.md with conventional commit guidelines
2bc5534 Add image to README for visual enhancement   (you, from another device)
a9d8afd docs: rewrite README to match current project state
```

(`3f853b5 Initial implementation` and `cb6882b Initial commit` are older.)

### New files this session

- `CONTRIBUTING.md` — commit + collaboration conventions
- `frontend/public/favicon.svg` — shield favicon (1.6 KB)
- `frontend/src/lib/logo.svg` — sidebar logo, same artwork as favicon (1.6 KB)

### Files deleted this session

- `nul` (root) — Windows reserved-name artifact
- `frontend/src/lib/logo.png` — was the README banner used in the wrong place

### Mini-quirk introduced today

`frontend/public/favicon.svg` and `frontend/src/lib/logo.svg` are byte-for-byte identical and **should stay that way** when the brand changes. They live in different folders because Vite needs them there (HTML `<link>` resolves from `public/`, JS `import` resolves from `src/`). For 1.6 KB this is fine; if it ever bothers you, a `npm run sync:brand` script that copies one to the other is ~5 lines.

---

## Day 1 — Jun 13, 2026: Tailwind + shadcn-svelte redesign

### Major changes this session

#### Tailwind CSS + shadcn-svelte redesign
- Replaced ~800 lines of custom CSS across all pages with Tailwind utilities
- Integrated shadcn-svelte components: Button, Card, Input, Badge, Separator, Table (all 14 UI components hand-built for Svelte 5)
- Dark mode via Tailwind `dark:` prefix + `.dark` class on `<html>`
- Inter font, consistent spacing/sizing, responsive sidebar
- **All `<style>` blocks removed** from pages — zero custom CSS

#### New layout
- **Sidebar** (collapsible on mobile) with Lucide icons
- **Home page** as default landing: app description + character grid
- Click character → auto-navigates to Inventory with analysis pre-loaded
- Shield logo (clickable → Home) in sidebar header
- Page transitions (fade, 150ms) on navigation

#### Builds page improvements
- Two-column equipment comparison: character item (left) vs meta recommendation (right)
- Rarity-colored left borders on equipment items
- Consolidated meta warning badges (per-section instead of per-skill)
- Stat prefix comparison with ✓/✗ indicators
- Generated per-slot meta suggestions (armor weight + prefix + rune/sigil)
- Wider skill slots with hover tooltips for truncated names
- Tighter trait grid (name | checkmark columns)

#### Bug fixes
- **Story journal**: Backend now properly fetches `/v2/stories/seasons` and `/v2/stories` to map story IDs → campaigns. Previously treated `char.story` as object instead of flat array.
- **`children` snippet**: All 14 UI components now explicitly destructure `children` from `$props()` — required for Svelte 5 `{@render children?.()}` to work.
- **`class:` directive**: Replaced `class:bg-action-sell-bg/10={condition}` patterns — Svelte's `class:` doesn't support `/` in class names.

#### Home page + character selection
- Extracted character grid from Inventory into new `Home.svelte`
- `selectedChar` writable store in `stores.js` — shared between Home and Inventory
- `$effect` in App.svelte auto-navigates to Inventory when character selected

#### Post-redesign cleanup (see `plans/issues-and-quick-wins.md`)
- **Repo hygiene** — added root `gw2-companion/.gitignore` (covers `node_modules/`, `frontend/dist/`, `backend/data/config.json`, `*.bak`, etc.) and `backend/data/.gitkeep` so the data dir stays tracked. Deleted `App.svelte.bak`, `Inventory.svelte.bak2`, unused `Badge.svelte` (UI component), and unused `logo-shield.svg`.
- **Tailwind safelist** — Inventory's per-row rarity badges were built via template literal (`bg-rarity-${rarity}-bg`), which Tailwind's content scanner can't see. Added a regex `safelist` in `tailwind.config.js` covering 8 rarities × 2 properties (bg/fg). Build now contains all 16 classes.
- **Shared helpers** — extracted `PROFESSION_COLORS` to `lib/professions.js` (was duplicated in Home/Inventory/Story), `formatGold()` to `lib/format.js` (was duplicated in Inventory/Materials), and a shared `lib/components/Spinner.svelte` using Lucide's `Loader2` (replaced 6 inline spinner SVGs across pages).
- **Polished** — removed 3 debug `console.*` from `main.js`. Simplified `loadStage` init in Inventory (was a non-reactive `$state($selectedChar ? ...)` snapshot). Gated `/api/debug` behind `NODE_ENV !== 'production'` (404 in prod, 200 in dev). Confirmed `PORT` env-var read was already in place.
- **Bundle** — JS dropped 157.4 kB → 155.4 kB after dedup. CSS unchanged.

---

## Current features (all working)

| Feature                                                  | Status |
| -------------------------------------------------------- | ------ |
| API key setup & validation                               | ✅     |
| Home page (app intro + character grid)                   | ✅     |
| Character selection → Inventory analysis                 | ✅     |
| Item categorization: sell / salvage / keep / use         | ✅     |
| Trading Post prices                                      | ✅     |
| Light/dark theme (persisted)                             | ✅     |
| **Material Storage** analyzer                            | ✅     |
| **Achievement Tracker** (progress bars, filters)         | ✅     |
| **Story Journal** (per-character, all campaigns)         | ✅     |
| **Build Viewer** (specs/traits/skills vs meta)           | ✅     |
| Sidebar nav (Home · Inventory · Materials · Builds · Achievements · Story · Setup) | ✅     |
| SVG favicon (Day 2)                                      | ✅     |
| Conventional Commits convention (Day 2)                  | ✅     |

---

## How to start (tomorrow)

```bash
cd gw2-companion
git pull                  # sync with remote first
npm install               # postinstall hooks install backend + frontend
npm run dev               # backend :3000, frontend :5173
```

If a `git pull` brings new commits, read the bodies — follow any `BREAKING CHANGE:` footers.

Commit messages follow Conventional Commits (see `CONTRIBUTING.md`). One logical change per commit, scope in parens when useful (e.g. `feat(builds): ...`, `fix(analyzer): ...`).

---

## Key files

```
gw2-companion/
├── package.json              # Root scripts (concurrently + postinstall)
├── README.md                 # Hero, features, tech stack, setup, security
├── CONTRIBUTING.md           # Conventional Commits + dev conventions  (Day 2)
├── LICENSE                   # MIT
├── SESSION.md                # This file
├── .gitignore
├── img/
│   ├── gw2Companion.png           # README banner
│   └── gw2_companion_logo_no_sub.svg
├── plans/
│   ├── issues-and-quick-wins.md
│   └── tailwind-redesign.md
│
├── backend/
│   ├── server.js             # Express app, route mounting, static serving
│   ├── db.js                 # API key persistence (JSON file)
│   ├── routes/
│   │   ├── key.js            # /api/key — validate + store
│   │   ├── characters.js
│   │   ├── inventory.js
│   │   ├── analyze.js
│   │   ├── materials.js
│   │   ├── achievements.js
│   │   ├── story.js          # FIXED: fetches /v2/stories/seasons + /v2/stories
│   │   ├── builds.js         # extractPrefix() for stat comparison
│   │   └── debug.js          # GATED: 404 unless NODE_ENV !== 'production'
│   ├── services/
│   │   ├── gw2-api.js        # ArenaNet API client + in-memory cache
│   │   ├── wiki.js
│   │   ├── analyzer.js
│   │   └── utils.js
│   └── data/
│       ├── .gitkeep
│       ├── config.json       # gitignored — your API key lives here
│       └── meta-builds.json  # 9 professions, general equipment (prefix/weapons/runes/sigils)
│
└── frontend/
    ├── vite.config.js        # Proxies /api → :3000
    ├── tailwind.config.js    # Rarity safelist (8 rarities × 2)
    ├── index.html            # <link rel="icon" href="/favicon.svg">  (Day 2)
    ├── public/
    │   └── favicon.svg       # Shield favicon                          (Day 2)
    └── src/
        ├── main.js
        ├── app.css
        ├── App.svelte        # Sidebar + header + page routing + transitions
        ├── lib/
        │   ├── api.js
        │   ├── stores.js     # hasKey, loading, error, selectedChar
        │   ├── theme.js
        │   ├── utils.js      # cn() — clsx + tailwind-merge
        │   ├── format.js     # formatGold()
        │   ├── professions.js# PROFESSION_COLORS + helper
        │   ├── logo.svg      # Shield logo, mirrors favicon.svg       (Day 2)
        │   └── components/
        │       ├── Spinner.svelte
        │       └── ui/       # shadcn-svelte components (Button, Card*, Input,
        │                     #   Separator, Table*) — 15 total
        └── pages/
            ├── Home.svelte
            ├── Setup.svelte
            ├── Inventory.svelte
            ├── Materials.svelte
            ├── Achievements.svelte
            ├── Story.svelte
            └── Builds.svelte
```

---

## Known quirks

- `util._extend` deprecation warning from npm/concurrently — harmless.
- Meta builds use **trait/skill NAMES** (resolved to IDs at runtime via GW2 API).
- Builds backend caches specialization list in memory (`SPEC_CACHE`).
- shadcn-svelte components built manually (CLI requires TTY + Tailwind v4).
- Equipment stat prefix extraction uses a hardcoded list — may miss some prefixes.
- Meta builds have general equipment recommendations, not per-slot item IDs.
- **API key in `backend/data/config.json` is gitignored** — must be entered manually on first run. Out-of-band key rotation still pending (leaked key is in pushed history, treat as compromised).
- **Tailwind `safelist`** in `tailwind.config.js` covers 8 rarities × 2 properties for Inventory's dynamic class names. New rarity colors must be added to the safelist regex + `tailwind.config.js` color block together.
- **`favicon.svg` and `logo.svg` are intentionally duplicate** (Day 2) — keep in sync when the brand changes. See "Mini-quirk introduced today" above.

---

## What to do next

> Three concrete picks, ordered roughly by impact-to-effort. Read the linked context, then dive in.

### 1. `"All characters" mode` for Inventory — **~½ day**

Right now Inventory is per-character (select on Home → analyze). The backend already aggregates per-character data; the change is mostly a UI toggle on `Inventory.svelte` and a way to call `/api/analyze` without a `?char=` param (or with a sentinel value).

**Touch points:** `frontend/src/pages/Inventory.svelte`, possibly `backend/routes/analyze.js` (verify the aggregation handles "all" already), `frontend/src/pages/Home.svelte` (add a top-level "Analyze all" button next to character tiles).

**Why it's good first:** low risk, real UX win, exercises the Svelte 5 store + `$effect` plumbing that other features will need.

### 2. Per-slot equipment item IDs in `meta-builds.json` — **~1–2 days**

Currently `meta-builds.json` has general equipment recommendations (prefix/weapons/runes/sigils per profession, not per slot). Next step: real item IDs per slot, GuildJen-style, so the Builds page can suggest "equip Carrion Pants of the Warrior" instead of "Power/precision/ferocity on medium armor legs."

**Touch points:** `backend/data/meta-builds.json` (data curation — biggest chunk), `backend/services/analyzer.js` (item-ID resolution), `frontend/src/pages/Builds.svelte` (left-column rendering may need to show item icons).

**Why it's good second:** biggest user-facing value (the whole point of the Builds page), data work, not UI.

### 3. Unify `selectedChar` model across pages — **~2–3 hours**

Deferred from the Jun 13 cleanup. Currently `Builds.svelte` has its own page-local character picker; the `selectedChar` store is only used by Home → Inventory. Extend the store to `{ char, targetPage }` so the Home grid can route to either Inventory or Builds from a single click. Removes a UI inconsistency.

**Touch points:** `frontend/src/lib/stores.js`, `frontend/src/pages/Home.svelte`, `frontend/src/pages/Builds.svelte`, `frontend/src/pages/Inventory.svelte`, `frontend/src/App.svelte` (routing).

**Why it's good third:** small scope, sets up the routing for #1, tightens the model so future "open Inventory for X but in Builds context" features are easy.

### More ideas

The full brainstorm (build template chat-code import/export, more meta builds per profession, animated progress bars, collapsible sections on Builds/Achievements, persistent per-user meta-build customization, wiki-extracted trait names on Refresh Meta) lives in `README.md` under "Ideas / Possible Next Steps." Pick from there if none of the above call to you.

### What NOT to do

- Don't commit `backend/data/config.json` (already gitignored, but easy to forget).
- Don't `git push` without `git pull` first — the project is solo but other devices (yours, presumably the screenshot commit) can land commits between sessions.
- Don't `git rm nul` if you ever see it again — just `rm` it. (See CONTRIBUTING.md "Don't commit" for why.)
- Don't refactor the side-by-side equipment comparison in `Builds.svelte` without re-reading Day 1's "Builds page improvements" bullet — there's context on why certain layout decisions were made.
