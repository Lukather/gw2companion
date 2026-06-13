# Post-Redesign Cleanup Plan

## Context

The recent Tailwind v3 + shadcn-svelte redesign (per `SESSION.md`) is complete and the
app is working end-to-end. A fresh code review surfaced a mix of **operational risks**
(leaked credentials, missing `.gitignore`), **latent bugs** (Tailwind JIT missing
dynamic class names, possibly invisible rarity badges), **dead code** (`.bak` files,
unused `Badge.svelte` + `logo-shield.svg`), and **duplication** (`formatGold`,
`professionColors`, spinner SVG, `selectedChar` story). This plan captures them in
one place and proposes a sequenced set of fixes.

## Issues & Risks (ranked)

### 🔴 Critical — security / data
1. **Plaintext API key in repo** — `backend/data/config.json` contains a real GW2
   API key. The repo at `git@github.com:Lukather/gw2companion.git` is now live, so
   the key may already be in commit history. **Treat as compromised.**
2. **No `.gitignore`** — `node_modules/`, `frontend/dist/`, `.bak` files would all
   be committed alongside the key.

### 🟠 High — visible user-facing bugs
3. **Tailwind JIT likely missing dynamic rarity classes.**
   `Inventory.svelte:39` builds the badge class via template literal:
   ```js
   return `bg-rarity-${(rarity || 'basic').toLowerCase()}-bg text-rarity-${...}-fg`;
   ```
   Tailwind's content scanner only matches **literal** class strings. The
   constructed classes (`bg-rarity-rare-bg`, etc.) are absent from the generated
   CSS, so per-row rarity badges likely render unstyled. The summary cards are
   fine because they use literal `border-action-*-bg` etc. everywhere.

### 🟡 Medium — cleanup & code quality
4. **Dead code:**
   - `frontend/src/App.svelte.bak` (5.4 KB)
   - `frontend/src/pages/Inventory.svelte.bak2` (14.6 KB)
   - `frontend/src/lib/components/ui/Badge.svelte` (defined, never imported)
   - `frontend/src/lib/logo-shield.svg` (referenced in SESSION.md, never imported)
5. **Duplicated helpers across pages** — 5 places repeat the same code:
   - `professionColors` map (Home, Inventory, Story) — 3 verbatim copies
   - `formatGold(value)` (Inventory, Materials) — 2 verbatim copies
   - Spinner SVG block (Home, Inventory, Materials, Achievements, Story, Builds) — 6 copies
6. **Inconsistent character-selection model:**
   - Home + Inventory share a global `selectedChar` writable store (so Home click
     routes to Inventory).
   - Builds has its own **page-local** `selectedChar` and a separate character
     picker. Clicking a character in Home only routes to Inventory, not Builds.

### 🟢 Low — polish
7. **Non-reactive initializer in `Inventory.svelte:43`**:
   ```js
   let loadStage = $state($selectedChar ? 'loading' : 'selecting');
   ```
   Evaluated once at mount. Functionally OK (the `$effect` overwrites it), but
   misleading. Should be `$derived(...)` or just dropped.
8. **`/api/builds/refresh-meta` doesn't persist** the wiki search results — just
   updates the `lastUpdated` timestamp. SESSION.md lists this as a known gap.
9. **`/api/story?all=true` is implemented but never called** from the frontend.
10. **44 `console.log`/`console.error` calls** in production code — mostly backend
    (fine for a local tool) but a few in `main.js`/`stores.js` could be removed.
11. **`/api/debug` is unauthenticated** and leaks internals — fine locally, gate
    or remove for production.
12. **CORS allows `*`** — fine for local, unsafe if deployed.
13. **Hardcoded `:3000` in `server.js`** — no env-var override.
14. **`extractPrefix()` in `builds.js:130`** uses a hardcoded list of ~30 prefixes.
15. **Two `tsconfig.json` + `jsconfig.json`** with identical content.

## Approach (sketch)

1. **Hygiene first** — add `.gitignore`, delete dead files. (Low-risk, unblocks
   safe git use.)
2. **Rotate the API key** outside the repo (separate concern; just don't commit
   the new one either).
3. **Fix the Tailwind safelist** for dynamic rarity classes.
4. **Extract shared helpers** to `frontend/src/lib/`:
   - `lib/professions.js` → `PROFESSION_COLORS`
   - `lib/format.js` → `formatGold(value)`
   - `lib/components/Spinner.svelte` → shared loading spinner
5. **Defer** the `selectedChar` model unification (Phase 4) and any larger
   items (wiki persistence, per-slot meta equipment) — out of scope here.

## Files to modify

| File | Action |
|---|---|
| `gw2-companion/.gitignore` | **New** — root level |
| `frontend/tailwind.config.js` | Add `safelist` for dynamic rarity classes |
| `frontend/src/lib/professions.js` | **New** — extract `PROFESSION_COLORS` |
| `frontend/src/lib/format.js` | **New** — extract `formatGold()` |
| `frontend/src/lib/components/Spinner.svelte` | **New** — uses `Loader2` from `@lucide/svelte` |
| `frontend/src/pages/Home.svelte` | Use shared `PROFESSION_COLORS` + `Spinner` |
| `frontend/src/pages/Inventory.svelte` | Use shared helpers; switch to `Spinner`; convert `loadStage` init to `$derived` |
| `frontend/src/pages/Materials.svelte` | Use shared `formatGold` + `Spinner` |
| `frontend/src/pages/Achievements.svelte` | Use shared `Spinner` |
| `frontend/src/pages/Story.svelte` | Use shared `PROFESSION_COLORS` + `Spinner` |
| `frontend/src/pages/Builds.svelte` | Use shared `Spinner` |
| `frontend/src/App.svelte.bak` | **Delete** |
| `frontend/src/pages/Inventory.svelte.bak2` | **Delete** |
| `frontend/src/lib/components/ui/Badge.svelte` | **Delete** |
| `frontend/src/lib/logo-shield.svg` | **Delete** |

## Reuse

- `frontend/src/lib/utils.js` already exports `cn()` for class merging — use
  identically in any new component.
- `frontend/src/lib/components/ui/` already has the 14 shadcn-svelte primitives.
  `Spinner.svelte` would follow the same pattern (`<script>let {class: c=''} = $props();`).
- `frontend/src/lib/stores.js` is the natural home for any cross-cutting state.
- The Tailwind config already has `border`, `input`, `card`, etc. tokens — no need
  to add new color tokens for the refactor.

## Steps

### Phase 1 — Hygiene (must do first, unblocks everything)

- [ ] **Check git history for the leaked key.** Run
      `git -C gw2-companion log --all -p -- backend/data/config.json` and
      look for the API key value `6F767E84-...-BD78CBEE`. If found, the
      key is already public — rotate it on ArenaNet **before** anything else
      and treat the old key as compromised.
- [ ] Create root `gw2-companion/.gitignore` covering:
      `node_modules/`, `frontend/node_modules/`, `backend/node_modules/`,
      `frontend/dist/`, `backend/data/config.json` (with `!backend/data/.gitkeep`
      so the dir is tracked), `*.bak`, `*.bak2`, `*.bak.*`,
      `.DS_Store`, `.env*`, `*.log`, `frontend/src/lib/logo-shield.svg`
- [ ] Verify `.gitignore` works: `git -C gw2-companion check-ignore -v backend/data/config.json`
      should report the file is ignored.
- [ ] Delete `frontend/src/App.svelte.bak`
- [ ] Delete `frontend/src/pages/Inventory.svelte.bak2`
- [ ] Delete `frontend/src/lib/components/ui/Badge.svelte`
- [ ] Delete `frontend/src/lib/logo-shield.svg`
- [ ] (Out-of-band) **rotate the GW2 API key** at
      https://account.arena.net/applications, then write the new value to
      `backend/data/config.json`. The new value will be ignored by git, so
      it can never be re-leaked.

### Phase 2 — Tailwind safelist fix
- [ ] Add `safelist` to `frontend/tailwind.config.js` covering the 8 rarities
      × 2 properties (bg/fg):
      ```js
      safelist: [
        { pattern: /^(bg|text)-rarity-(junk|basic|fine|masterwork|rare|exotic|ascended|legendary)-(bg|fg)$/ },
      ]
      ```
- [ ] Verify by running `npm run build` and grepping the output CSS for
      `bg-rarity-rare-bg` (or any one of the missing classes).
- [ ] Load Inventory page in browser, confirm a Rare item shows a yellow badge.

### Phase 3 — Extract shared helpers
- [ ] Create `frontend/src/lib/professions.js` with the `PROFESSION_COLORS`
      map and a `professionColor(name)` helper with `'#888'` fallback.
- [ ] Create `frontend/src/lib/format.js` with `formatGold(value)`.
- [ ] Create `frontend/src/lib/components/Spinner.svelte` accepting a `class`
      prop (so callers can size/color it). Implementation:
      ```svelte
      <script>
        import { cn } from '$lib/utils.js';
        import Loader2 from '@lucide/svelte/icons/loader-2';
        let { class: className = '' } = $props();
      </script>
      <Loader2 class={cn('h-5 w-5 animate-spin text-brand', className)} />
      ```
- [ ] Update Home, Inventory, Materials, Achievements, Story, Builds to
      import from the shared modules.
- [ ] Build and visually verify nothing changed (other than the rarity fix).

### Phase 4 — selectedChar model *(deferred — see Locked decisions)*
*(Out of scope for this plan. Tracked as a follow-up.)*

### Phase 5 — Polish (deferrable)
- [ ] Remove the 3 frontend `console.*` statements (`main.js:6`, `main.js:11`,
      `main.js:13`, `stores.js:29`).
- [ ] Convert `Inventory.svelte:43` `loadStage` init to `$derived`.
- [ ] Remove or gate `/api/debug` behind `NODE_ENV !== 'production'`.
- [ ] Add `PORT` env-var read in `server.js:14` (already done — confirm).

## Verification

1. **Repo hygiene**
   - `git -C gw2-companion status` shows the `.bak` files are gone,
     `.gitignore` is present, and `config.json` is untracked/ignored.
   - `node_modules/` and `dist/` are ignored.
   - `git -C gw2-companion check-ignore -v backend/data/config.json`
     confirms the file is ignored.

2. **Tailwind safelist**
   - `cd frontend && npm run build` succeeds.
   - `grep -r "bg-rarity-rare-bg" frontend/dist/assets/*.css` returns a match.
   - Open Inventory → confirm rarity badges (Fine=blue, Rare=yellow, Exotic=orange,
     Ascended=pink, Legendary=purple) actually have backgrounds.

3. **Shared helpers**
   - `grep -r "professionColors = {" frontend/src/` returns no matches.
   - `grep -r "function formatGold" frontend/src/pages/` returns no matches.
   - `grep -rn "animate-spin text-brand" frontend/src/pages/` returns no matches.
   - `grep -rn "h-5 w-5 animate-spin" frontend/src/pages/` returns no matches.
   - App still works identically in both light and dark mode.

4. **Build / lint**
   - `npm run dev` (or `npm run build`) succeeds with no Svelte 5 warnings.
   - All 7 pages render without console errors.

## Locked decisions

- **Spinner:** use `Loader2` from `@lucide/svelte/icons/loader-2` (already a
  dep of the project — see App.svelte's existing icon imports). Replace the
  6 inline SVG spinners with `<Spinner class="h-5 w-5 text-brand" />`.
- **`Badge.svelte`:** **delete.** If a future feature needs a Badge, we'll
  rewrite it (it's 23 lines — trivial to re-add).
- **API key rotation:** **out-of-band** (not part of this plan). The plan
  just adds the `.gitignore` so the *new* key won't be re-leaked.
- **`selectedChar` model (Phase 4):** deferred to a separate follow-up plan.
  Out of scope here.
