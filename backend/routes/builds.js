const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { gw2Fetch } = require('../services/gw2-api');
const { chunkIds } = require('../services/utils');
const { getBuildPages } = require('../services/wiki');

const META_BUILDS_PATH = path.join(__dirname, '..', 'data', 'meta-builds.json');
let SPEC_CACHE = null;

function loadMetaBuilds() {
  try { return JSON.parse(fs.readFileSync(META_BUILDS_PATH, 'utf-8')); }
  catch (e) { console.warn('Failed to load meta-builds.json:', e.message); return { lastUpdated: null, builds: [] }; }
}
function saveMetaBuilds(data) { fs.writeFileSync(META_BUILDS_PATH, JSON.stringify(data, null, 2), 'utf-8'); }
function wikiUrl(name) { return name ? `https://wiki.guildwars2.com/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}` : ''; }
function flattenSpecs(specs) {
  if (!specs) return [];
  const r = [];
  for (const m of ['pve','pvp','wvw']) { if (Array.isArray(specs[m])) r.push(...specs[m].filter(s => s && typeof s.id === 'number').map(s => ({...s, _mode: m}))); }
  return r;
}

async function batchFetch(path, ids) {
  const results = [];
  for (const chunk of chunkIds(ids)) {
    try { results.push(...(await gw2Fetch(`${path}?ids=${chunk.join(',')}`))); }
    catch (e) { console.warn(`[Builds] Batch ${path} failed:`, e.message); }
    await new Promise(r => setTimeout(r, 50));
  }
  return results;
}

// GET /api/builds?character=
router.get('/builds', async (req, res) => {
  try {
    const charName = req.query.character;
    const charNames = await gw2Fetch('/v2/characters');
    if (!charNames?.length) return res.json({ character: null, build: null, metaComparison: null });

    const target = (charName && charNames.includes(charName)) ? charName : charNames[0];
    const char = await gw2Fetch(`/v2/characters/${encodeURIComponent(target)}`);
    console.log('[Builds] Character:', char.name, char.profession);

    const metaBuilds = loadMetaBuilds();
    const metaBuild = metaBuilds.builds.find(b => b.profession === char.profession) || null;

    // ---- Collect character IDs ----
    const allSpecs = flattenSpecs(char.specializations);
    const specIds = [...new Set(allSpecs.map(s => s.id))];
    const charTraitIds = [...new Set(allSpecs.flatMap(s => s.traits || []))];
    const charSkillIds = [];
    if (char.skills?.pve) {
      const p = char.skills.pve;
      if (p.heal) charSkillIds.push(p.heal);
      (p.utilities || []).forEach(id => { if (id) charSkillIds.push(id); });
      if (p.elite) charSkillIds.push(p.elite);
    }
    const equipIds = [...new Set((char.equipment || []).flatMap(eq => [eq.id, ...(eq.upgrades||[]), ...(eq.infusions||[])]).filter(Boolean))];

    // ---- Resolve meta spec names → IDs → all traits ----
    if (!SPEC_CACHE) {
      try { SPEC_CACHE = await gw2Fetch('/v2/specializations?ids=all'); }
      catch (e) { SPEC_CACHE = []; }
    }
    const nameToSpecId = {};
    for (const s of SPEC_CACHE) nameToSpecId[s.name] = s.id;

    let metaTraitIds = [];
    if (metaBuild) {
      for (const ms of metaBuild.specializations) {
        const sid = nameToSpecId[ms.name];
        if (sid != null) {
          ms._id = sid;
          try {
            const sd = await gw2Fetch(`/v2/specializations/${sid}`);
            metaTraitIds.push(...(sd?.major_traits || []).flat(), ...(sd?.minor_traits || []));
          } catch (e) { console.warn('[Builds] Spec fetch failed:', ms.name); }
          await new Promise(r => setTimeout(r, 50));
        }
      }
    }
    metaTraitIds = [...new Set(metaTraitIds.filter(Boolean))];
    const allTraitIds = [...new Set([...charTraitIds, ...metaTraitIds])];

    // ---- Fetch definitions ----
    const specDefs = specIds.length ? await gw2Fetch(`/v2/specializations?ids=${specIds.join(',')}`).catch(() => []) : [];
    const traitDefs = await batchFetch('/v2/traits', allTraitIds);
    const skillDefs = await batchFetch('/v2/skills', charSkillIds);
    const equipDefs = await batchFetch('/v2/items', equipIds);

    // Index
    const specDefMap = {}, traitDefMap = {}, skillDefMap = {}, itemDefMap = {};
    for (const s of specDefs) specDefMap[s.id] = s;
    for (const t of traitDefs) traitDefMap[t.id] = t;
    for (const s of skillDefs) skillDefMap[s.id] = s;
    for (const i of equipDefs) itemDefMap[i.id] = i;
    const traitNameToId = {};
    for (const t of traitDefs) traitNameToId[t.name] = t.id;

    // ---- Build character PvE build ----
    const pveSpecs = (char.specializations?.pve || [])
      .filter(s => s && typeof s.id === 'number')
      .map(spec => {
        const def = specDefMap[spec.id] || {};
        return {
          id: spec.id, name: def.name || `Spec ${spec.id}`, icon: def.icon || '',
          traits: (spec.traits || []).filter(tid => typeof tid === 'number').map(tid => {
            const td = traitDefMap[tid] || {}; const nm = td.name || `Trait ${tid}`;
            return { id: tid, name: nm, icon: td.icon || '', wikiUrl: wikiUrl(nm), tier: td.tier || 0, slot: td.slot || '' };
          }),
        };
      });

    const pveSkills = [];
    if (char.skills?.pve) {
      const p = char.skills.pve;
      for (const s of [{slot:'heal',id:p.heal}, ...(p.utilities||[]).map((id,i)=>({slot:`utility${i+1}`,id})), {slot:'elite',id:p.elite}]) {
        if (!s.id) continue;
        const def = skillDefMap[s.id] || {}; const nm = def.name || `Skill ${s.id}`;
        pveSkills.push({ slot: s.slot, id: s.id, name: nm, icon: def.icon || '', wikiUrl: wikiUrl(nm) });
      }
    }

    function extractPrefix(name) {
      // GW2 stat-selectable items start with attribute prefix
      // e.g. "Berserker's Pearl Broadsword", "Viper's ...", "Celestial ..."
      if (!name) return null;
      // Common prefixes - check longest first to avoid "Dire" matching "Dire's"
      const prefixes = [
        "Plaguedoctor's", "Trailblazer's", "Berserker's", "Assassin's",
        "Marauder's", "Commander's", "Harrier's", "Minstrel's", "Wanderer's",
        "Soldier's", "Cavalier's", "Knight's", "Cleric's", "Rampager's",
        "Captain's", "Nomad's", "Settler's", "Sentinel's", "Apothecary's",
        "Ritualist's", "Marshal's", "Shaman's", "Magus's", "Dragon's",
        "Celestial", "Sinister", "Grieving", "Vigilant", "Crusader",
        "Seraph", "Dire", "Rabid",
      ];
      for (const p of prefixes) {
        if (name.startsWith(p + ' ') || name === p) return p;
      }
      return null;
    }

    const equipment = (char.equipment || []).map(eq => {
      const d = itemDefMap[eq.id] || {}; const nm = d.name || `Item ${eq.id}`;
      return {
        slot: eq.slot, id: eq.id, name: nm, icon: d.icon || '', wikiUrl: wikiUrl(nm),
        rarity: d.rarity || '', type: d.type || '', level: d.level || 0,
        prefix: extractPrefix(nm),
        upgrades: (eq.upgrades||[]).map(uid => { const u = itemDefMap[uid]||{}; const un = u.name||`Up ${uid}`; return {id:uid,name:un,wikiUrl:wikiUrl(un)}; }),
        infusions: (eq.infusions||[]).map(iid => { const u = itemDefMap[iid]||{}; const un = u.name||`Inf ${iid}`; return {id:iid,name:un,wikiUrl:wikiUrl(un)}; }),
      };
    });

    // ---- Meta comparison ----
    let comparison = null;
    if (metaBuild) {
      const specMatches = metaBuild.specializations.map(ms => {
        const charSpec = pveSpecs.find(cs => cs.name === ms.name);
        const metaIds = ms.traits.map(tn => traitNameToId[tn]).filter(Boolean);
        if (!charSpec) {
          return { name: ms.name, match: false, reason: 'Not equipped', metaTraits: metaIds,
            missingTraits: metaIds.map(id => { const td = traitDefMap[id]||{}; const nm = td.name||`Trait ${id}`; return {id,name:nm,wikiUrl:wikiUrl(nm)}; }) };
        }
        const charIds = charSpec.traits.map(t => t.id);
        const missing = metaIds.filter(id => !charIds.includes(id));
        return { name: ms.name, match: missing.length === 0, metaTraits: metaIds,
          missingTraits: missing.map(id => { const td = traitDefMap[id]||{}; const nm = td.name||`Trait ${id}`; return {id,name:nm,wikiUrl:wikiUrl(nm)}; }) };
      });

      const skillMatches = (metaBuild.skills || []).map(ms => {
        const cs = pveSkills.find(s => s.slot === ms.slot);
        return {
          slot: ms.slot, expectedName: ms.name, expectedWikiUrl: wikiUrl(ms.name),
          match: cs?.name === ms.name, actualName: cs?.name || 'None', actualWikiUrl: cs?.wikiUrl || '',
        };
      });

      comparison = { metaName: metaBuild.name, source: metaBuild.source, specializationMatches: specMatches, skillMatches, equipmentSummary: metaBuild.equipment };
    }

    console.log('[Builds] Done: specs=%d skills=%d equip=%d meta=%s', pveSpecs.length, pveSkills.length, equipment.length, comparison?.metaName || 'none');

    res.json({
      character: { name: char.name, profession: char.profession, level: char.level },
      build: { pve: { specializations: pveSpecs, skills: pveSkills }, equipment },
      metaComparison: comparison, metaLastUpdated: metaBuilds.lastUpdated,
      otherCharacters: charNames.filter(n => n !== char.name),
    });
  } catch (err) {
    console.error('[Builds] Error:', err);
    if (err.status === 401 || err.status === 403) return res.status(401).json({ error: 'Invalid API key.' });
    res.status(500).json({ error: 'Failed to fetch build data.' });
  }
});

// POST /api/builds/refresh-meta
router.post('/builds/refresh-meta', async (req, res) => {
  try {
    const meta = loadMetaBuilds();
    const profs = [...new Set(meta.builds.map(b => b.profession))];
    let count = 0;
    for (const p of profs) {
      try { const pages = await getBuildPages(p); if (pages?.length) count++; }
      catch (e) { console.warn(`[Builds] Wiki ${p}:`, e.message); }
      await new Promise(r => setTimeout(r, 500));
    }
    meta.lastUpdated = new Date().toISOString(); saveMetaBuilds(meta);
    res.json({ success: true, lastUpdated: meta.lastUpdated, professionsChecked: profs.length, wikiPagesFound: count });
  } catch (err) { res.status(500).json({ error: 'Failed to refresh.' }); }
});

module.exports = router;
