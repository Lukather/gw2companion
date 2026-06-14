# PRD — Per-slot equipment item IDs in meta-builds.json

> Published to GitHub Issue with the `ready-for-agent` label. The conversation context for this PRD is summarized in `SESSION.md` under "Day 2" → deferred items, and the work breakdown is reflected in the four follow-up commits proposed in the discussion.

---

## Problem Statement

The Build Viewer page shows the player's equipment next to a *synthetic* meta recommendation built from a stat prefix and a slot name — for example, `"Berserker's Heavy Helm"` rather than the actual meta item. This means:

- The right column has no icon, no wiki link, and no specific item identity.
- The match indicator is a single ✓/✗ based on whether the player's prefix matches the meta prefix. There's no way to tell whether the player is wearing the *exact* meta item (e.g. `Berserker's Draconic Helm`) vs. a different Berserker-statted helm.
- A user who *has* the meta item in their bank but equipped an exotic variant sees "different prefix" feedback, which is confusing.
- The Builds page becomes a stat-aggregator rather than a meta-comparison tool.

A spike to test whether GW2 build template chat codes (the `[&...=]` strings ARENANet uses to share builds) contain equipment data confirmed they do **not** — chat codes encode skills, traits, specializations, and weapon *types*, but no armor, trinkets, runes, or sigils. So we cannot use them as a per-slot ID source.

## Solution

Extend the `meta-builds.json` schema with an optional `slots` map under `equipment`, holding item IDs per slot. Source the IDs by curating them from Snowcrows chat-code-bearing build pages (or directly from the in-game build template if a chat code is pasted into the JSON). Add a helper script that resolves item names to IDs and decodes any pasted chat code for cross-validation.

At request time, the backend resolves the meta item IDs to item defs (name, icon, wiki URL, prefix) using the same `/v2/items` batch fetch that already loads the player's equipment, then computes a three-state match per slot. The frontend renders the resolved meta item (name + icon + wiki link) in the right column when data is present, and falls back to today's synthetic string when a slot has no curated data.

---

## User Stories

### Player (end-user of the GW2 Companion app)

1. As a player, I want the right column of the Equipment card to show the actual meta item name (e.g. `"Berserker's Draconic Helm"`) for each slot, so that I know exactly what to farm or buy.
2. As a player, I want each meta item in the right column to have an icon, so that I can visually identify it in my inventory or on the wiki.
3. As a player, I want each meta item name to be a clickable link to its GW2 Wiki page, so that I can read its stats, acquisition method, and how it compares to alternatives.
4. As a player, I want a per-slot indicator that tells me whether I have the *exact* meta item equipped (✓), so that I can see at a glance which slots are spot-on.
5. As a player, I want a per-slot indicator that tells me whether my equipped item has the *same stat prefix* as the meta item but is a different specific item (~), so that I know I'm "stat-correct" even if my item has a different skin.
6. As a player, I want a per-slot indicator that warns me when my item has a *different prefix* than the meta item (✗), so that I know I need to re-stat that slot.
7. As a player, I want the summary count at the top of the Equipment card to show me `"5 ✓ exact · 7 ~ aligned · 3 ✗ off"`, so that I have a one-glance health check of my gear vs. meta.
8. As a player, I want the per-slot meta items to work for all weapon slots (WeaponA1, WeaponA2, WeaponB1, WeaponB2), so that I can verify I have the right mainhand + offhand combinations for both weapon sets.
9. As a player, I want the per-slot meta items to work for all trinket slots (Backpack, 2× Accessory, Amulet, 2× Ring), so that I can verify my stat sticks are aligned with the meta.
10. As a player, I want the per-slot meta items to work for all armor slots (Helm, Shoulders, Coat, Gloves, Leggings, Boots), so that I can verify my stat combination is correct.
11. As a player, I want the right column to fall back to today's synthetic suggestion (e.g. `"Berserker's Heavy Helm"`) when no per-slot data is curated for a build, so that the page still works for uncurated or partially-curated builds.
12. As a player, I want the existing per-prefix match count to keep working as a secondary metric, so that my old mental model ("how many of my items are Berserker's?") still gives a sensible number.
13. As a player, I want a clear "no meta data" state for builds that haven't been curated at all, so that I know the absence is intentional and not a bug.

### Developer (curator and maintainer of `meta-builds.json`)

14. As a developer, I want the `meta-builds.json` data format to be human-editable, so that I can curate items by hand without needing a UI tool.
15. As a developer, I want a helper script that resolves item names to item IDs, so that I don't have to look up IDs by hand for every curated slot.
16. As a developer, I want the helper script to support a `{ statPrefix, slot }` shorthand for stat-selectable armor, so that I can write `"Berserker's helm"` and let the script pick a representative item ID.
17. As a developer, I want the helper script to default to `--dry-run`, so that I never accidentally mutate `meta-builds.json`.
18. As a developer, I want the helper script to print a per-build report (slots resolved, slots failed, warnings), so that I can quickly see what needs attention after a run.
19. As a developer, I want the helper script to also decode any `buildCode` field per build and cross-validate it against the existing `specializations` and `skills` blocks, so that I catch renames, copy-paste errors, or drift between the chat code and the human-maintained data.
20. As a developer, I want the chat-code cross-validation to be opt-in by presence (only run when a `buildCode` is in the JSON), so that older entries without a chat code still resolve cleanly.
21. As a developer, I want the schema to be backward-compatible — the existing `equipment` block (`prefix`, `weapons`, `runes`, `sigils`) stays alongside the new `slots` block, so that the existing analyzer code keeps working unchanged.
22. As a developer, I want the existing per-build `source` field (currently `"Snowcrows"`) to be augmented with an optional `sourceUrl` pointing to the exact build page, so that future re-verifications know where to look.
23. As a developer, I want the backend to resolve the new per-slot meta item IDs at request time (not bake them in at build time), so that item name/icon changes from ArenaNet are picked up automatically.
24. As a developer, I want the meta item ID resolution to use the same `/v2/items` batch fetch as the player's equipment, so that we don't add extra round-trips per request.
25. As a developer, I want the existing `/api/builds` endpoint to return both the old `equipmentSummary` (for backward compat with any other consumers) and the new per-slot `metaSlots` (for the new UI), so that nothing downstream breaks.
26. As a developer, I want the front-end right-column rendering to switch between "resolved item with icon+link" and "synthetic name string" based on whether `metaSlots[slot]` is present, so that the UI degrades gracefully on partially-curated builds.
27. As a developer, I want the implementation to follow the project's conventional-commits convention, so that the project history stays clean and easy to navigate.

---

## Implementation Decisions

### Data model (`meta-builds.json` schema additions)

The `equipment` block of each build grows a new optional `slots` map, keyed by equipment slot name. Each entry can take one of three curation shapes (decided at curation time, resolved to a single shape at helper-script run time):

- **Already-resolved:** `{ "id": 12345 }` — script leaves it alone.
- **Named:** `{ "name": "Berserker's Draconic Helm" }` — script resolves via the GW2 items API and writes back `{ "id": 12345 }`.
- **Stat-selectable shorthand:** `{ "statPrefix": "Berserker's", "slot": "Helm" }` — script resolves to a representative item with that prefix and slot, writes back `{ "id": 67890 }`.

The 15 slot names follow the GW2 equipment slot names already used in `Builds.svelte`: `Helm`, `Shoulders`, `Coat`, `Gloves`, `Leggings`, `Boots`, `Backpack`, `Accessory1`, `Accessory2`, `Amulet`, `Ring1`, `Ring2`, `WeaponA1`, `WeaponA2`, `WeaponB1`, `WeaponB2`. Backpack is *included* in the data model but is *not* part of the v1 curation (per Q2-A: skip backpack for the 9 Power builds because Snowcrows doesn't usually name a specific backpack).

The existing `prefix`, `weapons`, `runes`, `sigils` fields stay in the JSON. They continue to drive the legacy `equipmentSummary` code path and the synthetic-name fallback. The new `slots` block is purely additive.

Each build optionally grows two more fields:

- `sourceUrl` — a URL to the canonical build page, for traceability (Snowcrows, Hardstuck, etc.). Defaulted from the existing `source` field at script runtime.
- `buildCode` — the in-game GW2 build template chat code, *optional*. When present, the helper script decodes it to cross-validate skills/traits/specs. When absent, the script skips cross-validation silently.

### Curated data shape (from a prototype of the schema; the snippet captures the decision more precisely than prose)

```json
{
  "id": "guardian-dragonhunter-power",
  "profession": "Guardian",
  "name": "Power Dragonhunter",
  "source": "Snowcrows",
  "sourceUrl": "https://snowcrows.com/builds/guardian/power-dragonhunter",
  "specializations": [ /* existing, unchanged */ ],
  "skills":          [ /* existing, unchanged */ ],
  "buildCode": "[&...=]",
  "equipment": {
    "prefix": "Berserker's",
    "weapons": ["Greatsword", "Sword/Focus"],
    "runes": "Superior Rune of the Scholar",
    "sigils": ["Superior Sigil of Force", "Superior Sigil of Impact"],
    "slots": {
      "Helm":       { "id": 12345 },
      "Shoulders":  { "id": 12346 },
      "Coat":       { "id": 12347 },
      "Gloves":     { "id": 12348 },
      "Leggings":   { "id": 12349 },
      "Boots":      { "id": 12350 },
      "Backpack":   { "id": 12351 },
      "Accessory1": { "id": 12352 },
      "Accessory2": { "id": 12353 },
      "Amulet":     { "id": 12354 },
      "Ring1":      { "id": 12355 },
      "Ring2":      { "id": 12356 },
      "WeaponA1":   { "id": 12357 },
      "WeaponA2":   { "id": 12358 },
      "WeaponB1":   { "id": 12359 },
      "WeaponB2":   { "id": 12360 }
    }
  }
}
```

### Module changes

- **`backend/data/meta-builds.json`** — additive: new `slots` block per build, optional `sourceUrl` and `buildCode` per build. No existing fields removed.
- **New: `scripts/resolve-meta-items.js`** — a Node.js script (uses `@gw2/chatlink` for chat-code decoding; reuses the existing `/v2/items` resolution pattern from `backend/services/gw2-api.js`). CLI: `--all`, `--build=<id>`, `--dry-run` (default), `--write`, `--help`.
- **`backend/routes/builds.js`** — when loading a meta build, if `metaBuild.equipment.slots` exists, append those IDs to the existing `equipIds` batch (one extra round trip at most, since the batch is chunked). Build a `metaSlots` map for the response. Compute the three-state match per character equipment slot. Add `metaSlots` to the response alongside the existing `equipmentSummary`.
- **`frontend/src/pages/Builds.svelte`** — render the `metaSlots` data when present, fall back to the existing `getMetaSuggestion()` synthetic string when not. Update the summary count to show the three-state breakdown. Add tooltips to the match indicators explaining the state.

### Match semantics (server-side computation)

For each character equipment piece `eq` and its corresponding `metaSlot`:

- `'exact'` — `eq.id === metaSlot.id`.
- `'prefix'` — `extractPrefix(eq.name) === extractPrefix(metaSlot.name)` (stat-aligned, different item).
- `'off'` — different prefix (genuinely off-meta).
- `'unknown'` — no `metaSlot` data for this slot.

The existing `extractPrefix()` helper (already in `backend/routes/builds.js`) is reused for the prefix comparison. No new helper needed.

### API response shape (additive, backward-compatible)

`/api/builds` response gains one new key in `metaComparison`:

```
metaComparison: {
  ...existing fields,
  equipmentSummary: { prefix, weapons, runes, sigils },  // unchanged
  metaSlots: {
    "Helm":       { id, name, icon, wikiUrl, prefix, match: 'exact'|'prefix'|'off' },
    "Shoulders":  { ... } | null,    // null when no curated data
    ...
  }
}
```

The existing `equipmentSummary` is unchanged. The frontend picks `metaSlots[slot]` if present, otherwise the synthetic `getMetaSuggestion()` string. This is a clean fallback.

### Curation workflow

1. Developer opens the Snowcrows build page (or wherever the canonical meta lives).
2. Developer copies the build's chat code (if available) into the `buildCode` field.
3. Developer adds `slots` entries to the `equipment` block: either `{ "id": 12345 }` for items they know, `{ "name": "..." }` for items the script can look up, or `{ "statPrefix": "...", "slot": "..." }` for stat-selectable armor where any item with that prefix works.
4. Developer runs `node scripts/resolve-meta-items.js --build=<id>` (or `--all`) with the default `--dry-run` flag, reviews the report.
5. Developer runs again with `--write` to apply.
6. Developer commits the updated `meta-builds.json` with a `docs(builds):` commit.

### Work order (proposed four commits)

1. **`feat(builds): add slots schema + resolve-meta-items helper script`** — helper script exists and is invokable. One example build is fully populated to anchor the schema pattern.
2. **`feat(builds): resolve meta item IDs at request time + three-state match`** — backend changes: batch-fetch meta item IDs, build `metaSlots`, compute match state, add to response.
3. **`feat(builds): render per-slot meta items with icon, link, and three-state indicator`** — frontend changes: render `metaSlots` with icon+link when present, fall back to synthetic, update summary count.
4. **`docs(builds): curate per-slot IDs for all 9 Power builds`** — the data work: fill in names/statPrefixes for the remaining 8 builds, run the helper, commit the populated JSON.

---

## Testing Decisions

This project has no automated test framework or CI pipeline (`SESSION.md` "Known quirks" notes this explicitly, and `CONTRIBUTING.md` says so too). The testing strategy for this feature is **manual at three natural seams**, in increasing order of integration:

1. **Helper-script report** — `node scripts/resolve-meta-items.js --all --dry-run` prints a per-build report (slots resolved, slots failed, mismatches). Review the report by hand. A good test asserts that the report shows `15/15 resolved · 0 errors · 0 warnings` for a fully-curated build.

2. **`/api/builds` response shape** — load the app in dev mode, open browser dev tools, hit `/api/builds?character=<name>`, verify the response includes a `metaComparison.metaSlots` object with the right shape. A good test asserts that each curated slot has `{ id, name, icon, wikiUrl, prefix, match }` populated, each uncurated slot is `null`, and the `match` value matches the expected state for the test character's known equipment.

3. **Builds page render** — load the Builds page in a browser with a real character equipped, verify the right column shows resolved items (name, icon, wiki link) for curated slots, synthetic names for uncurated slots, the three-state match indicator per row, and the new "X ✓ · Y ~ · Z ✗" summary count. A good test asserts visual correctness on a real or fixture character.

Each commit is small enough that the seams can be tested independently as it's landed. The four-commit structure is itself a testability boundary — each commit produces a working state on its own.

**What makes a good test for this project, in general:** a test should validate *external behavior* (the JSON looks right, the API returns the right shape, the page renders the right thing) rather than internal implementation (which functions call which, what intermediate state is held). For a no-framework project, manual external checks are the natural fit.

**Prior art:** there is no prior art for automated tests in this repo. The pattern of "manual seam checks" matches the project's current state. Adding a real test framework (Vitest, Playwright, etc.) is a separate piece of work, out of scope for this PRD.

---

## Out of Scope

- **Multiple variants per build** (Power, Condi, Heal, Open World) — v1 covers one build per profession (the 9 Power builds). Adding condi/heal/booster variants would pull from Hardstuck and is a v2 follow-up.
- **Aquatic helm, aquatic weapons, gathering tools** — per Q2-A, not curated. If the player has these equipped, they get the synthetic fallback.
- **Backpack curation** — the model supports it, but Snowcrows doesn't usually specify a particular backpack (stat-aligned back items are interchangeable for most purposes), so v1 leaves the backpack slot uncurated.
- **Resolving *all* stat-selectable slots to a "default" item at runtime** — option b from the Q6 discussion. This is a separate curation problem (which skin of "Berserker's helm" is the canonical default). Deferred to v2 or later.
- **Pre-resolved names/icons in `meta-builds.json`** — option B from the Q3 discussion. We resolve at request time instead, so item name/icon changes from ArenaNet are picked up automatically.
- **Auto-scraping Snowcrows** — the existing `POST /api/builds/refresh-meta` is unchanged. Curation is manual from Snowcrows pages (or whatever the developer has open in front of them).
- **Automated test framework / CI pipeline** — out of scope; the project's "no tests (yet)" state continues.
- **Multiple favicon formats, PWA manifest, manifest icons** — not part of this PRD.
- **Rune/sigil item IDs in the JSON** — runes and sigils remain strings in the schema. The chat code does not encode them, and the existing `getMetaSuggestion()` synthetic-fallback path handles them as `extra` text. Promoting them to IDs is a v2 follow-up.

---

## Further Notes

- **The spike script** that proved GW2 build template chat codes do not contain equipment data is at `scripts/spike-decode-build.mjs`. The working chat-code decoder is folded into the helper script. The `@gw2/chatlink` library (12 KB, MIT) is the chosen decoder — small, well-maintained, supports the BuildTemplate type out of the box.
- **Why `@gw2/chatlink` and not a hand-rolled decoder:** the bit layout is documented in the GW2 wiki and would be ~150 lines of careful bit-manipulation to implement correctly. A working, well-tested library saves that effort and lets us focus on the curation problem.
- **Why chat codes are still useful** (even though they don't have equipment): the helper script decodes any `buildCode` field and cross-validates the skill IDs and trait IDs against the existing `specializations` and `skills` blocks. This catches a real failure mode: Snowcrows renaming a trait in a patch and the human-curated name going stale. ~30 lines in the helper script, real value.
- **The 9 Power builds are the v1 scope.** The schema and pipeline are designed so that adding variants is purely additive (e.g. `guardian-dragonhunter-condi` as a new entry in the `builds` array, with a chat code from the Snowcrows condi page). The current code's `metaBuilds.builds.find(b => b.profession === char.profession)` lookup may need a small upgrade in v2 to support variant selection (e.g. matching by active elite spec, or by game mode), but that's deliberately deferred.
- **The "13 → 14" comment in `SESSION.md`'s Known quirks ("favicon.svg and logo.svg are intentionally duplicate") does not apply to this PRD.** This is a different feature; favicons and logos are unaffected.
- **Conventional commits.** Each of the four commits in the work order follows the project's conventional-commits convention (see `CONTRIBUTING.md`). The third one (`feat(builds): render per-slot meta items...`) is the visible-to-user change; the others are infrastructure.

---

## Sources

- **Conversation context:** the design session between Lorenzo and the assistant on Jun 14, 2026, covering Q1 (granularity), Q2 (coverage), Q3 (schema), Q4 (match semantics), Q5 (data source), Q6 (right-column rendering), the chat-code spike, and the proposed work order.
- **Prior session state:** `SESSION.md` — Day 1 (Tailwind redesign) provides the current behavior baseline; Day 2 lists this feature as "pick #2" under "What to do next."
- **Existing schemas and code:** `backend/data/meta-builds.json`, `backend/routes/builds.js`, `frontend/src/pages/Builds.svelte`, `backend/services/gw2-api.js`, `backend/services/utils.js`.
- **External library evaluated:** `@gw2/chatlink` v0.1.1 by GW2Treasures (MIT, 12 KB minified).
- **External data sources:** Snowcrows, Hardstuck.gg, GW2 Wiki.
