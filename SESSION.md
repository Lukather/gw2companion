# GW2 Companion — Session State (Jun 13–16, 2026)

> Pick up here tomorrow: see **"What to do next"** at the bottom.

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
│   ├── resolve-meta-items.js
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
- `wikiFetch` returns 403 on some MediaWiki endpoints (missing User-Agent header).
- Live-test orphans on :3000 — MSYS `pkill` unreliable on Windows. Kill by PID.
- `HideSuffix` items: prefix derived from build's `equipment.prefix`, not item def.
- Trait cross-validation is LOOSE (GW2 template uses row indices, not trait IDs).
- `favicon.svg` and `logo.svg` are intentionally duplicate — keep in sync.

---

## What to do next

**#5 is done.** Remaining slices:

| # | Title | Type | Blocked by |
| --- | --- | --- | --- |
| [#6](https://github.com/Lukather/gw2companion/issues/6) | Helper script: stat-selectable shorthand | AFK | #3 |
| [#7](https://github.com/Lukather/gw2companion/issues/7) | Summary count "X ✓ · Y ~ · Z ✗" | AFK | #5 ✅ |
| [#8](https://github.com/Lukather/gw2companion/issues/8) | Curate per-slot IDs for all 9 builds | **HITL** | #3, #6 |

#6 and #7 can run in parallel (both AFK, unblocked). Then #8 (HITL, the data work).

### What NOT to do (cumulative)

- Don't commit `backend/data/config.json` or `scripts/.item-name-index.json` (gitignored).
- Don't close/modify issue #1 (parent PRD).
- Don't refactor `extractPrefix()` without revisiting `metaSlot.prefix` in `builds.js` (Day 4).
- Don't "fix" the `?name=` API assumption or the loose trait check — both are by design.
- Don't `git push` without `git pull` first.
