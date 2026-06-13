const express = require('express');
const router = express.Router();
const { getApiKey } = require('../db');
const { gw2Fetch } = require('../services/gw2-api');

// Debug endpoint is local-only. In production deployments (NODE_ENV=production)
// it's disabled to avoid leaking internal state (API key presence, char count,
// GW2 latency, etc).
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  // Return 404 in production so callers see the same as if the route didn't exist.
  router.get('/debug', (req, res) => res.status(404).json({ error: 'Not found' }));
} else {
  // GET /api/debug — simple connectivity test
  router.get('/debug', async (req, res) => {
    const key = getApiKey();
    const hasKey = !!key;

    let gw2Status = 'not tested';
    let charCount = 0;
    let pingMs = 0;

    const t0 = Date.now();
    try {
      if (hasKey) {
        const chars = await gw2Fetch('/v2/characters');
        charCount = chars.length;
        gw2Status = 'ok';
      } else {
        gw2Status = 'no key';
      }
      pingMs = Date.now() - t0;
    } catch (err) {
      gw2Status = `error: ${err.message}`;
      pingMs = Date.now() - t0;
    }

    res.json({
      ok: true,
      hasKey,
      gw2Status,
      charCount,
      pingMs,
      timestamp: new Date().toISOString(),
    });
  });
}

module.exports = router;
