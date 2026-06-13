const express = require('express');
const router = express.Router();
const { gw2Fetch } = require('../services/gw2-api');
const { chunkIds } = require('../services/utils');

// Category names for grouping
const CATEGORY_NAMES = {
  5: 'Cooking',
  6: 'Crafting',
  9: 'Festive',
  11: 'Jeweling',
  15: 'Nourishment',
  16: 'Scribing',
  19: 'Ascended',
  22: 'Gemstones & Jewels',
  24: 'Common Crafting',
  25: 'Fine Crafting',
  26: 'Masterwork Crafting',
  27: 'Rare Crafting',
  29: 'Trophy',
  30: 'Salvage',
  32: 'Uncategorized',
  34: 'Bladed',
  35: 'Destroyer',
  38: 'Krait',
};

// Materials that are worth refining (tiered crafting mats like ore, wood, cloth, leather)
const REFINABLE_CATEGORIES = new Set([5, 6, 9, 11, 15, 16, 24, 25, 26, 27, 29]);

// Gold threshold for suggesting sale
const SELL_THRESHOLD_GOLD = 1.0;

function categorizeMaterial(item) {
  const { vendorValue, sellPrice, count, category } = item;
  const totalValue = sellPrice > 0 ? sellPrice * count : vendorValue * count;

  // High-value items: sell
  if (totalValue >= SELL_THRESHOLD_GOLD) {
    return {
      action: 'sell',
      reason: `Worth ${totalValue.toFixed(2)}g total — sell if you have excess.`,
      priority: 'high',
    };
  }

  // Ascended materials: keep
  if (category === 19) {
    return { action: 'keep', reason: 'Ascended crafting material — keep for legendary/ascended crafting.', priority: 'high' };
  }

  // Trophy / salvage materials: keep (used for crafting)
  if (category === 29 || category === 30) {
    return { action: 'keep', reason: 'Used in crafting — keep for future recipes.', priority: 'low' };
  }

  // T1-T5 crafting materials: consider refining if stack is large
  if (REFINABLE_CATEGORIES.has(category) && count >= 250) {
    return { action: 'refine', reason: `Stack of ${count} — consider refining or selling if excess.`, priority: 'medium' };
  }

  // Default: keep
  return { action: 'keep', reason: 'Keep for crafting and upgrades.', priority: 'low' };
}

// GET /api/materials — account material storage with TP prices
router.get('/materials', async (req, res) => {
  try {
    // 1. Fetch material storage
    const rawMaterials = await gw2Fetch('/v2/account/materials');
    console.log('[Materials] /v2/account/materials count:', rawMaterials?.length);

    if (!rawMaterials || rawMaterials.length === 0) {
      return res.json({ materials: [], summary: { totalItems: 0, totalValue: 0, sell: 0, keep: 0, refine: 0 } });
    }

    // 2. Gather unique item IDs
    const uniqueIds = [...new Set(rawMaterials.map(m => m.id))];

    // 3. Fetch item details in batches
    const itemDetailsMap = {};
    const idChunks = chunkIds(uniqueIds);

    for (const chunk of idChunks) {
      const details = await gw2Fetch(`/v2/items?ids=${chunk.join(',')}`);
      for (const d of details) itemDetailsMap[d.id] = d;
      await new Promise(r => setTimeout(r, 100));
    }

    // 4. Fetch TP prices in batches
    const priceMap = {};
    const priceChunks = chunkIds(uniqueIds);

    for (const chunk of priceChunks) {
      try {
        const prices = await gw2Fetch(`/v2/commerce/prices?ids=${chunk.join(',')}`);
        for (const p of prices) priceMap[p.id] = p;
      } catch (err) {
        console.warn('Failed to fetch some material prices:', err.message);
      }
      await new Promise(r => setTimeout(r, 100));
    }

    // 5. Merge data and categorize
    const materials = rawMaterials.map(raw => {
      const detail = itemDetailsMap[raw.id] || {};
      const price = priceMap[raw.id] || {};

      const vendorValue = (detail.vendor_value || 0) / 10000;
      const sellPrice = price.sells ? price.sells.unit_price / 10000 : 0;
      const buyPrice = price.buys ? price.buys.unit_price / 10000 : 0;
      const totalValue = sellPrice > 0 ? sellPrice * raw.count : vendorValue * raw.count;

      const item = {
        id: raw.id,
        name: detail.name || `Unknown (${raw.id})`,
        icon: detail.icon || '',
        rarity: detail.rarity || 'Unknown',
        type: detail.type || 'Unknown',
        category: raw.category || 0,
        categoryName: CATEGORY_NAMES[raw.category] || `Category ${raw.category}`,
        count: raw.count || 0,
        vendorValue,
        buyPrice,
        sellPrice,
        totalValue,
        binding: raw.binding || null,
      };

      const cat = categorizeMaterial(item);
      item.action = cat.action;
      item.reason = cat.reason;
      item.priority = cat.priority;

      return item;
    });

    // Sort by priority then value
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    materials.sort((a, b) => {
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) return pDiff;
      return b.totalValue - a.totalValue;
    });

    // Summary
    const summary = {
      totalItems: materials.reduce((s, m) => s + m.count, 0),
      totalValue: materials.reduce((s, m) => s + m.totalValue, 0),
      sell: materials.filter(m => m.action === 'sell').length,
      keep: materials.filter(m => m.action === 'keep').length,
      refine: materials.filter(m => m.action === 'refine').length,
    };

    res.json({ materials, summary });
    console.log('[Materials] Response: items=%d value=%.2f', summary.totalItems, summary.totalValue);
  } catch (err) {
    console.error('Error fetching materials:', err);
    if (err.status === 401 || err.status === 403) {
      return res.status(401).json({ error: 'Invalid or missing API key. Check your permissions (needs: inventories).' });
    }
    res.status(500).json({ error: 'Failed to fetch material storage.' });
  }
});

module.exports = router;
