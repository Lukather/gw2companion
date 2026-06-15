# GW2 Companion — Session State (Jun 13–16, 2026)

> Pick up here tomorrow: see **"What to do next"** at the bottom.

---

## Day 9 — Jun 15, 2026: curate all 9 Power builds (issue #8, HITL)

### What changed

- **Shipped issue #8** — populated `slots` blocks for all 9 Power builds in `meta-builds.json`. 129 resolved item IDs total (6 builds × 15 + 3 builds × 13 for the 1-weapon-set ones). All 9 also have `sourceUrl` (auto-generated from profession + name) and `buildCode` (exceeds the ≥5/9 acceptance criterion). Two commits: `e89af55` (shorthand) and `b938201` (curation).
- **Auto-fill workflow** — wrote a one-off node script that generated `sourceUrl` for all 9 builds and `{ statPrefix, slot }` entries for all 14 slot keys, then ran `resolve-meta-items.js --all --write` to turn the shorthand into real item IDs. Manual step was just pasting the 9 `buildCode` chat links from the Snowcrows pages.
- **Smoke-tested** via `/api/builds` for the 3 characters on the dev's account (Warrior, Ranger, Necromancer) — all return 15 meta items with correct profession weight (Heavy/Medium/Light) and weapon-type matching.

### Implementation notes

- **1-weapon-set builds** (Elementalist `Sword/Dagger`, Engineer `Rifle`, Thief `Staff`) get `WeaponB1`/`WeaponB2` set to `null` — intentionally uncurated since they only carry one weapon set.
- **Source-URL pattern**: `https://snowcrows.com/builds/<profession-lowercase>/<name-kebab-case>`. The dev's draft had `/accessibuilds/` in the path for guardian — normalized to the standard pattern for consistency.
- **Build-code scraping failed** — Snowcrows is an Angular SPA, build code is rendered client-side. Not in static HTML. Would need a headless browser or their data API. Skipped; the dev pasted them manually.
- **All 9 builds written by the same `JSON.stringify` reformat** in the resolver's `applyMutations` — the diff is +892/-91 lines, mostly array-expansion noise. Data is correct but the visual diff is larger than the semantic change. Future: surgical text-replace in `applyMutations` to keep diffs clean.

### Files modified

- `backend/data/meta-builds.json` — 9 builds, slots + sourceUrl + buildCode (892/-91)

### Follow-up filed mentally (not in issues yet)

- **Cross-validator skill-palette bug** (issue #4 code) — 90 false-positive warns per `resolve-meta-items.js --all`. Two causes: (1) skill palette indices in build templates aren't skill IDs, so `/v2/skills/<palette>` returns 404 for every skill slot; (2) the spec check assumes the JSON's `specializations` order matches the build template's `specialization1/2/3` slots, but the template always puts the elite at slot 3 while the JSON orders specs by display preference. Fix is ~10 lines: either drop the skill check or use a profession-specific palette→skill map, and match specs by name. Worth filing as a new issue before the noise hides a real curation drift.

---

## Day 8 — Jun 16, 2026: stat-selectable shorthand (issue #6)

### What changed

- **Shipped issue #6** — `scripts/resolve-meta-items.js` now resolves `{ statPrefix, slot }` entries to a representative item ID. Curators can write `{ statPrefix: "Berserker's", slot: "Helm" }` instead of pasting a specific item name; the script picks a representative Ascended item of the right slot/weight and writes back `{ id: … }`. Works for all 6 armor slots, all 4 weapon slots (weapon type derived from `build.equipment.weapons`), and all 6 trinket slots.

### Implementation notes

- **Discovered the GW2 `/v2/items?type=…&rarity=…` filter is silently ignored** — every call returns all 73,923 IDs regardless of params. The issue's "or a more specific query that reliably returns stat-selectable items" hedge was the right move. Pivoted to client-side filtering against an extended local index.
- **Extended the local item-name index** with a per-item `items` map: `{ id: { name, type, slot, weight } }`. Populated for all equippable types (Armor, Weapon, Trinket, Back). Index now ~3-5 MB; auto-rebuilds the first time the new script version runs.
- **Two GW2 API gotchas** caught during testing:
  1. The armor weight field is `details.weight_class`, not `details.weight` — the name in the docs is misleading.
  2. `Back` (cosmetic back items) has top-level `type: "Back"` and **no `details` object** — so the filter logic has a special case to treat `item.type` as the slot when there's no `details.type`.
- **Naming convention differs for back items**: armor/weapons use `"Berserker's X"` (with apostrophe) but back items historically use `"Berserkers Spineguard"` (no apostrophe). The script does NOT auto-normalize — strict matching forces the curator to use the actual API name. The failure message is clear enough to discover this.
- **Weapons-array edge case** is handled: missing or empty `equipment.weapons` array → `WeaponA1`/`WeaponA2`/`WeaponB1`/`WeaponB2` slots fail with `'no `weapons` array in build'`. Other slot types still work.
- **No new API calls per lookup** — the items map is already populated during the one-time index build. Stat-prefix resolution is purely in-memory.

### Files modified

- `scripts/resolve-meta-items.js` — statPrefix shorthand, weapon parser, slot/weight mappings, extended index with `items` map (+204/-18)

### Live-tested

5/5 real slots resolve correctly. 1/1 intentional bogus prefix fails. Write mode writes resolved IDs back. Full --all run is clean (other 8 builds unaffected).

| Build          | Slot       | statPrefix      | Resolved ID | Picked name                                      |
|----------------|------------|-----------------|-------------|--------------------------------------------------|
| warrior-berserker-power | Shoulders | Berserker's     | 2124        | Berserker's Scallywag Pauldrons of the Afflicted |
| warrior-berserker-power | Backpack  | Berserkers      | 59          | Berserkers Spineguard of Ruby                    |
| warrior-berserker-power | Ring1     | Berserker's     | 23199       | Berserker's Ring                                 |
| warrior-berserker-power | WeaponA1  | Berserker's     | 13691       | Berserker's Destroyer Axe                        |
| warrior-berserker-power | WeaponB1  | Berserker's     | 13698       | Berserker's Destroyer Greatsword                 |

### Mini-quirk introduced

- **Index auto-rebuilds on first run with new script** — the old index lacks the `items` field, and `loadIndex` detects this and triggers a 3-5 min rebuild. Subsequent runs are instant. The detect-and-rebuild logic is in `loadIndex()` with a clear console message.

---

## Day 7 — Jun 16, 2026: three-state match indicator (issue #5)

### What changed

- **Shipped issue #5** — three-state match indicator per equipment slot. Backend computes `match: 'exact' | 'prefix' | 'off'` on each `metaSlots[slot]`. Frontend renders ✓ green (exact), ~ amber (prefix), ✗ red (off), — gray (unknown/fallback). Tooltips explain each state. Summary count at top of Equipment card adapted to count `exact + prefix` as "same prefix" hits. Build 160 KB, clean. Commit pending.
- **Bug fix: `$bindable` in Input component.** Input.svelte destructured `value` as a plain prop, so `bind:value` on `<Input>` only flowed parent→child. User typed, `apiKey` stayed `''`, Setup page button stayed disabled forever. Changed to `value = $bindable('')` + `bind:value={value}` on native `<input>`. One-line fix.

### Implementation notes

- **match computation** uses `extractPrefix(metaItemName) || metaBuild.equipment.prefix` for meta prefix — item name first, build prefix as fallback for HideSuffix items (same strategy as Day 4).
- **no character equipment in slot → `'off'`**, not `'unknown'`. `'unknown'` is only for uncurated slots (no metaSlot entry at all).
- **Summary count** filters `metaSlots[slot].match` for curated slots, falls back to legacy `eq.prefix === metaPrefix` for uncurated ones. Exact same number as before when no metaSlots data exists.

### Files modified

- `backend/routes/builds.js` — match computation in metaSlots loop (+20 lines)
- `frontend/src/pages/Builds.svelte` — three-state indicators with tooltips, updated summary count (+30 lines)
- `frontend/src/lib/components/ui/Input.svelte` — `$bindable` fix (2 lines)

### Mini-quirk introduced

- **Input component now explicitly handles `value` binding.** Previously relied on `{...rest}` spread to forward `bind:value` from parent, which worked for initial render but not for updates. The `$bindable` pattern is the idiomatic Svelte 5 fix (per docs: `let { value = $bindable(), ...props } = $props()` and `bind:value={value}` on native element).

---

## Day 6 — Jun 15, 2026: chat-code cross-validation (issue #4)

- Shipped `scripts/resolve-meta-items.js` chat-code cross-validation (commit `f3e636d`). Issue #4 closed.
- Added `@gw2/chatlink@^0.1.1` as devDependency. Decodes `buildCode` → validates spec/trait/skill names against JSON. Trait check is LOOSE (GW2 template encodes row indices, not trait IDs). All 8 unvalidated builds skip silently (no `buildCode` field).
- Live-tested: 8 no-buildCode builds (silent), warrior + matching code (clean), warrior + wrong names (3 WARNs), malformed code (decode error). Exit 0 always.

---

## Day 5 — Jun 15, 2026: resolve-meta-items helper script (issue #3)

- Shipped `scripts/resolve-meta-items.js` (commit `34c1eaf`). Issue #3 closed. 376 lines.
- Pivoted to local name index — GW2 `/v2/items` API silently ignores `?name=`. Index cached at `scripts/.item-name-index.json` (~1.9 MB, gitignored). First run ~3-5 min. Supports `--dry-run` (default), `--write`, `--refresh`, `--build=<id>`, `--all`.
- Live-tested all 6 slot shapes (resolved, case-insensitive, ambiguous, failed, statPrefix shorthand skip, null skip). Exit code 1 on failures.

---

## Day 4 — Jun 14, 2026: helm POC (issue #2)

- Shipped issue #2 (commit `0d9ee2d`). End-to-end pipeline for one slot: `meta-builds.json` slot ID → backend batch-fetch → `metaSlots` in API response → frontend renders icon+name+wiki link in right column.
- Pivoted Guardian→Warrior (dev has no Guardian). `Zojja's Visor` (id 48075) as `warrior-berserker-power` helm. `HideSuffix` prefix handled by falling back to build's `equipment.prefix`.
- 3 files changed, +37/−4. Live-tested on Lukather/Warrior.

---

## Day 3 — Jun 14, 2026: PRD + 8 GitHub issues

- Wrote `plans/per-slot-equipment-ids-prd.md` (~700 lines, 27 user stories, schema, work order).
- Spiked GW2 build template decoder — confirmed chat codes have NO equipment data. Use `@gw2/chatlink` for cross-validation only.
- Published 8 issues (#1–#8) to GitHub: 1 parent PRD + 7 vertical slices. Created `ready-for-agent` / `ready-for-human` labels.
- Design decisions locked (granularity, slot coverage, schema, match semantics, data source, rendering).

---

## Day 2 — Jun 14, 2026: repo linking, brand cleanup

- Linked to GitHub (`Lukather/gw2companion`). Added `CONTRIBUTING.md` (Conventional Commits). Rewrote README. Added SVG favicon + logo (1.6 KB each, byte-identical). Fixed sidebar logo (was 1.4 MB PNG).
- Commits: `678b5d1`, `8380d73`, `acd4e0e`, `a9d8afd`.

---

## Day 1 — Jun 13, 2026: Tailwind + shadcn-svelte redesign

- Replaced ~800 lines custom CSS with Tailwind. Integrated 14 shadcn-svelte components (Svelte 5, hand-built). Dark mode, Inter font, responsive sidebar, page transitions.
- Bug fixes: Story journal backend, `children` snippet destructuring, `class:` directive syntax.
- Post-redesign cleanup: shared helpers (`format.js`, `professions.js`, `Spinner.svelte`), Tailwind safelist, removed debug `console.*`, gated `/api/debug`. JS bundle 157.4→155.4 KB.

---

## Current features (all working)

| Feature | Status |
| --- | --- |
| API key setup & validation | ✅ |
| Home page + character grid | ✅ |
| Character selection → Inventory | ✅ |
| Item categorization (sell/salvage/keep/use) | ✅ |
| Trading Post prices | ✅ |
| Light/dark theme | ✅ |
| Material Storage analyzer | ✅ |
| Achievement Tracker | ✅ |
| Story Journal | ✅ |
| Build Viewer (specs/traits/skills vs meta) | ✅ |
| Per-slot meta items (1 of 15 slots curated) | ✅ Day 4 |
| resolve-meta-items helper script | ✅ Day 5 |
| Chat-code cross-validation | ✅ Day 6 |
| Three-state match indicator (✓/~ / ✗) | ✅ Day 7 |
| Stat-selectable shorthand `{ statPrefix, slot }` | ✅ Day 8 |
| Per-slot IDs curated for all 9 Power builds | ✅ Day 9 |

---

## How to start

```bash
cd gw2-companion
git pull && npm install && npm run dev   # backend :3000, frontend :5173
```

---

## Key files

```
gw2-companion/
├── plans/
│   └── per-slot-equipment-ids-prd.md
├── scripts/
│   ├── resolve-meta-items.js   # stat-selectable shorthand (Day 8)
│   └── spike-decode-build.mjs
├── backend/
│   ├── server.js
│   ├── routes/
│   │   └── builds.js          # three-state match (Day 7)
│   └── data/
│       └── meta-builds.json   # warrior-bererker-power has slots.Helm
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Builds.svelte   # three-state indicator (Day 7)
│       │   └── Setup.svelte
│       └── lib/
│           └── components/ui/
│               └── Input.svelte  # $bindable fix (Day 7)
```

---

## Known quirks

- API key in `backend/data/config.json` is gitignored — must be entered manually.
- `?name=` on `/v2/items` is silently ignored. The helper script uses a local index instead.
- `?type=` and `?rarity=` on `/v2/items` are **also** silently ignored. Index now carries per-item slot/weight for client-side filtering (Day 8).
- `wikiFetch` returns 403 on some MediaWiki endpoints (missing User-Agent header).
- Snowcrows is an Angular SPA — build codes aren't in static HTML. Can't scrape without a headless browser.
- Live-test orphans on :3000 — MSYS `pkill` unreliable on Windows. Kill by PID.
- `HideSuffix` items: prefix derived from build's `equipment.prefix`, not item def.
- Trait cross-validation is LOOSE (GW2 template uses row indices, not trait IDs).
- GW2 armor weight field is `details.weight_class`, not `details.weight` (Day 8 discovery).
- GW2 `Back` items have `type: "Back"` but **no `details` object** — special case in index builder (Day 8).
- Back-item stat-selectable names use `"Berserkers X"` (no apostrophe), not `"Berserker's X"`. Curator must use the API's actual name (Day 8).
- `favicon.svg` and `logo.svg` are intentionally duplicate — keep in sync.

---

## What to do next

**All 7 vertical slices from the per-slot equipment IDs PRD are done.** Remaining work is polish and v2 follow-ups, none blocking.

Open issues:
| # | Title | Why it's still open |
| --- | --- | --- |
| [#1](https://github.com/Lukather/gw2companion/issues/1) | Parent PRD | Kept open by design — tracks the overall feature |

Follow-ups to consider filing (no issue yet):
- **Cross-validator skill-palette bug** (Day 9) — 90 false-positive warns from #4's code. Fix: drop skill check or use profession-specific palette→skill map; match specs by name not position.
- **Surgical `applyMutations`** (Day 9) — resolver's `JSON.stringify` reformat inflates diffs (+892/-91 for 129 ID changes). Switch to text-replace to keep diffs ~+135/-9.
- **`/api/builds/refresh-meta` doesn't persist wiki search results** (known quirk) — updates timestamp but not the actual build data.
- **`/api/story?all=true` is implemented but never called** from the frontend.
- **Inconsistent character-selection model** (Builds.svelte has its own page-local `selectedChar`; doesn't share with Home/Inventory).
- v2 PRD follow-ups: condi/heal/open-world variants per build. Schema/pipeline already support adding them.

### What NOT to do (cumulative)

- Don't commit `backend/data/config.json` or `scripts/.item-name-index.json` (gitignored).
- Don't close/modify issue #1 (parent PRD).
- Don't refactor `extractPrefix()` without revisiting `metaSlot.prefix` in `builds.js` (Day 4).
- Don't "fix" the `?name=` API assumption or the loose trait check — both are by design.
- Don't `git push` without `git pull` first.
