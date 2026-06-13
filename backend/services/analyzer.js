/**
 * Item categorization engine.
 * Analyzes items and assigns: sell, salvage, keep, or use/consume.
 */

// Equipment types that can be salvaged
const SALVAGEABLE_TYPES = new Set([
  'Armor', 'Weapon', 'Trinket', 'Back',
]);

// Consumable types
const CONSUMABLE_TYPES = new Set([
  'Consumable', 'Food', 'Utility', 'Booze', 'Halloween',
]);

// Rarities worth salvaging for materials
const SALVAGE_RARITIES = new Set([
  'Masterwork', 'Rare', 'Exotic',
]);

// Items that are always worth keeping
const ACCOUNT_BOUND_KEEP = new Set([
  'Ascended', 'Legendary',
]);

// Gold threshold: items worth more than this are suggested to sell
const SELL_THRESHOLD_GOLD = 0.5; // 50 silver

/**
 * Categorize a single item.
 * @param {object} item - Item from inventory with merged details/prices
 * @param {object|null} wikiInfo - Wiki-extracted info (optional)
 * @returns {object} Category and reasoning
 */
function categorizeItem(item, wikiInfo = null) {
  const { rarity, type, sellPrice, buyPrice, binding, flags, itemGoldValue, count } = item;

  // Account-bound ascended/legendary items: always keep
  if (binding === 'Account' && ACCOUNT_BOUND_KEEP.has(rarity)) {
    return {
      action: 'keep',
      reason: `Account-bound ${rarity} item — valuable equipment, do not sell or salvage.`,
      priority: 'high',
    };
  }

  // Legendary items: always keep
  if (rarity === 'Legendary') {
    return {
      action: 'keep',
      reason: 'Legendary item — never sell or salvage.',
      priority: 'high',
    };
  }

  // Ascended items: keep
  if (rarity === 'Ascended') {
    return {
      action: 'keep',
      reason: 'Ascended gear — keep for PvE builds or alts.',
      priority: 'high',
    };
  }

  // Consumables: use
  if (CONSUMABLE_TYPES.has(type)) {
    return {
      action: 'use',
      reason: `Consumable (${type}) — use it or sell if you have excess.`,
      priority: 'low',
    };
  }

  // Equipment that is masterwork/rare/exotic and not account bound: consider salvaging
  if (SALVAGEABLE_TYPES.has(type) && SALVAGE_RARITIES.has(rarity) && binding !== 'Account') {
    // If sell price is high (>SELL_THRESHOLD_GOLD), suggest selling instead
    if (sellPrice * count >= SELL_THRESHOLD_GOLD) {
      return {
        action: 'sell',
        reason: `${rarity} ${type} — sell on TP for ${(sellPrice * count).toFixed(2)}g.`,
        priority: sellPrice * count > 5 ? 'high' : 'medium',
      };
    }
    // Otherwise salvage
    return {
      action: 'salvage',
      reason: `${rarity} ${type} — salvage for materials (worth more than TP price).`,
      priority: 'medium',
    };
  }

  // Equipment that's fine/basic: salvage or sell
  if (SALVAGEABLE_TYPES.has(type) && (rarity === 'Fine' || rarity === 'Masterwork')) {
    if (sellPrice * count >= SELL_THRESHOLD_GOLD) {
      return {
        action: 'sell',
        reason: `Sell on TP for ${(sellPrice * count).toFixed(2)}g.`,
        priority: 'medium',
      };
    }
    return {
      action: 'salvage',
      reason: `${rarity} ${type} — salvage for materials.`,
      priority: 'low',
    };
  }

  // Crafting materials
  if (type === 'CraftingMaterial') {
    if (sellPrice * count >= SELL_THRESHOLD_GOLD) {
      return {
        action: 'sell',
        reason: `Crafting material worth ${(sellPrice * count).toFixed(2)}g — sell if you don't need it.`,
        priority: 'medium',
      };
    }
    return {
      action: 'keep',
      reason: 'Crafting material — keep for future crafting.',
      priority: 'low',
    };
  }

  // Gizmos, containers, etc.
  if (type === 'Gizmo' || type === 'Container') {
    return {
      action: 'use',
      reason: `${type} — open/use it to get contents.`,
      priority: 'medium',
    };
  }

  // Minipets, skins, etc.
  if (type === 'MiniPet' || type === 'Mini') {
    if (binding === 'Account') {
      return { action: 'use', reason: 'Account-bound mini — add to your wardrobe.', priority: 'low' };
    }
    if (sellPrice * count >= SELL_THRESHOLD_GOLD) {
      return { action: 'sell', reason: `Mini worth ${(sellPrice * count).toFixed(2)}g — sell on TP.`, priority: 'medium' };
    }
    return { action: 'keep', reason: 'Mini — keep or add to wardrobe.', priority: 'low' };
  }

  // Upgrade components (runes, sigils, jewels)
  if (type === 'UpgradeComponent') {
    if (sellPrice * count >= 2) {
      return { action: 'sell', reason: `Valuable rune/sigil — sell for ${(sellPrice * count).toFixed(2)}g.`, priority: 'high' };
    }
    return { action: 'salvage', reason: 'Low-value upgrade — salvage or sell to vendor.', priority: 'low' };
  }

  // Trophy / junk
  if (type === 'Trophy' || type === 'Junk') {
    return { action: 'sell', reason: `${type} — sell to vendor.`, priority: 'low' };
  }

  // Default: if it has a decent sell price, suggest selling
  if (sellPrice * count >= SELL_THRESHOLD_GOLD) {
    return {
      action: 'sell',
      reason: `Worth ${(sellPrice * count).toFixed(2)}g on TP — consider selling.`,
      priority: 'medium',
    };
  }

  // If wiki info says it's used in builds, suggest keeping
  if (wikiInfo && wikiInfo.usedIn && wikiInfo.usedIn.includes('pve-build')) {
    return {
      action: 'keep',
      reason: 'Used in PvE builds — keep for your characters.',
      priority: 'medium',
    };
  }

  // Fallback: keep
  return {
    action: 'keep',
    reason: 'No clear action — keep for now.',
    priority: 'low',
  };
}

/**
 * Analyze a full inventory and return enriched results.
 * @param {Array} items - Array of inventory items
 * @param {object} options - Analysis options
 * @returns {object} Analyzed results
 */
function analyzeInventory(items, options = {}) {
  const results = items.map(item => {
    const category = categorizeItem(item, item.wikiInfo || null);
    return {
      ...item,
      action: category.action,
      reason: category.reason,
      priority: category.priority,
    };
  });

  // Compute summary statistics
  const summary = {
    totalItems: results.length,
    sell: results.filter(i => i.action === 'sell').length,
    salvage: results.filter(i => i.action === 'salvage').length,
    keep: results.filter(i => i.action === 'keep').length,
    use: results.filter(i => i.action === 'use').length,
    potentialGold: results
      .filter(i => i.action === 'sell')
      .reduce((sum, i) => sum + i.itemGoldValue, 0),
  };

  // Sort: high priority first, then by action type, then by value
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  results.sort((a, b) => {
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    const aDiff = ['sell', 'salvage', 'use', 'keep'].indexOf(a.action) -
                   ['sell', 'salvage', 'use', 'keep'].indexOf(b.action);
    if (aDiff !== 0) return aDiff;
    return b.itemGoldValue - a.itemGoldValue;
  });

  return { results, summary };
}

module.exports = { categorizeItem, analyzeInventory };
