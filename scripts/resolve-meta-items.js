#!/usr/bin/env node
/**
 * resolve-meta-items.js
 *
 * Curator's tool for meta-builds.json. Reads each build's `equipment.slots`
 * map, resolves any `{ name: "..." }` entries to `{ id: <number> }` via the
 * GW2 items API, and (with --write) mutates the JSON file.
 *
 * USAGE
 *   node scripts/resolve-meta-items.js --all                 # all builds, dry-run
 *   node scripts/resolve-meta-items.js --build=<id>          # one build, dry-run
 *   node scripts/resolve-meta-items.js --build=<id> --write  # one build, mutate
 *   node scripts/resolve-meta-items.js --refresh             # force-rebuild the name index
 *   node scripts/resolve-meta-items.js --help
 *
 * Default mode is --dry-run: prints the report and the would-be mutations
 * without touching meta-builds.json. Pass --write to apply.
 *
 * ID RESOLUTION
 *   The official GW2 v2 API has no name-search endpoint (the `?name=` query
 *   parameter is silently ignored). So this script maintains a local name
 *   index, built once and cached at `scripts/.item-name-index.json`:
 *
 *     1. GET /v2/items         → list of all ~74k item IDs
 *     2. GET /v2/items?ids=... → item objects, chunked at 200/call
 *     3. index by name: { "Zojja's Visor": [48075], ... }
 *     4. (issue #6) also index equippable items by slot/weight:
 *        { "48075": { name, type, slot: "Helm", weight: "Heavy" }, ... }
 *      used by the { statPrefix, slot } shorthand.
 *
 *   If the cache file is missing, it is built on first run (~3-5 min, ~370
 *   chunked API calls at the ArenaNet rate limit). Subsequent runs are
 *   instant. Use --refresh to force a rebuild when you know item names have
 *   changed (rare — only on game patches that rename items).
 *
 *   Note: the official /v2/items endpoint silently ignores `?type=` and
 *   `?rarity=` query params (returns all 74k IDs no matter what), so the
 *   shorthand resolver filters client-side against the index, not server-side.
 *
 *   Multiple items can share a name (e.g. ascended vs. legendary skins).
 *   In that case the first ID wins and the report shows a warning. The
 *   curator can resolve manually if the wrong skin is picked.
 *
 * SLOT SHAPES HANDLED (per meta-builds.json schema in plans/per-slot-equipment-ids-prd.md)
 *   { id: 12345 }                                   → skipped (already resolved)
 *   { name: "Foo" }                                 → resolved via the local name index
 *   { statPrefix: "Berserker's", slot: "Helm" }     → resolved via the local items map (issue #6)
 *   null / missing                                  → skipped
 *
 * STAT-SELECTABLE SHORTHAND (issue #6)
 *   For a `{ statPrefix, slot }` entry, the script scans the local items map
 *   for equippable items matching the slot (e.g. `Helm`, `Ring`, `Greatsword`)
 *   whose name starts with the prefix (case-insensitive) and, for armor, whose
 *   weight matches the build's profession. The first result by ID wins, and
 *   the resolved ID is written back as `{ id: … }`. Weapon slots derive their
 *   GW2 type from the build's `equipment.weapons` array (e.g. "Axe/Axe" →
 *   WeaponA1=Axe, WeaponA2=Axe). No API call is made for each lookup — the
 *   items map is populated once when the index is built.
 *
 * CHAT-CODE CROSS-VALIDATION (issue #4)
 *   If a build has a `buildCode` field (an in-game GW2 build template chat
 *   link, e.g. `[&DQIkLTM+...=]`), the script decodes it with @gw2/chatlink
 *   and cross-validates against the human-maintained `specializations` and
 *   `skills` blocks. Mismatches are logged as advisory warnings, never as
 *   errors. No-op when no buildCode is present.
 *
 *   - Spec names: tight check (decoded spec name vs JSON spec name, warn on mismatch).
 *   - Trait names: LOOSE check (decoded spec exposes 3 minor + 9 major trait names;
 *     each JSON trait is verified to exist somewhere in that set). The GW2 build
 *     template encodes trait choices as row indices (Top/Middle/Bottom), not as
 *     specific trait indices, so a tight per-choice check would need the actual
 *     trait-ID mapping. The loose check catches the real failure mode — a trait
 *     rename in a patch — without needing that mapping. See the "Why a loose
 *     check?" note in the implementation.
 *   - Skill names: tight check (decoded skill name vs JSON skill name, warn on
 *     mismatch). Skill IDs can become stale between game patches; the script
 *     fetches the current name and reports any drift.
 *
 * REUSE OF EXISTING INFRA
 *   - API client: backend/services/gw2-api.js (gw2Fetch — in-memory cache
 *     + rate-limit handling).
 *   - ID chunking: backend/services/utils.js (chunkIds — 200/call, max
 *     accepted by the GW2 API).
 *   - Build template decoder: @gw2/chatlink (MIT, 25.5 KB unpacked).
 */

const fs = require('fs');
const path = require('path');

// Reuse backend modules — paths resolved relative to this script's location
// so it works regardless of CWD.
const SCRIPT_DIR = __dirname;
const BACKEND_DIR = path.join(SCRIPT_DIR, '..', 'backend');
const META_BUILDS_PATH = path.join(BACKEND_DIR, 'data', 'meta-builds.json');
const INDEX_PATH = path.join(SCRIPT_DIR, '.item-name-index.json');

const { gw2Fetch } = require(path.join(BACKEND_DIR, 'services', 'gw2-api.js'));
const { chunkIds } = require(path.join(BACKEND_DIR, 'services', 'utils.js'));
const { decodeChatlink, ChatlinkType } = require('@gw2/chatlink');

// --- arg parsing --------------------------------------------------------

function parseArgs(argv) {
  const args = { dryRun: true, all: false, build: null, refresh: false, help: false };
  for (const arg of argv.slice(2)) {
    if (arg === '--all') args.all = true;
    else if (arg === '--write') args.dryRun = false;
    else if (arg === '--refresh') args.refresh = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg.startsWith('--build=')) args.build = arg.slice('--build='.length);
    else { console.error(`Unknown argument: ${arg}\nUse --help for usage.`); process.exit(2); }
  }
  if (!args.all && !args.build) args.all = true;
  if (args.all && args.build) {
    console.error('Cannot use --all and --build=<id> together.');
    process.exit(2);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/resolve-meta-items.js [options]

Options:
  --all               Process every build in meta-builds.json (default)
  --build=<id>        Process a single build by its id
  --write             Mutate meta-builds.json (default: --dry-run)
  --refresh           Force-rebuild the local item-name index
  --help, -h          Show this help

Report per build: "<resolved> resolved · <skipped> skipped · <failed> failed"
Plus details for each failure (slot, input name, reason) and (in --dry-run)
the would-be mutations.

Item-name index lives at scripts/.item-name-index.json (gitignored).
It is built on first run (~3-5 min, ~370 chunked API calls) and reused
afterwards. Use --refresh to force a rebuild.

Stat-selectable shorthand:
  For slots defined as { statPrefix: "Berserker's", slot: "Helm" }, the
  script scans the local items map for equippable items matching the slot
  (Helm, Ring, Greatsword, …) whose name starts with the prefix
  (case-insensitive) and, for armor, whose weight matches the build's
  profession. Resolves to { id: … }. Works for armor (6 slots), weapons
  (4 slots, type derived from build's weapons array), and trinkets
  (6 slots). The items map is rebuilt automatically the first time you
  run with the new script version (or with --refresh).

Chat-code cross-validation:
  Builds with a 'buildCode' field are decoded with @gw2/chatlink and
  cross-validated against the human-maintained 'specializations' and
  'skills' blocks. Mismatches are reported as advisory WARN lines.
  No-op when no buildCode is present. Warnings never fail the run.`);
}

// --- slot classification ------------------------------------------------

function classifySlot(slotDef) {
  if (slotDef == null) return { kind: 'missing' };
  if (typeof slotDef === 'object' && typeof slotDef.id === 'number') return { kind: 'resolved' };
  if (typeof slotDef === 'object' && typeof slotDef.name === 'string' && slotDef.name.trim()) {
    return { kind: 'name', name: slotDef.name.trim() };
  }
  if (typeof slotDef === 'object' && slotDef.statPrefix && slotDef.slot) {
    return { kind: 'statPrefix', statPrefix: slotDef.statPrefix, slotName: slotDef.slot };
  }
  return { kind: 'unknown' }; // malformed; treat as skipped with a note
}

// --- stat-selectable shorthand (issue #6) ------------------------------
//
// Map slot name → GW2 item type. Used for { statPrefix, slot } entries
// where the slot is fixed (armor, trinket).
const ARMOR_SLOT_TO_TYPE = {
  Helm: 'Helm', Shoulders: 'Shoulders', Coat: 'Coat',
  Gloves: 'Gloves', Leggings: 'Leggings', Boots: 'Boots',
};
const TRINKET_SLOT_TO_TYPE = {
  Backpack: 'Back', Accessory1: 'Accessory', Accessory2: 'Accessory',
  Amulet: 'Amulet', Ring1: 'Ring', Ring2: 'Ring',
};
const PROFESSION_ARMOR_WEIGHT = {
  Guardian: 'Heavy', Warrior: 'Heavy', Revenant: 'Heavy',
  Engineer: 'Medium', Ranger: 'Medium', Thief: 'Medium',
  Elementalist: 'Light', Mesmer: 'Light', Necromancer: 'Light',
};

// Parse a weapon set spec like "Greatsword" or "Sword/Focus" into
// { main, off }. A single spec is treated as two-handed (main=off=spec).
// Returns null if the spec is empty/malformed.
function parseWeaponSpec(spec) {
  if (typeof spec !== 'string' || !spec.trim()) return null;
  const s = spec.trim();
  if (s.includes('/')) {
    const [main, off] = s.split('/').map(x => x.trim());
    if (!main || !off) return null;
    return { main, off };
  }
  return { main: s, off: s }; // two-handed occupies both slots
}

// Resolve the GW2 weapon type for a slot like WeaponA1/WeaponA2/WeaponB1/WeaponB2.
// Derives from the build's `equipment.weapons` array. Returns { type, reason }
// where reason is non-null on failure (no weapons array, missing set, etc).
function getWeaponTypeForSlot(build, slotName) {
  const weapons = build.equipment && build.equipment.weapons;
  if (!Array.isArray(weapons) || weapons.length === 0) {
    return { type: null, reason: 'no `weapons` array in build' };
  }
  const m = /^Weapon([AB])([12])$/.exec(slotName);
  if (!m) return { type: null, reason: `unrecognized weapon slot "${slotName}"` };
  const setIdx = m[1] === 'A' ? 0 : 1;
  const hand = m[2] === '1' ? 'main' : 'off';
  const setSpec = weapons[setIdx];
  if (!setSpec) return { type: null, reason: `no weapon set ${setIdx + 1} (build has ${weapons.length} set(s))` };
  const parsed = parseWeaponSpec(setSpec);
  if (!parsed) return { type: null, reason: `malformed weapon spec "${setSpec}"` };
  return { type: parsed[hand], reason: null };
}

// Resolve a { statPrefix, slot } entry to a representative Ascended item.
// Returns { id, name, ambiguous, candidates } on success, or { failure: '…' }
// on failure (caller treats both shapes uniformly and counts failures).
//
// Implementation note: the GW2 /v2/items endpoint silently ignores
// `?type=` and `?rarity=` query parameters, so we cannot filter
// server-side. Instead, the local item-name index (built in
// buildNameIndex) carries a per-item `items` map with slot + weight,
// and we filter client-side. The index is gitignored and ~3-5 min to
// build on first run; subsequent runs are instant.
async function resolveStatPrefix({ statPrefix, slotName, build, index }) {
  const prefix = (statPrefix || '').trim();
  if (!prefix) return { failure: 'empty statPrefix' };

  const isArmor = Object.prototype.hasOwnProperty.call(ARMOR_SLOT_TO_TYPE, slotName);
  const isTrinket = Object.prototype.hasOwnProperty.call(TRINKET_SLOT_TO_TYPE, slotName);
  const isWeapon = /^Weapon[AB][12]$/.test(slotName);

  let itemType;
  if (isWeapon) {
    const w = getWeaponTypeForSlot(build, slotName);
    if (!w.type) return { failure: w.reason };
    itemType = w.type;
  } else if (isArmor || isTrinket) {
    itemType = getItemTypeForSlot(slotName);
  } else {
    return { failure: `unrecognized slot "${slotName}"` };
  }
  if (!itemType) return { failure: `no GW2 item type for slot "${slotName}"` };

  const itemsMap = (index && index.items) || {};
  const wantWeight = isArmor ? PROFESSION_ARMOR_WEIGHT[build.profession] : null;
  const prefixLower = prefix.toLowerCase();
  const matches = [];
  for (const [idStr, item] of Object.entries(itemsMap)) {
    if (!item || !item.name) continue;
    if (item.slot !== itemType) continue; // filter by slot type
    const n = item.name.toLowerCase();
    if (!(n.startsWith(prefixLower + ' ') || n === prefixLower)) continue;
    if (wantWeight && item.weight !== wantWeight) continue;
    matches.push({ id: Number(idStr), name: item.name });
  }
  if (matches.length === 0) {
    const wDesc = wantWeight ? ` ${wantWeight}` : '';
    return { failure: `no${wDesc} Ascended items named like "${prefix} …" of type "${itemType}"` };
  }

  // Deterministic pick: lowest ID first (ArenaNet assigns IDs in chronological
  // order, so the lowest is the "original" skin of that stat+slot combo).
  matches.sort((a, b) => a.id - b.id);
  const pick = matches[0];
  return {
    id: pick.id, name: pick.name,
    ambiguous: matches.length > 1, candidates: matches.length,
  };
}

function getItemTypeForSlot(slotName) {
  return ARMOR_SLOT_TO_TYPE[slotName] || TRINKET_SLOT_TO_TYPE[slotName] || null;
}

// --- item-name index ----------------------------------------------------

const INDEX_TTL_DAYS = 7;
const INDEX_STALE_MS = INDEX_TTL_DAYS * 24 * 60 * 60 * 1000;

function isIndexFresh(index) {
  if (!index || !index.builtAt) return false;
  const builtAt = new Date(index.builtAt).getTime();
  if (Number.isNaN(builtAt)) return false;
  return (Date.now() - builtAt) < INDEX_STALE_MS;
}

function indexIsStale(index) {
  return index && index.builtAt && !isIndexFresh(index);
}

async function buildNameIndex() {
  console.log('Building local item-name index (one-time, ~3-5 min)...');
  console.log('  GET /v2/items ...');
  const allIds = await gw2Fetch('/v2/items');
  if (!Array.isArray(allIds)) {
    throw new Error(`/v2/items did not return an array (got ${typeof allIds})`);
  }
  const totalIds = allIds.length;
  console.log(`  Found ${totalIds} item IDs. Fetching objects in chunks of 200...`);

  const names = {};
  // Per-item metadata for { statPrefix, slot } shorthand lookups. Only
  // populated for equippable items (armor/weapons/trinkets) since other
  // types have no slot to match against. Kept small (~5k entries, <1 MB).
  const items = {};
  let fetched = 0;
  const chunks = chunkIds(allIds);
  for (let i = 0; i < chunks.length; i++) {
    try {
      const arr = await gw2Fetch(`/v2/items?ids=${chunks[i].join(',')}`);
      if (Array.isArray(arr)) {
        for (const item of arr) {
          if (item && typeof item.id === 'number') {
            if (typeof item.name === 'string' && item.name) {
              const n = item.name;
              if (!names[n]) names[n] = [];
              names[n].push(item.id);
            }
            // Only equippable types are interesting for statPrefix lookups.
            // Each must have details.type (the specific slot — "Helm",
            // "Axe", "Ring", "Back", etc.) for the lookup to work.
            // Back items are an exception: their top-level type is "Back" and
            // they have no details.type field, so we treat item.type as the slot.
            const isEquippable = item.type === 'Armor' || item.type === 'Weapon' ||
                                 item.type === 'Back' || item.type === 'Trinket';
            let slot = null;
            if (item.details && typeof item.details.type === 'string') {
              slot = item.details.type;
            } else if (item.type === 'Back') {
              slot = 'Back';
            }
            if (isEquippable && slot) {
              items[item.id] = {
                name: item.name || '',
                type: item.type,
                slot,
                // GW2 uses `weight_class` (not `weight`) for armor weight.
                weight: item.details && item.details.weight_class ? item.details.weight_class : null,
              };
            }
          }
        }
      }
    } catch (e) {
      console.warn(`  chunk ${i + 1}/${chunks.length} failed: ${e.message.slice(0, 100)}`);
    }
    fetched += chunks[i].length;
    if ((i + 1) % 50 === 0 || i === chunks.length - 1) {
      process.stdout.write(`  ${fetched}/${totalIds} IDs fetched (${i + 1}/${chunks.length} chunks)\n`);
    }
  }

  const index = {
    builtAt: new Date().toISOString(),
    totalIds,
    uniqueNames: Object.keys(names).length,
    equippableItems: Object.keys(items).length,
    names,
    items,
  };
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index));
  return index;
}

function loadIndex(forceRefresh) {
  if (forceRefresh) {
    if (fs.existsSync(INDEX_PATH)) console.log('  (--refresh: rebuilding existing index)');
    return buildNameIndex();
  }
  if (!fs.existsSync(INDEX_PATH)) return buildNameIndex();
  try {
    const idx = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
    if (!idx.names) throw new Error('index file has no `names` field');
    if (!idx.items) {
      // Index was built before the statPrefix shorthand (issue #6) was added.
      // Rebuild so we have the `items` map (slot+weight per item).
      console.log('  (index lacks the `items` map needed for { statPrefix, slot } shorthand — rebuilding)');
      return buildNameIndex();
    }
    if (indexIsStale(idx)) {
      console.log(`  (index is older than ${INDEX_TTL_DAYS} days, built ${idx.builtAt} — pass --refresh to rebuild)`);
    }
    return idx;
  } catch (e) {
    console.warn(`  Failed to load index (${e.message}), rebuilding...`);
    return buildNameIndex();
  }
}

function resolveName(index, name) {
  // Try exact match first.
  const exact = index.names[name];
  if (Array.isArray(exact) && exact.length > 0) {
    return { id: exact[0], ambiguous: exact.length > 1, candidates: exact };
  }
  // Fall back to case-insensitive match.
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(index.names)) {
    if (k.toLowerCase() === lower && Array.isArray(v) && v.length > 0) {
      return { id: v[0], ambiguous: v.length > 1, candidates: v, caseInsensitive: true };
    }
  }
  return null;
}

// --- main flow ----------------------------------------------------------

function loadMetaBuilds() {
  return JSON.parse(fs.readFileSync(META_BUILDS_PATH, 'utf-8'));
}

function saveMetaBuilds(data) {
  fs.writeFileSync(META_BUILDS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function selectBuilds(data, args) {
  if (args.build) {
    const found = data.builds.find(b => b.id === args.build);
    if (!found) {
      console.error(`No build with id "${args.build}". Known ids:`);
      for (const b of data.builds) console.error(`  ${b.id}`);
      process.exit(1);
    }
    return [found];
  }
  return data.builds || [];
}

// --- chat-code cross-validation (issue #4) -----------------------------

async function fetchTraitNamesById(traitIds) {
  // Batch-fetch all traits by ID. Returns a Map<id, name>.
  const nameById = new Map();
  for (const chunk of chunkIds([...new Set(traitIds)])) {
    try {
      const arr = await gw2Fetch(`/v2/traits?ids=${chunk.join(',')}`);
      for (const t of arr || []) nameById.set(t.id, t.name);
    } catch (e) {
      // 404 (no such id) for an individual chunk shouldn't fail the whole call;
      // we'll fall through and the per-trait check will report 'unknown'
    }
  }
  return nameById;
}

async function fetchSkillNameById(skillIds) {
  const nameById = new Map();
  for (const chunk of chunkIds([...new Set(skillIds)])) {
    try {
      const arr = await gw2Fetch(`/v2/skills?ids=${chunk.join(',')}`);
      for (const s of arr || []) nameById.set(s.id, s.name);
    } catch (e) { /* same as above */ }
  }
  return nameById;
}

async function crossValidateBuild(build) {
  if (!build.buildCode) return { present: false, warnings: [], count: 0 };

  let decoded;
  try {
    decoded = decodeChatlink(build.buildCode);
  } catch (e) {
    return { present: true, warnings: [`buildCode: failed to decode — ${e.message}`], count: 1, decodeError: true };
  }
  if (decoded.type !== ChatlinkType.BuildTemplate) {
    return { present: true, warnings: [`buildCode: expected BuildTemplate (13), got type ${decoded.type}`], count: 1, decodeError: true };
  }
  const d = decoded.data;
  const warnings = [];

  // Spec names + trait existence (loose)
  for (let i = 1; i <= 3; i++) {
    const specId = d[`specialization${i}`];
    const humanSpec = build.specializations && build.specializations[i - 1];
    if (!specId) continue;
    if (!humanSpec) {
      warnings.push(`spec${i}: decoded spec id=${specId} but no human-maintained spec at index ${i - 1}`);
      continue;
    }

    let spec;
    try {
      spec = await gw2Fetch(`/v2/specializations/${specId}`);
    } catch (e) {
      warnings.push(`spec${i}: failed to fetch /v2/specializations/${specId} — ${e.message.slice(0, 80)}`);
      continue;
    }

    if (spec.name !== humanSpec.name) {
      warnings.push(`spec${i}: name mismatch — JSON "${humanSpec.name}" vs decoded "${spec.name}" (id=${specId})`);
    }

    // Trait names: loose check — each human trait must exist in the spec's
    // 3 minor + 9 major trait list. The GW2 build template encodes trait
    // choices as row indices (Top/Middle/Bottom), not as specific trait
    // indices, so a tight per-choice check would need the actual trait-ID
    // mapping that's not in the decoded data.
    const allTraitIds = [...(spec.minor_traits || []), ...(spec.major_traits || [])];
    const nameById = await fetchTraitNamesById(allTraitIds);
    const availableNames = new Set(nameById.values());
    const humanTraits = Array.isArray(humanSpec.traits) ? humanSpec.traits : [];
    for (let j = 0; j < humanTraits.length; j++) {
      const t = humanTraits[j];
      if (!availableNames.has(t)) {
        warnings.push(`spec${i}.trait${j}: trait "${t}" (JSON) not found in spec "${spec.name}" (id=${specId})`);
      }
    }
  }

  // Skill names: tight check
  const skillMap = [
    ['heal', d.terrestrialHealingSkillPalette],
    ['utility1', d.terrestrialUtilitySkillPalette1],
    ['utility2', d.terrestrialUtilitySkillPalette2],
    ['utility3', d.terrestrialUtilitySkillPalette3],
    ['elite', d.terrestrialEliteSkillPalette],
  ];
  const skillIds = skillMap.filter(([, id]) => id).map(([, id]) => id);
  const skillNameById = await fetchSkillNameById(skillIds);
  for (const [slot, skillId] of skillMap) {
    if (!skillId) continue;
    const humanSkill = (build.skills || []).find(s => s.slot === slot);
    if (!humanSkill) continue;
    const decodedName = skillNameById.get(skillId);
    if (!decodedName) {
      warnings.push(`${slot}: skill id=${skillId} (decoded) not found in /v2/skills (id may be stale)`);
    } else if (decodedName !== humanSkill.name) {
      warnings.push(`${slot}: name mismatch — JSON "${humanSkill.name}" vs decoded "${decodedName}" (id=${skillId})`);
    }
  }

  return { present: true, warnings, count: warnings.length };
}

// --- main flow ----------------------------------------------------------

async function processBuild(build, index) {
  const report = {
    id: build.id, name: build.name,
    resolved: 0, skipped: 0, failed: 0,
    lines: [], mutations: [], failures: [],
    crossValidation: { present: false, warnings: [], count: 0 },
  };
  const slots = build.equipment && build.equipment.slots;
  if (!slots) {
    report.lines.push('  (no equipment.slots block)');
    return report;
  }
  for (const [slotName, slotDef] of Object.entries(slots)) {
    const cls = classifySlot(slotDef);
    if (cls.kind === 'resolved') {
      report.skipped++;
      report.lines.push(`  ${slotName}: skipped (already id=${slotDef.id})`);
    } else if (cls.kind === 'name') {
      const r = resolveName(index, cls.name);
      if (!r) {
        report.failed++;
        report.failures.push({ slot: slotName, name: cls.name, reason: 'not in index' });
        report.lines.push(`  ${slotName}: name="${cls.name}" → NOT FOUND`);
      } else {
        report.resolved++;
        report.mutations.push({ slot: slotName, from: { name: cls.name }, to: { id: r.id } });
        const ambig = r.ambiguous ? ` (ambiguous: ${r.candidates.length} matches, picked first)` : '';
        const ci = r.caseInsensitive ? ' (case-insensitive match)' : '';
        report.lines.push(`  ${slotName}: name="${cls.name}" → id=${r.id}${ci}${ambig}`);
      }
    } else if (cls.kind === 'statPrefix') {
      const r = await resolveStatPrefix({ statPrefix: cls.statPrefix, slotName: cls.slotName, build, index });
      if (r && r.id) {
        report.resolved++;
        report.mutations.push({ slot: slotName, from: { statPrefix: cls.statPrefix, slot: cls.slotName }, to: { id: r.id } });
        const ambig = r.ambiguous ? ` (ambiguous: ${r.candidates} matches, picked first)` : '';
        report.lines.push(`  ${slotName}: statPrefix="${cls.statPrefix}", slot="${cls.slotName}" → id=${r.id} ("${r.name}")${ambig}`);
      } else {
        report.failed++;
        const reason = (r && r.failure) || 'no match';
        report.failures.push({ slot: slotName, statPrefix: cls.statPrefix, reason });
        report.lines.push(`  ${slotName}: statPrefix="${cls.statPrefix}", slot="${cls.slotName}" → FAILED (${reason})`);
      }
    } else if (cls.kind === 'missing') {
      report.skipped++;
      // silent — slot is null/missing, no message needed
    } else {
      report.skipped++;
      report.lines.push(`  ${slotName}: skipped (unknown slot shape)`);
    }
  }
  return report;
}

function printReports(reports) {
  for (const r of reports) {
    console.log(`[${r.id}] ${r.name}`);
    for (const line of r.lines) console.log(line);
    if (r.mutations.length) {
      console.log(`  MUTATIONS:`);
      for (const m of r.mutations) {
        console.log(`    ${m.slot}: ${JSON.stringify(m.from)} → ${JSON.stringify(m.to)}`);
      }
    }
    if (r.failures.length) {
      console.log(`  FAILURES:`);
      for (const f of r.failures) {
        const label = f.name ? `name="${f.name}"` : `statPrefix="${f.statPrefix}"`;
        console.log(`    ${f.slot}: ${label} → ${f.reason}`);
      }
    }
    if (r.crossValidation.present) {
      if (r.crossValidation.warnings.length) {
        console.log(`  CROSS-VALIDATION (buildCode present):`);
        for (const w of r.crossValidation.warnings) {
          console.log(`    WARN: ${w}`);
        }
      } else {
        console.log(`  CROSS-VALIDATION (buildCode present): 0 mismatch(es)`);
      }
    }
    console.log(`  ${r.resolved} resolved · ${r.skipped} skipped · ${r.failed} failed`);
    console.log('');
  }
}

function printSummary(reports) {
  const totals = reports.reduce((acc, r) => ({
    resolved: acc.resolved + r.resolved,
    skipped: acc.skipped + r.skipped,
    failed: acc.failed + r.failed,
    cvWarnings: acc.cvWarnings + (r.crossValidation?.count || 0),
    cvBuildsChecked: acc.cvBuildsChecked + (r.crossValidation?.present ? 1 : 0),
    builds: acc.builds + 1,
  }), { resolved: 0, skipped: 0, failed: 0, cvWarnings: 0, cvBuildsChecked: 0, builds: 0 });
  console.log('=== Summary ===');
  let summary = `${totals.resolved} resolved · ${totals.skipped} skipped · ${totals.failed} failed across ${totals.builds} build(s)`;
  if (totals.cvBuildsChecked > 0) {
    summary += ` · ${totals.cvWarnings} cross-validation warning(s) across ${totals.cvBuildsChecked} build(s) with buildCode`;
  }
  console.log(summary);
  return totals;
}

function applyMutations(data, reports) {
  let applied = 0;
  for (const r of reports) {
    if (!r.mutations.length) continue;
    const build = data.builds.find(b => b.id === r.id);
    if (!build || !build.equipment || !build.equipment.slots) continue;
    for (const m of r.mutations) {
      build.equipment.slots[m.slot] = m.to;
      applied++;
    }
  }
  if (applied > 0) saveMetaBuilds(data);
  return applied;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { printHelp(); return; }

  console.log(args.dryRun ? '=== resolve-meta-items.js — DRY RUN ===' : '=== resolve-meta-items.js — WRITE MODE ===');

  // Load builds first (fail fast on JSON errors).
  let data;
  try { data = loadMetaBuilds(); }
  catch (e) { console.error(`Failed to read ${META_BUILDS_PATH}: ${e.message}`); process.exit(1); }
  const builds = selectBuilds(data, args);
  console.log(`Processing ${builds.length} build(s)...\n`);

  // Load or build the item-name index.
  let index;
  try { index = await loadIndex(args.refresh); }
  catch (e) {
    console.error(`Failed to build/load the item-name index: ${e.message}`);
    process.exit(1);
  }
  console.log(`Index: ${path.relative(process.cwd(), INDEX_PATH)} (built ${index.builtAt}, ${index.totalIds} items, ${index.uniqueNames} unique names)\n`);

  // Process each build (slot resolution + chat-code cross-validation).
  const reports = [];
  for (const build of builds) {
    const report = await processBuild(build, index);
    report.crossValidation = await crossValidateBuild(build);
    reports.push(report);
  }
  printReports(reports);
  const totals = printSummary(reports);

  // Apply mutations if --write.
  const totalMutations = reports.reduce((sum, r) => sum + r.mutations.length, 0);
  if (args.dryRun) {
    if (totalMutations > 0) {
      console.log(`\n${totalMutations} mutation(s) would be applied with --write.`);
    } else {
      console.log('\nNo mutations to apply.');
    }
  } else {
    if (totalMutations > 0) {
      const applied = applyMutations(data, reports);
      console.log(`\nWrote ${applied} mutation(s) to ${path.relative(process.cwd(), META_BUILDS_PATH)}.`);
    } else {
      console.log('\nNo mutations to write.');
    }
  }

  // Exit code: non-zero if any failures (so CI / scripts can detect broken state).
  process.exit(totals.failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
