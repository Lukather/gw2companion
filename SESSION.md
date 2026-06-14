# GW2 Companion — Session State (Jun 13–14, 2026)

> Pick up here tomorrow: see **"What to do next"** at the bottom.

---

## Day 3 — Jun 14, 2026: per-slot equipment IDs design + PRD + 7 issues

### What changed

- **Designed the per-slot equipment item IDs feature** for the Build Viewer. Replaces today's synthetic `"Berserker's Heavy Helm"` right-column string with the actual meta item (name + icon + wiki link) + a three-state match indicator (✓ exact / ~ same prefix / ✗ different prefix).
- **Spiked the GW2 build template chat code decoder.** The format contains only skills, traits, specializations, and weapon **type** IDs — **no equipment data at all**. Killed the "use chat codes as the data source" idea (which would have simplified curation 10×) and reverted to manual name→ID resolution with a helper script.
- **Wrote a comprehensive PRD** at `plans/per-slot-equipment-ids-prd.md` (~700 lines, 27 user stories, schema, work order, testing strategy, out-of-scope list).
- **Published 8 issues** to the GitHub repo: 1 parent PRD + 7 vertical slices. Created two triage labels: `ready-for-agent` (green, AFK) and `ready-for-human` (red-orange, HITL).
- **All design decisions locked in** (Q1–Q6 + helper + spike finding). See "Decisions table" below.

### Design decisions (locked in)

| #  | Decision                | Choice                                                                                          |
| -- | ----------------------- | ----------------------------------------------------------------------------------------------- |
| 1  | Granularity             | A — 1 build per profession, 9 builds for v1                                                     |
| 2  | Slot coverage           | A — 15 core slots (6 armor + 5 trinkets + 4 weapons), skip backpack/aquatic/gathering           |
| 3  | Schema                  | A — IDs only in JSON, resolved at request time; keep `prefix`/`weapons`/`runes`/`sigils` intact  |
| 4  | Match semantics         | B — three-state ✓ exact / ~ same prefix / ✗ different prefix                                     |
| 5  | Data source             | D — Snowcrows for v1, hardstuck.gg for v2 variants; helper resolves names or `{ statPrefix, slot }` to IDs |
| 6  | Right-column rendering  | A — resolved item when curated, synthetic string fallback when not                              |
| —  | Helper script           | `scripts/resolve-meta-items.js`, `--dry-run` default, `--write` to mutate                       |
| —  | Chat code               | Spike proved no equipment data; used only for skill/trait/spec cross-validation in the helper   |

### Commits added today

```
c4a7b01 chore: add build code decoder spike
e7f6293 docs: add PRD for per-slot equipment item IDs
```

### New files

- `plans/per-slot-equipment-ids-prd.md` — the full PRD
- `scripts/spike-decode-build.mjs` — the build code decoder spike (reference; folded into the helper script in issue #3)

### New GitHub infrastructure

- **Label `ready-for-agent`** (green `#0E8A16`) — for AFK slices
- **Label `ready-for-human`** (red-orange `#D93F0B`) — for HITL slices
- **Issue #1**: PRD (parent, ready-for-agent)
- **Issues #2–#8**: the 7 vertical slices (see "Issues graph" below)

### Issues graph (8 issues, with dependency arrows)

```
#2  helm POC end-to-end  ──▶  #5  three-state match  ──▶  #7  summary count
                                                       ▲
#3  helper: name→ID     ──▶  #6  helper: stat-shorthand ┘
                                                       │
                                                       ▼
                                                      #8  curate 9 builds (HITL)

#4  helper: chat-code cross-validation  ──▶ (optional) #8
```

**Three independent starting points — three AFK agents can work in parallel:**

- **#2** (helm POC) — proves the UI pipeline end-to-end on one slot, one build
- **#3** (helper script basic) — the curator's tool, name→ID resolution
- **#4** (chat-code cross-validation) — independent validation feature

### Mini-quirk introduced today

`@gw2/chatlink@0.1.1` (MIT, 12 KB) is the library we settled on for chat-code decoding. It supports the `BuildTemplate` type out of the box. The spike imports it from a local tarball; the helper script in #3 should add it as a devDependency.

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
│   ├── tailwind-redesign.md
│   └── per-slot-equipment-ids-prd.md   # PRD for per-slot item IDs    (Day 3)
├── scripts/                            #                                     (Day 3)
│   └── spike-decode-build.mjs          # Chat code decoder reference
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
- Meta builds have general equipment recommendations, not per-slot item IDs. **Being addressed** by issues #2–#8 (parent #1).
- **API key in `backend/data/config.json` is gitignored** — must be entered manually on first run. Out-of-band key rotation still pending (leaked key is in pushed history, treat as compromised).
- **Tailwind `safelist`** in `tailwind.config.js` covers 8 rarities × 2 properties for Inventory's dynamic class names. New rarity colors must be added to the safelist regex + `tailwind.config.js` color block together.
- **`favicon.svg` and `logo.svg` are intentionally duplicate** (Day 2) — keep in sync when the brand changes. See "Mini-quirk introduced today" above.
- **`@gw2/chatlink` is referenced by the spike but not yet in any `package.json`** (Day 3). The helper script in issue #3 should add it as a devDependency.

---

## What to do next

> **Tomorrow's first commit should be [issue #2](https://github.com/Lukather/gw2companion/issues/2) (helm POC).** It's the smallest end-to-end slice, the most demoable, and unblocks #5 and #7. Estimated effort: ~2 hours.

### Work order (8 issues, dependency-driven)

| #  | Title                                                          | Type     | Blocked by           |
| -- | -------------------------------------------------------------- | -------- | -------------------- |
| [1](https://github.com/Lukather/gw2companion/issues/1) | PRD: per-slot equipment item IDs (parent)                      | —        | —                    |
| [2](https://github.com/Lukather/gw2companion/issues/2) | Helm POC end-to-end (one slot, one build)                      | AFK      | —                    |
| [3](https://github.com/Lukather/gw2companion/issues/3) | Helper script: name→ID resolution                              | AFK      | —                    |
| [4](https://github.com/Lukather/gw2companion/issues/4) | Helper script: chat-code cross-validation                      | AFK      | —                    |
| [5](https://github.com/Lukather/gw2companion/issues/5) | Three-state match indicator per slot                           | AFK      | #2                   |
| [6](https://github.com/Lukather/gw2companion/issues/6) | Helper script: stat-selectable shorthand                       | AFK      | #3                   |
| [7](https://github.com/Lukather/gw2companion/issues/7) | Summary count "X ✓ · Y ~ · Z ✗"                                | AFK      | #5                   |
| [8](https://github.com/Lukather/gw2companion/issues/8) | Curate per-slot IDs for all 9 Power builds                     | **HITL** | #3, #6 (#4 optional) |

After #2 lands, three parallel work streams can run: #3 + #4 (infrastructure), and #5 (depends on #2). Then #6 → #7 → #8.

### Other ideas (not yet started)

The full brainstorm (build template chat-code import/export, more meta builds per profession, animated progress bars on Achievements, collapsible sections on Builds/Achievements, persistent per-user meta-build customization, "All characters" mode for Inventory, unified `selectedChar` model) lives in `README.md` under "Ideas / Possible Next Steps." Pick from there if the per-slot IDs work is done and you want a different challenge.

### What NOT to do

- Don't commit `backend/data/config.json` (already gitignored, but easy to forget).
- Don't `git push` without `git pull` first — the project is solo but other devices (yours, presumably the screenshot commit) can land commits between sessions.
- Don't `git rm nul` if you ever see it again — just `rm` it. (See CONTRIBUTING.md "Don't commit" for why.)
- Don't refactor the side-by-side equipment comparison in `Builds.svelte` without re-reading Day 1's "Builds page improvements" bullet — there's context on why certain layout decisions were made.
- Don't start a per-slot IDs implementation without first reading `plans/per-slot-equipment-ids-prd.md` — the schema, match semantics, and helper script behavior are all locked in there. Re-deriving them risks drift.
- Don't close or modify [issue #1](https://github.com/Lukather/gw2companion/issues/1) (the parent PRD). It's a reference for the child issues.
