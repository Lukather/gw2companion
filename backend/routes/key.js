const express = require('express');
const router = express.Router();
const { validateKey } = require('../services/gw2-api');
const { setApiKey, getApiKey } = require('../db');

// POST /api/key — validate and store the GW2 API key
router.post('/key', async (req, res) => {
  try {
    const { apiKey } = req.body;

    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return res.status(400).json({ error: 'API key is required.' });
    }

    const trimmedKey = apiKey.trim();

    // Validate the key against GW2 API
    const tokenInfo = await validateKey(trimmedKey);

    if (!tokenInfo.valid) {
      return res.status(400).json({
        error: 'Invalid API key. Please check your key and try again.',
        details: tokenInfo.error
      });
    }

    // Store the valid key
    setApiKey(trimmedKey);

    return res.json({
      success: true,
      tokenInfo: {
        name: tokenInfo.name,
        permissions: tokenInfo.permissions || [],
      }
    });
  } catch (err) {
    console.error('Error validating key:', err);
    return res.status(500).json({ error: 'Failed to validate API key. Check your network connection.' });
  }
});

// GET /api/key — check if a key is currently stored
router.get('/key', (req, res) => {
  const key = getApiKey();
  if (key) {
    return res.json({ hasKey: true });
  }
  return res.json({ hasKey: false });
});

// DELETE /api/key — remove stored key
router.delete('/key', (req, res) => {
  setApiKey(null);
  return res.json({ success: true });
});

module.exports = router;
