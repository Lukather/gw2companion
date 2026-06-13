const { getApiKey } = require('../db');

const GW2_API_BASE = 'https://api.guildwars2.com';
const WIKI_API_BASE = 'https://wiki.guildwars2.com';

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(url) {
  return url;
}

function getFromCache(url) {
  const entry = cache.get(getCacheKey(url));
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  return null;
}

function setCache(url, data) {
  cache.set(getCacheKey(url), { data, timestamp: Date.now() });
}

/**
 * Make an authenticated request to the official GW2 API.
 * @param {string} path - API path (e.g., '/v2/characters')
 * @param {object} options - Fetch options
 * @returns {Promise<object>} Parsed JSON response
 */
async function gw2Fetch(path, options = {}) {
  const apiKey = getApiKey();
  const url = `${GW2_API_BASE}${path}`;

  // Check cache for GET requests
  if (!options.method || options.method === 'GET') {
    const cached = getFromCache(url);
    if (cached) return cached;
  }

  const headers = {
    'Accept': 'application/json',
    ...options.headers,
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') || 2;
    console.warn(`GW2 API rate limited. Waiting ${retryAfter}s...`);
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    return gw2Fetch(path, options); // Retry once
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const error = new Error(`GW2 API error ${response.status}: ${text}`);
    error.status = response.status;
    error.body = text;
    throw error;
  }

  const data = await response.json();

  // Cache GET responses
  if (!options.method || options.method === 'GET') {
    setCache(url, data);
  }

  return data;
}

/**
 * Make a request to the GW2 Wiki MediaWiki API.
 * @param {object} params - Query parameters
 * @returns {Promise<object>} Parsed JSON response
 */
async function wikiFetch(params = {}) {
  const url = new URL(`${WIKI_API_BASE}/api.php`);
  url.searchParams.set('format', 'json');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const cacheKey = url.toString();
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const response = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' }
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const error = new Error(`Wiki API error ${response.status}: ${text}`);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  setCache(cacheKey, data);
  return data;
}

/**
 * Validate an API key by calling /v2/tokeninfo.
 * @param {string} apiKey - The key to validate
 * @returns {Promise<object>} Token info including permissions
 */
async function validateKey(apiKey) {
  const url = `${GW2_API_BASE}/v2/tokeninfo`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    }
  });

  if (!response.ok) {
    return { valid: false, error: `HTTP ${response.status}` };
  }

  const data = await response.json();
  return { valid: true, ...data };
}

module.exports = { gw2Fetch, wikiFetch, validateKey, GW2_API_BASE, WIKI_API_BASE };
