const express = require('express');
const router = express.Router();
const { gw2Fetch } = require('../services/gw2-api');
const { chunkIds } = require('../services/utils');

/**
 * Collect all bag items from a character object.
 * Each bag has an `inventory` array of items (or null for empty slots).
 */
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
          bagSlot: bag.slot,
        });
      }
    }
  }
  return items;
}

// GET /api/inventory — aggregated inventory from all characters
router.get('/inventory', async (req, res) => {
  try {
    // 1. Get character list
    const charNames = await gw2Fetch('/v2/characters');

    if (!charNames || charNames.length === 0) {
      return res.json({ items: [], totalGold: 0, characterCount: 0 });
    }

    // 2. Fetch all characters and collect bag items
    const allRawItems = [];
    const batchSize = 5;

    for (let i = 0; i < charNames.length; i += batchSize) {
      const batch = charNames.slice(i, i + batchSize);
      const characters = await Promise.all(
        batch.map(name =>
          gw2Fetch(`/v2/characters/${encodeURIComponent(name)}`).catch(err => {
            console.error(`Failed to fetch character ${name}:`, err.message);
            return null;
          })
        )
      );

      for (const char of characters) {
        if (char) {
          const items = collectBagItems(char);
          allRawItems.push(...items);
        }
      }

      if (i + batchSize < charNames.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    if (allRawItems.length === 0) {
      return res.json({ items: [], totalGold: 0, characterCount: charNames.length });
    }

    // 3. Deduplicate item IDs
    const uniqueIds = [...new Set(allRawItems.map(item => item.id))];

    // 4. Batch-fetch item details
    const itemDetailsMap = {};
    const idChunks = chunkIds(uniqueIds);

    for (const chunk of idChunks) {
      const details = await gw2Fetch(`/v2/items?ids=${chunk.join(',')}`);
      for (const detail of details) {
        itemDetailsMap[detail.id] = detail;
      }
      await new Promise(r => setTimeout(r, 100));
    }

    // 5. Batch-fetch TP prices
    const priceMap = {};
    const priceChunks = chunkIds(uniqueIds);

    for (const chunk of priceChunks) {
      try {
        const prices = await gw2Fetch(`/v2/commerce/prices?ids=${chunk.join(',')}`);
        for (const price of prices) {
          priceMap[price.id] = price;
        }
      } catch (err) {
        // Prices may fail if no tradingpost scope; that's okay
        console.warn('Failed to fetch some prices:', err.message);
      }
      await new Promise(r => setTimeout(r, 100));
    }

    // 6. Merge data
    let totalGoldValue = 0;
    const mergedItems = allRawItems.map(raw => {
      const detail = itemDetailsMap[raw.id] || {};
      const price = priceMap[raw.id] || {};

      const vendorValue = (detail.vendor_value || 0) / 10000; // copper to gold
      const sellPrice = price.sells ? price.sells.unit_price / 10000 : 0;
      const buyPrice = price.buys ? price.buys.unit_price / 10000 : 0;
      const itemGoldValue = sellPrice > 0 ? sellPrice * raw.count : vendorValue * raw.count;
      totalGoldValue += itemGoldValue;

      return {
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

    // Sort by value descending
    mergedItems.sort((a, b) => b.itemGoldValue - a.itemGoldValue);

    res.json({
      items: mergedItems,
      totalGold: Math.round(totalGoldValue * 100) / 100,
      characterCount: charNames.length,
      itemCount: mergedItems.length,
    });
  } catch (err) {
    console.error('Error fetching inventory:', err);
    if (err.status === 401 || err.status === 403) {
      return res.status(401).json({ error: 'Invalid or missing API key.' });
    }
    res.status(500).json({ error: 'Failed to fetch inventory data.' });
  }
});

module.exports = router;
