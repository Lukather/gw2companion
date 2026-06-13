const express = require('express');
const router = express.Router();
const { gw2Fetch } = require('../services/gw2-api');
const { searchWiki } = require('../services/wiki');
const { analyzeInventory } = require('../services/analyzer');
const { chunkIds } = require('../services/utils');

// Timeout for individual API calls (seconds)
const FETCH_TIMEOUT = 15000;

function collectBagItems(character) {
  const items = [];
  if (!character.bags) return items;
  for (const bag of character.bags) {
    if (!bag || !bag.inventory) continue;
    for (const slot of bag.inventory) {
      if (slot) {
        items.push({
          id: slot.id,
          count: slot.count || 1,
          binding: slot.binding || null,
          boundTo: slot.bound_to || null,
          charges: slot.charges,
          characterName: character.name,
        });
      }
    }
  }
  return items;
}

function log(step, detail) {
  const ts = new Date().toISOString().slice(11, 19);
  const msg = `[${ts}] ${step}: ${detail}`;
  console.log(msg);
  return msg;
}

// GET /api/analyze — full analysis (supports SSE streaming via ?stream=true)
router.get('/analyze', async (req, res) => {
  const includeWiki = req.query.wiki === 'true';
  const maxWikiItems = parseInt(req.query.maxWiki) || 20;
  const useStream = req.query.stream === 'true';
  const filterCharacter = req.query.character || null; // filter to single character

  // Helper to send progress (SSE or console log)
  const emit = (event, data) => {
    if (useStream) {
      // Write event and explicitly flush to ensure it's sent immediately
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      // Force flush if available (node >= 0.8)
      if (res.flush && typeof res.flush === 'function') {
        res.flush();
      }
    }
  };

  if (useStream) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({ message: 'Analysis started' })}\n\n`);
  }

  try {
    const t0 = Date.now();

    // === Step 1: Fetch character list ===
    log('STEP 1', 'Fetching character list...');
    emit('step', { step: 1, label: 'Fetching character list...', totalSteps: 6 });

    const charNames = await gw2Fetch('/v2/characters');

    if (!charNames || charNames.length === 0) {
      emit('done', { results: [], summary: { totalItems: 0 } });
      if (useStream) return res.end();
      return res.json({ results: [], summary: { totalItems: 0 } });
    }

    log('STEP 1', `Found ${charNames.length} characters: ${charNames.join(', ')}`);

    // Filter to a single character if requested
    if (filterCharacter) {
      if (charNames.includes(filterCharacter)) {
        log('STEP 1', `Filtering to character: ${filterCharacter}`);
        charNames.length = 0;
        charNames.push(filterCharacter);
        emit('step', { step: 1, label: `Selected: ${filterCharacter}`, totalSteps: 6 });
      } else {
        log('STEP 1', `Character not found: ${filterCharacter}`);
        emit('done', { results: [], summary: { totalItems: 0 }, error: `Character "${filterCharacter}" not found` });
        if (useStream) return res.end();
        return res.json({ results: [], summary: { totalItems: 0 }, error: `Character "${filterCharacter}" not found` });
      }
    } else {
      emit('step', { step: 1, label: `Found ${charNames.length} characters`, totalSteps: 6 });
    }

    // === Step 2: Fetch character details & collect bag items ===
    log('STEP 2', `Fetching details for ${charNames.length} characters...`);
    emit('step', { step: 2, label: `Loading ${charNames.length} characters...`, totalSteps: 6 });

    const allRawItems = [];
    for (let i = 0; i < charNames.length; i += 5) {
      const batch = charNames.slice(i, i + 5);
      const batchNum = Math.floor(i / 5) + 1;
      const totalBatches = Math.ceil(charNames.length / 5);

      log('STEP 2', `Batch ${batchNum}/${totalBatches}: ${batch.join(', ')}`);
      emit('step', {
        step: 2,
        label: `Loading character batch ${batchNum}/${totalBatches}...`,
        detail: batch.join(', '),
        totalSteps: 6,
      });

      const characters = await Promise.all(
        batch.map(name =>
          gw2Fetch(`/v2/characters/${encodeURIComponent(name)}`).catch(err => {
            log('STEP 2 ERROR', `${name}: ${err.message}`);
            emit('warn', { message: `Failed to load ${name}: ${err.message}` });
            return null;
          })
        )
      );

      for (const char of characters) {
        if (char) {
          const items = collectBagItems(char);
          allRawItems.push(...items);
          log('STEP 2', `  ${char.name}: ${items.length} items in bags`);
        }
      }

      if (i + 5 < charNames.length) {
        emit('step', { step: 2, label: `Waiting before next batch...`, totalSteps: 6 });
        await new Promise(r => setTimeout(r, 200));
      }
    }

    log('STEP 2', `Total raw items collected: ${allRawItems.length}`);
    emit('step', { step: 2, label: `Collected ${allRawItems.length} items from bags`, totalSteps: 6 });

    if (allRawItems.length === 0) {
      emit('done', { results: [], summary: { totalItems: 0 } });
      if (useStream) return res.end();
      return res.json({ results: [], summary: { totalItems: 0 } });
    }

    // === Step 3: Fetch item details ===
    const uniqueIds = [...new Set(allRawItems.map(i => i.id))];
    log('STEP 3', `Fetching details for ${uniqueIds.length} unique items...`);
    emit('step', { step: 3, label: `Fetching details for ${uniqueIds.length} items...`, totalSteps: 6 });

    const itemDetailsMap = {};
    const detailChunks = chunkIds(uniqueIds);
    for (let ci = 0; ci < detailChunks.length; ci++) {
      const chunk = detailChunks[ci];
      log('STEP 3', `  Item detail batch ${ci + 1}/${detailChunks.length}`);
      emit('step', {
        step: 3,
        label: `Item details batch ${ci + 1}/${detailChunks.length}...`,
        totalSteps: 6,
      });
      const details = await gw2Fetch(`/v2/items?ids=${chunk.join(',')}`);
      for (const d of details) itemDetailsMap[d.id] = d;
      if (ci < detailChunks.length - 1) await new Promise(r => setTimeout(r, 100));
    }

    // === Step 4: Fetch TP prices ===
    log('STEP 4', `Fetching TP prices for ${uniqueIds.length} items...`);
    emit('step', { step: 4, label: `Fetching Trading Post prices...`, totalSteps: 6 });

    const priceMap = {};
    const priceChunks = chunkIds(uniqueIds);
    for (let ci = 0; ci < priceChunks.length; ci++) {
      const chunk = priceChunks[ci];
      log('STEP 4', `  Price batch ${ci + 1}/${priceChunks.length}`);
      emit('step', {
        step: 4,
        label: `Price batch ${ci + 1}/${priceChunks.length}...`,
        totalSteps: 6,
      });
      try {
        const prices = await gw2Fetch(`/v2/commerce/prices?ids=${chunk.join(',')}`);
        for (const p of prices) priceMap[p.id] = p;
      } catch (err) {
        log('STEP 4 WARN', err.message);
        emit('warn', { message: `Some prices unavailable: ${err.message}` });
      }
      if (ci < priceChunks.length - 1) await new Promise(r => setTimeout(r, 100));
    }

    // === Step 5: Merge & Wiki enrichment ===
    let uidCounter = 0;
    let mergedItems = allRawItems.map(raw => {
      const detail = itemDetailsMap[raw.id] || {};
      const price = priceMap[raw.id] || {};
      const vendorValue = (detail.vendor_value || 0) / 10000;
      const sellPrice = price.sells ? price.sells.unit_price / 10000 : 0;
      const buyPrice = price.buys ? price.buys.unit_price / 10000 : 0;
      const itemGoldValue = sellPrice > 0 ? sellPrice * raw.count : vendorValue * raw.count;

      return {
        uid: ++uidCounter,
        id: raw.id,
        name: detail.name || `Unknown (${raw.id})`,
        icon: detail.icon || '',
        rarity: detail.rarity || 'Unknown',
        type: detail.type || 'Unknown',
        level: detail.level || 0,
        vendorValue,
        buyPrice,
        sellPrice,
        count: raw.count,
        binding: raw.binding,
        charges: raw.charges,
        characterName: raw.characterName,
        itemGoldValue,
        flags: detail.flags || [],
        details: detail.details || {},
      };
    });

    log('STEP 5', `Merged ${mergedItems.length} items with details and prices`);
    emit('step', { step: 5, label: `Merged ${mergedItems.length} items`, totalSteps: 6 });

    // Wiki enrichment (optional)
    if (includeWiki && mergedItems.length > 0) {
      const sortedForWiki = [...mergedItems].sort((a, b) => b.itemGoldValue - a.itemGoldValue);
      const wikiTargets = sortedForWiki.slice(0, maxWikiItems);

      log('STEP 5', `Fetching wiki data for ${wikiTargets.length} items...`);
      emit('step', { step: 5, label: `Fetching wiki data for ${wikiTargets.length} items...`, totalSteps: 6 });

      for (let wi = 0; wi < wikiTargets.length; wi++) {
        const item = wikiTargets[wi];
        emit('step', {
          step: 5,
          label: `Wiki lookup ${wi + 1}/${wikiTargets.length}: ${item.name}`,
          totalSteps: 6,
        });
        try {
          const wikiInfo = await searchWiki(item.name);
          if (wikiInfo && (wikiInfo.acquisition.length > 0 || wikiInfo.usedIn.length > 0)) {
            item.wikiInfo = wikiInfo;
            log('STEP 5', `  Wiki found: ${item.name}`);
          }
        } catch (err) {
          // skip
        }
        await new Promise(r => setTimeout(r, 150));
      }
    }

    // === Step 6: Run analysis ===
    log('STEP 6', 'Running categorization engine...');
    emit('step', { step: 6, label: 'Categorizing items...', totalSteps: 6 });

    const { results, summary } = analyzeInventory(mergedItems);

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    log('DONE', `Analysis complete in ${elapsed}s — ${summary.totalItems} items`);
    log('SUMMARY', `Sell: ${summary.sell}, Salvage: ${summary.salvage}, Keep: ${summary.keep}, Use: ${summary.use}, Potential gold: ${summary.potentialGold.toFixed(2)}`);

    // Build response payload
    // Sanitize items to avoid JSON.stringify failures (e.g., circular refs, weird API values)
    const safeResults = results.map(item => ({
      uid: item.uid,
      id: item.id,
      name: item.name,
      icon: item.icon,
      rarity: item.rarity,
      type: item.type,
      level: item.level,
      vendorValue: item.vendorValue,
      buyPrice: item.buyPrice,
      sellPrice: item.sellPrice,
      count: item.count,
      binding: item.binding,
      charges: item.charges,
      characterName: item.characterName,
      itemGoldValue: item.itemGoldValue,
      action: item.action,
      reason: item.reason,
      priority: item.priority,
      // Skip 'flags', 'details', 'wikiInfo' — they may contain unserializable data
    }));

    const payload = { results: safeResults, summary, elapsed: `${elapsed}s` };

    // Verify JSON serialization before sending
    try {
      JSON.stringify(payload);
    } catch (jsonErr) {
      log('ERROR', `JSON serialization failed: ${jsonErr.message}`);
      console.error('JSON payload error:', jsonErr);
      if (useStream) {
        emit('error', { error: 'Failed to serialize results' });
        return res.end();
      }
      return res.status(500).json({ error: 'Failed to serialize results. Please try again.' });
    }

    emit('done', payload);

    if (useStream) {
      res.end();
    } else {
      // Explicitly set headers and send
      res.setHeader('Content-Type', 'application/json');
      return res.send(JSON.stringify(payload));
    }
  } catch (err) {
    console.error('Analysis error:', err);
    const msg = err.message || 'Unknown error';
    log('ERROR', msg);

    // Always try to send a response, even if headers might have been sent
    if (useStream) {
      try { emit('error', { error: msg }); } catch (e) {}
      try { res.end(); } catch (e) {}
      return;
    }

    try {
      if (err.status === 401 || err.status === 403) {
        return res.status(401).json({ error: 'Invalid or missing API key.' });
      }
      return res.status(500).json({ error: msg });
    } catch (sendErr) {
      console.error('Failed to send error response:', sendErr);
    }
  }
});

module.exports = router;
