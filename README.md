# GW2 Companion

A local webapp companion for Guild Wars 2 players (PvE focus). Analyzes your character inventory, fetches Trading Post prices, and gives actionable suggestions: what to sell, salvage, keep, or use.

## Features

- **🔐 Secure API Key Storage** — Your GW2 API key is stored locally on your machine, never sent to any third party.
- **📊 Inventory Analyzer** — Scans all your characters' bags, fetches current TP prices, and categorizes every item as:
  - 💰 **Sell** — High TP value, worth listing
  - 🔨 **Salvage** — Materials worth more than the item
  - ⭐ **Keep** — Useful for PvE builds or account-bound valuable items
  - 👆 **Use** — Consumables, containers, unlocks
- **🏷️ Wiki Integration** — Optionally fetch item metadata from the official GW2 Wiki (acquisition methods, crafting usage).
- **💰 Gold Value** — See total inventory value and potential gold from selling recommended items.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or newer
- A Guild Wars 2 API key with these permissions:
  - `characters` — to read character data
  - `inventories` — to read bag contents
  - `tradingpost` — to fetch current TP prices (optional but recommended)

Create an API key at: https://account.arena.net/applications

## Quick Start

```bash
# 1. Clone or download this repository
cd gw2-companion

# 2. Install dependencies
npm install

# 3. Start the app (backend + frontend concurrently)
npm run dev
```

The app will open at **http://localhost:5173** in your browser.

> The backend server runs on port 3000. The frontend dev server proxies API calls to the backend automatically.

## Usage

1. **Enter your API key** on the setup screen. It will be validated against the GW2 API.
2. Once validated, you're taken to the **Inventory Analyzer**.
3. Click **Re-analyze** to scan all your characters' bags.
4. Filter by action type (sell/salvage/keep/use) or search by item name.
5. Toggle **Include Wiki data** for enrichment (adds some extra time to analysis).

## Production Mode

To build and serve the production version:

```bash
npm run build   # Builds the frontend to frontend/dist/
npm start       # Starts the backend on port 3000, serving the frontend
```

Then open **http://localhost:3000**.

## Architecture

```
Browser (Svelte SPA) ←→ Backend (Express) ←→ GW2 Official API
                                   ←→ GW2 Wiki API
                                   ←→ Local JSON config
```

The backend proxies all GW2 API calls so your API key never leaves your machine's local network.

## Project Structure

```
gw2-companion/
├── package.json            # Root scripts
├── backend/
│   ├── server.js           # Express server
│   ├── db.js               # API key persistence (JSON file)
│   ├── routes/
│   │   ├── key.js          # API key validation & storage
│   │   ├── characters.js   # Character listing
│   │   ├── inventory.js    # Inventory aggregation
│   │   └── analyze.js      # Full analysis engine
│   └── services/
│       ├── gw2-api.js      # GW2 official API client (with caching)
│       ├── wiki.js         # Wiki API client
│       └── analyzer.js     # Item categorization logic
└── frontend/
    ├── src/
    │   ├── App.svelte      # Root component
    │   ├── lib/
    │   │   ├── api.js      # Frontend HTTP client
    │   │   └── stores.js   # Svelte stores
    │   └── pages/
    │       ├── Setup.svelte    # API key entry
    │       └── Inventory.svelte # Main analyzer view
    └── vite.config.js
```

## Caching

The backend caches GW2 API responses in memory for 5 minutes to reduce repeated calls and avoid rate limiting. Rate-limited requests (HTTP 429) are automatically retried after the specified delay.

## Future Features (Planned)

- Character Overview (level, race, profession, equipment)
- Build Viewer (traits/skills, compare to meta PvE builds)
- Material Storage Analyzer
- Achievement Tracker

## License

MIT
