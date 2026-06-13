/**
 * Shared utility functions used across backend routes.
 */

/**
 * Batch an array of IDs into chunks of the given size.
 * The GW2 API accepts at most 200 IDs per request.
 * @param {number[]} ids - Array of item/building IDs
 * @param {number} size - Max chunk size (default 200)
 * @returns {number[][]} Array of chunk arrays
 */
function chunkIds(ids, size = 200) {
  const chunks = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}

module.exports = { chunkIds };
