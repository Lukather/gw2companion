# GW2 Companion

<p align="center">
  <img src="img/gw2Companion.png" alt="GW2 Companion" width="100%">
</p>

A local-first web companion for **Guild Wars 2** players. Inspect your account through the lens of the official API and the Wiki: inventory, materials, achievements, story journal, and meta-build comparison for your characters. Runs entirely on your machine — your API key never leaves the box.

---

## Features

- **Home dashboard** — character grid with profession color-coding, last-seen data, and quick navigation.
- **Inventory Analyzer** — scans every bag on every character, fetches current Trading Post prices, and categorizes items as:
  - 💰 **Sell** — high TP value, worth listing
  - 🔨 **Salvage** — materials worth more than the item
  - ⭐ **Keep** — useful for PvE builds or account-bound valuables
  - 👆 **Use** — consumables, containers, unlocks
- **Material Storage** — bank + material-snapshot aggregation with current TP values.
- **Achievement Tracker** — daily + per-account progress bars, category filters.
- **Story Journal** — per-character story progress across all campaigns (Personal Story, LS, IBS, EoD, SotO, Janthir).
- **Build Viewer** — spec, traits, and skills for each of your characters side-by-side with **meta recommendations**, including per-slot equipment suggestions (armor weight, stat prefix, rune/sigil) and stat-prefix match indicators (✓/✗).
- **Wiki enrichment** — optional fetch of item metadata (acquisition, crafting usage) from the official GW2 Wiki.
- **Light & dark theme** — persisted across sessions, with Tailwind-driven design and shadcn-svelte components.
- **Responsive sidebar** — collapsible on mobile, Lucide icons, page transitions.

---

## Tech Stack

**Frontend** — Svelte 5, Vite, Tailwind CSS, shadcn-svelte UI components (hand-built, ~15 components), Lucide icons, Inter font.
**Backend** — Node.js + Express, in-memory API response cache with 5-minute TTL, automatic 429-retry.
**Storage** — local JSON config (`backend/data/config.json`, gitignored).
**External** — ArenaNet GW2 API v2, GW2 Wiki API.

---

## Prerequisites

- [Node.js](https://nodejs.org/) **v18 or newer**
- A **Guild Wars 2 API key** with these permissions:
  - `account` — `/v2/account/*`
  - `characters` — `/v2/characters`
  - `inventories` — character bag contents (Inventory Analyzer)
  - `tradingpost` — TP prices (Inventory, Materials)
  - `progression` — achievements and story journal
  - `builds` — character build tabs (Build Viewer)

  Create one at: <https://account.arena.net/applications>

---

## Quick Start

```bash
git clone https://github.com/Lukather/gw2companion.git
cd gw2companion
npm install              # installs root + backend + frontend (postinstall hook)
npm run dev              # starts backend (:3000) + frontend (:5173) concurrently
```

Open **<http://localhost:5173>**, paste your API key on the setup screen, and you're in.

> The Vite dev server proxies `/api/*` to the Express backend on port 3000, so you don't need to configure CORS for local development. The `PORT` env var overrides the backend port.

---

## Usage

1. **Setup** — enter your API key. It's validated against `/v2/tokeninfo` and persisted to `backend/data/config.json` (gitignored).
2. **Home** — pick a character from the grid. The selection is shared across pages via a Svelte store.
3. **Inventory** — auto-runs an analysis; filter by Sell / Salvage / Keep / Use, or search by item name. Toggle **Include Wiki data** for enriched results (slower).
4. **Materials** — bank + character-bag aggregation with current TP values.
5. **Achievements** — daily and per-account progress, with category filters.
6. **Story** — pick a character to see which Living World / Expansion storylines are completed.
7. **Builds** — pick a character to see active specs/traits/skills vs. meta recommendations, with per-slot equipment suggestions.

The sidebar persists navigation state; the theme toggle is in the header.

---

## Production

Build the frontend and serve everything from Express:

```bash
npm run build            # builds frontend → frontend/dist/
npm start                # starts backend on PORT (default 3000), serves frontend + API
```

Open **<http://localhost:3000>**. The Express server static-serves `frontend/dist/` and mounts the API at `/api/*`.

---

## Architecture

```
   Browser (Svelte SPA)
       │
       │  /api/*   (proxied by Vite in dev, served by Express in prod)
       ▼
   Express backend (Node.js)        ──►  ArenaNet GW2 API v2
       │                            ──►  GW2 Wiki API
       │                            ──►  Local config (data/config.json)
       │
       └─►  /api/debug  (gated: 404 unless NODE_ENV !== 'production')
```

The backend is the **only** component that talks to external services. Your API key is never exposed to the browser beyond the immediate setup screen.

---

## Project Structure

```
gw2-companion/
├── package.json              # Root scripts (concurrently + postinstall)
├── README.md
├── LICENSE                   # MIT
├── SESSION.md                # Dev session notes
├── .gitignore
├── img/
│   ├── gw2Companion.png           # README banner
│   └── gw2_companion_logo_no_sub.svg
├── plans/                    # Design + cleanup plans
│   ├── issues-and-quick-wins.md
│   └── tailwind-redesign.md
│
├── backend/
│   ├── server.js             # Express app, route mounting, static serving
│   ├── db.js                 # API key persistence (JSON file)
│   ├── routes/
│   │   ├── key.js            # /api/key — validate + store
│   │   ├── characters.js     # /api/characters — list + per-character
│   │   ├── inventory.js      # /api/inventory — bag aggregation
│   │   ├── analyze.js        # /api/analyze — full sell/salvage/keep/use
│   │   ├── materials.js      # /api/materials — bank + materials
│   │   ├── achievements.js   # /api/achievements — progress
│   │   ├── story.js          # /api/story — story journal
│   │   ├── builds.js         # /api/builds — specs/traits/skills + meta
│   │   └── debug.js          # /api/debug — dev-only
│   ├── services/
│   │   ├── gw2-api.js        # ArenaNet API client + in-memory cache
│   │   ├── wiki.js           # GW2 Wiki client
│   │   ├── analyzer.js       # Item categorization
│   │   └── utils.js          # Shared helpers
│   └── data/
│       ├── .gitkeep
│       ├── config.json       # gitignored — your API key lives here
│       └── meta-builds.json  # 9 professions, general equipment reference
│
└── frontend/
    ├── vite.config.js        # Proxies /api → :3000
    ├── tailwind.config.js    # Rarity safelist (8 rarities × 2)
    ├── index.html
    └── src/
        ├── main.js
        ├── app.css
        ├── App.svelte        # Sidebar + header + page routing + transitions
        ├── lib/
        │   ├── api.js
        │   ├── stores.js     # hasKey, loading, error, selectedChar, theme
        │   ├── theme.js
        │   ├── utils.js      # cn() — clsx + tailwind-merge
        │   ├── format.js     # formatGold()
        │   ├── professions.js# PROFESSION_COLORS + helper
        │   ├── logo.png
        │   └── components/
        │       ├── Spinner.svelte
        │       └── ui/       # shadcn-svelte components
        │           ├── Button, Card*, Input, Separator, Table*
        │           └── (15 components total)
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

## Caching & Rate Limits

- GW2 API responses are cached in memory for **5 minutes** to avoid hammering the official API and to speed up repeat requests.
- HTTP 429 responses are automatically retried after the `Retry-After` delay the API returns.
- The build specialization list is cached separately (`SPEC_CACHE`) to avoid resolving trait/skill IDs on every request.

---

## Security & Privacy

- **API key is local-only.** It is written to `backend/data/config.json`, which is in `.gitignore`. The backend is the only component that ever sees the key, and the only outbound traffic is to the official GW2 and Wiki APIs.
- **`/api/debug` is gated** — returns 404 when `NODE_ENV=production`. Use dev mode to inspect state.
- **No telemetry, no analytics, no third-party calls** beyond the GW2 API and Wiki.
- **Port is configurable** via the `PORT` env var.

> ⚠️ **If you've ever committed your API key to the repo, treat it as compromised.** Rotate it at <https://account.arena.net/applications> immediately — ArenaNet lets you regenerate at any time.

---

## Ideas / Possible Next Steps

Not a roadmap — just a brainstorm bucket. Nothing here is committed work.

- **"All characters" mode** for Inventory — currently per-character.
- **Per-slot equipment item IDs** in `meta-builds.json` (GuildJen-style precise recommendations, not just prefix/rune suggestions).
- **Build template chat-code import/export** — share loadouts with other players.
- **More meta builds per profession** — condi, support, open-world variants.
- **Persistent per-user meta-build customization** — fork the reference data without editing the JSON.
- **Collapsible sections** on Builds / Achievements (Svelte `slide` transition).
- **Animated progress bars** on Achievements.
- **Unified character selection model** — extend `selectedChar` to carry a target page so Home can route to Builds as easily as Inventory.

---

## License

MIT — see [LICENSE](LICENSE).
