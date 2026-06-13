/**
 * Guild Wars 2 profession metadata.
 * Colors are sourced from the official GW2 wiki style guide
 * and mirrored in `tailwind.config.js` (`colors.profession`).
 */

export const PROFESSION_COLORS = {
  Guardian: '#7ab3cf',
  Warrior: '#fcd432',
  Engineer: '#b06b3c',
  Ranger: '#8cd43c',
  Thief: '#c08e7c',
  Elementalist: '#f68a6c',
  Mesmer: '#b57dc8',
  Necromancer: '#5ba35b',
  Revenant: '#d2691e',
};

const FALLBACK = '#888';

/**
 * Get the GW2 profession color for a given profession name.
 * Returns a neutral gray if the profession is unknown.
 *
 * @param {string} name - Profession name (e.g. "Guardian")
 * @returns {string} Hex color
 */
export function professionColor(name) {
  return PROFESSION_COLORS[name] || FALLBACK;
}
