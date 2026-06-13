/**
 * Format a gold value (decimal) into a human-readable `Xg Ys Zc` string.
 *
 * GW2 currency: 1g = 100s = 10,000c. Backend prices are already in gold
 * (copper ÷ 10,000), so we just split the decimal back into g/s/c for display.
 *
 * @param {number} value - Gold amount as a decimal (e.g. 12.3456)
 * @returns {string} Formatted string (e.g. "12g 34s 56c")
 */
export function formatGold(value) {
  const v = Number(value) || 0;
  const g = Math.floor(v);
  const s = Math.floor((v - g) * 100);
  const c = Math.round(((v - g) * 100 - s) * 100);
  return `${g}g ${s}s ${c}c`;
}
