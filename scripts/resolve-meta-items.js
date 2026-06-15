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
 *
 *   If the cache file is missing, it is built on first run (~3-5 min, ~370
 *   chunked API calls at the ArenaNet rate limit). Subsequent runs are
 *   instant. Use --refresh to force a rebuild when you know item names have
 *   changed (rare — only on game patches that rename items).
 *
 *   Multiple items can share a name (e.g. ascended vs. legendary skins).
 *   In that case the first ID wins and the report shows a warning. The
 *   curator can resolve manually if the wrong skin is picked.
 *
 * SLOT SHAPES HANDLED (per meta-builds.json schema in plans/per-slot-equipment-ids-prd.md)
 *   { id: 12345 }                → skipped (already resolved)
 *   { name: "Foo" }              → resolved via the local name index
 *   { statPrefix: "Berserker's", slot: "Helm" }  → skipped (deferred to #6)
 *   null / missing               → skipped
 *
 * REUSE OF EXISTING INFRA
 *   - API client: backend/services/gw2-api.js (gw2Fetch — in-memory cache
 *     + rate-limit handling).
 *   - ID chunking: backend/services/utils.js (chunkIds — 200/call, max
 *     accepted by the GW2 API).
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
afterwards. Use --refresh to force a rebuild.`);
}

// --- slot classification ------------------------------------------------

function classifySlot(slotDef) {
  if (slotDef == null) return { kind: 'missing' };
  if (typeof slotDef === 'object' && typeof slotDef.id === 'number') return { kind: 'resolved' };
  if (typeof slotDef === 'object' && typeof slotDef.name === 'string' && slotDef.name.trim()) {
    return { kind: 'name', name: slotDef.name.trim() };
  }
  if (typeof slotDef === 'object' && slotDef.statPrefix && slotDef.slot) {
    return { kind: 'deferred' }; // { statPrefix, slot } — handled in #6
  }
  return { kind: 'unknown' }; // malformed; treat as skipped with a note
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
  let fetched = 0;
  const chunks = chunkIds(allIds);
  for (let i = 0; i < chunks.length; i++) {
    try {
      const items = await gw2Fetch(`/v2/items?ids=${chunks[i].join(',')}`);
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item && typeof item.name === 'string' && typeof item.id === 'number') {
            const n = item.name;
            if (!names[n]) names[n] = [];
            names[n].push(item.id);
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
    names,
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

function processBuild(build, index) {
  const report = {
    id: build.id, name: build.name,
    resolved: 0, skipped: 0, failed: 0,
    lines: [], mutations: [], failures: [],
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
    } else if (cls.kind === 'deferred') {
      report.skipped++;
      report.lines.push(`  ${slotName}: skipped ({ statPrefix, slot } is deferred to #6)`);
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
        console.log(`    ${f.slot}: name="${f.name}" → ${f.reason}`);
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
    builds: acc.builds + 1,
  }), { resolved: 0, skipped: 0, failed: 0, builds: 0 });
  console.log('=== Summary ===');
  console.log(`${totals.resolved} resolved · ${totals.skipped} skipped · ${totals.failed} failed across ${totals.builds} build(s)`);
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

  // Process each build.
  const reports = builds.map(b => processBuild(b, index));
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
