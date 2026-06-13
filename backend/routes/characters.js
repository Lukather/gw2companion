const express = require('express');
const router = express.Router();
const { gw2Fetch } = require('../services/gw2-api');

// GET /api/characters — list all characters with basic info
router.get('/characters', async (req, res) => {
  try {
    // Fetch all character names
    const charNames = await gw2Fetch('/v2/characters');

    if (!charNames || charNames.length === 0) {
      return res.json({ characters: [] });
    }

    // Fetch full details for each character
    // Use batch? The API doesn't have a bulk character endpoint, so we fetch individually
    // Limit concurrency to avoid rate limits
    const characters = [];
    const batchSize = 5;

    for (let i = 0; i < charNames.length; i += batchSize) {
      const batch = charNames.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(name =>
          gw2Fetch(`/v2/characters/${encodeURIComponent(name)}`).catch(err => {
            console.error(`Failed to fetch character ${name}:`, err.message);
            return null;
          })
        )
      );
      for (const char of results) {
        if (char) characters.push(char);
      }
      // Small delay between batches to be nice to the API
      if (i + batchSize < charNames.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // Return summarized character info
    const summary = characters.map(c => ({
      name: c.name,
      race: c.race,
      profession: c.profession,
      level: c.level,
      gender: c.gender,
      guild: c.guild_name || null,
      created: c.created,
      age: c.age,
      deaths: c.deaths,
      equipment: c.equipment?.map(e => ({
        slot: e.slot,
        itemId: e.id,
        upgrades: e.upgrades,
        infusions: e.infusions,
      })) || [],
      bagCount: c.bags?.length || 0,
      crafting: c.crafting?.map(cr => ({
        discipline: cr.discipline,
        rating: cr.rating,
        active: cr.active,
      })) || [],
    }));

    res.json({ characters: summary });
  } catch (err) {
    console.error('Error fetching characters:', err);
    if (err.status === 401 || err.status === 403) {
      return res.status(401).json({ error: 'Invalid or missing API key. Please check your API key permissions.' });
    }
    res.status(500).json({ error: 'Failed to fetch characters from GW2 API.' });
  }
});

module.exports = router;
