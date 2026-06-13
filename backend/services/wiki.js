const { wikiFetch } = require('./gw2-api');

/**
 * Search the GW2 Wiki for a page title matching an item name.
 * @param {string} itemName - The item name to search for
 * @returns {Promise<object|null>} Parsed wiki page data or null
 */
async function searchWiki(itemName) {
  try {
    // First try direct page parse (wiki page titles usually match item names)
    const pageTitle = itemName.replace(/ /g, '_');

    const parseResult = await wikiFetch({
      action: 'parse',
      page: pageTitle,
      prop: 'text',
      section: 0,
    });

    if (parseResult && parseResult.parse && parseResult.parse.text) {
      return extractItemInfo(parseResult.parse.text['*'], itemName);
    }
  } catch (err) {
    // Page not found or other error — try search
  }

  // Fallback: search for the item
  try {
    const searchResult = await wikiFetch({
      action: 'query',
      list: 'search',
      srsearch: itemName,
      srlimit: 3,
    });

    if (searchResult?.query?.search?.length > 0) {
      const bestMatch = searchResult.query.search[0];
      const parseResult = await wikiFetch({
        action: 'parse',
        page: bestMatch.title,
        prop: 'text',
        section: 0,
      });

      if (parseResult?.parse?.text) {
        return extractItemInfo(parseResult.parse.text['*'], itemName);
      }
    }
  } catch (err) {
    console.warn(`Wiki lookup failed for "${itemName}":`, err.message);
  }

  return null;
}

/**
 * Extract useful information from wiki page HTML.
 * Looks for acquisition methods, crafting recipes, and usage notes.
 */
function extractItemInfo(html, itemName) {
  const info = {
    name: itemName,
    acquisition: [],
    crafting: null,
    usedIn: [],
    notes: [],
  };

  // Clean HTML for regex matching - remove tags for text analysis
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  // Check for acquisition methods
  if (text.includes('crafted') || text.includes('recipe') || text.includes('Recipe')) {
    info.acquisition.push('crafting');
  }
  if (text.includes('dropped by') || text.includes('loot') || text.includes('Drop')) {
    info.acquisition.push('drop');
  }
  if (text.includes('vendor') || text.includes('purchased') || text.includes('sold by')) {
    info.acquisition.push('vendor');
  }
  if (text.includes('achievement') || text.includes('reward')) {
    info.acquisition.push('achievement');
  }
  if (text.includes('Mystic Forge') || text.includes('mystic forge')) {
    info.acquisition.push('mystic-forge');
  }

  // Check if it's used in crafting
  if (text.includes('used to craft') || text.includes('ingredient') || html.includes('Crafting material')) {
    info.usedIn.push('crafting-component');
  }

  // Check if it's part of a collection
  if (text.includes('collection') || text.includes('Collection')) {
    info.usedIn.push('collection');
  }

  // Check for PvE build relevance
  if (text.includes('equipment') && (text.includes('power') || text.includes('condition') ||
      text.includes('healing') || text.includes('build'))) {
    info.usedIn.push('pve-build');
  }

  // Extract any warning/note sections
  const noteMatch = text.match(/Notes?(.*?)(?:See also|Gallery|Trivia|$)/i);
  if (noteMatch) {
    const noteText = noteMatch[1].trim().substring(0, 200);
    if (noteText) info.notes.push(noteText);
  }

  return info;
}

/**
 * Get build-related wiki pages for a profession.
 * @param {string} profession - e.g. "Guardian"
 * @returns {Promise<Array>} Array of page search results with titles and snippets
 */
async function getBuildPages(profession) {
  try {
    const searchResult = await wikiFetch({
      action: 'query',
      list: 'search',
      srsearch: `${profession} PvE build`,
      srlimit: 5,
    });

    const pages = searchResult?.query?.search || [];

    // Try to extract structured data from each page
    const enriched = [];
    for (const page of pages) {
      try {
        const parseResult = await wikiFetch({
          action: 'parse',
          page: page.title,
          prop: 'text',
          section: 0,
        });

        if (parseResult?.parse?.text) {
          const html = parseResult.parse.text['*'];
          const traits = extractTraitsFromHtml(html);
          const skills = extractSkillsFromHtml(html);
          const equipment = extractEquipmentFromHtml(html);

          enriched.push({
            title: page.title,
            snippet: page.snippet,
            timestamp: page.timestamp,
            traits,
            skills,
            equipment,
          });
        } else {
          enriched.push(page);
        }
      } catch (e) {
        enriched.push(page);
      }
    }

    return enriched;
  } catch (err) {
    console.warn(`Build search failed for ${profession}:`, err.message);
    return [];
  }
}

/**
 * Extract trait IDs from wiki page HTML.
 * Looks for template {{trait|id}} and similar patterns.
 */
function extractTraitsFromHtml(html) {
  const traits = [];
  // Match {{trait|<id>}} or {{trait|<name>}} patterns
  const traitRegex = /\{\{trait\|([^}|]+)/gi;
  let match;
  while ((match = traitRegex.exec(html)) !== null) {
    traits.push(match[1].trim());
  }
  return traits;
}

/**
 * Extract skill references from wiki page HTML.
 */
function extractSkillsFromHtml(html) {
  const skills = [];
  // Match {{skill|<id>}} or {{skill|<name>}} patterns
  const skillRegex = /\{\{skill\|([^}|]+)/gi;
  let match;
  while ((match = skillRegex.exec(html)) !== null) {
    skills.push(match[1].trim());
  }
  return skills;
}

/**
 * Extract equipment notes from wiki page HTML.
 */
function extractEquipmentFromHtml(html) {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const equipment = {};

  // Look for stat prefix mentions
  const prefixMatch = text.match(/Berserker|Viper|Harrier|Minstrel|Marauder|Celestial|Assassin|Rampager|Carrion|Cleric|Knight|Sentinel|Dire|Rabid|Shaman|Soldier|Trailblazer|Wanderer|Commander|Grieving|Harrier|Marshal|Plaguedoctor|Ritualist|Seraph|Sinister|Vigilant|Zealot/i);
  if (prefixMatch) equipment.prefix = prefixMatch[0];

  // Look for rune mentions
  const runeMatch = text.match(/Rune of the ([\w\s]+)/i);
  if (runeMatch) equipment.runes = runeMatch[0];

  // Look for sigil mentions
  const sigilMatch = text.match(/Sigil of ([\w\s]+)/gi);
  if (sigilMatch) equipment.sigils = sigilMatch;

  return equipment;
}

module.exports = { searchWiki, getBuildPages, extractTraitsFromHtml, extractSkillsFromHtml, extractEquipmentFromHtml };
