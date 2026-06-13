const express = require('express');
const router = express.Router();
const { gw2Fetch } = require('../services/gw2-api');

// Story campaign definitions
const CAMPAIGNS = [
  { key: 'personal_story', name: 'Personal Story', order: 1, color: '#d2691e' },
  { key: 'heart_of_thorns', name: 'Heart of Thorns', order: 2, color: '#3ad93a' },
  { key: 'path_of_fire', name: 'Path of Fire', order: 3, color: '#fbaa34' },
  { key: 'end_of_dragons', name: 'End of Dragons', order: 4, color: '#62a4da' },
  { key: 'secrets_of_the_obscure', name: 'Secrets of the Obscure', order: 5, color: '#9c6adb' },
  { key: 'janthir_wilds', name: 'Janthir Wilds', order: 6, color: '#fb4e6e' },
];

// Living World seasons
const LIVING_WORLD = [
  { key: 'living_world_season_1', name: 'Living World S1', order: 7 },
  { key: 'living_world_season_2', name: 'Living World S2', order: 8 },
  { key: 'living_world_season_3', name: 'Living World S3', order: 9 },
  { key: 'living_world_season_4', name: 'Living World S4', order: 10 },
  { key: 'living_world_season_5', name: 'The Icebrood Saga', order: 11 },
];

// GET /api/story?character= — story progress for one character
router.get('/story', async (req, res) => {
  try {
    const charName = req.query.character;
    const viewAll = req.query.all === 'true';

    // 1. Fetch character list
    const charNames = await gw2Fetch('/v2/characters');

    if (!charNames || charNames.length === 0) {
      return res.json({ characters: [], campaigns: [] });
    }

    // 2. Determine which characters to fetch
    let targetChars;
    if (viewAll) {
      targetChars = charNames;
    } else if (charName) {
      if (!charNames.includes(charName)) {
        return res.status(404).json({ error: `Character "${charName}" not found.` });
      }
      targetChars = [charName];
    } else {
      // Default: first character
      targetChars = [charNames[0]];
    }

    // 3. Fetch character details (with story field)
    const characters = [];
    for (const name of targetChars) {
      try {
        const char = await gw2Fetch(`/v2/characters/${encodeURIComponent(name)}`);
        characters.push({ name: char.name, profession: char.profession, story: char.story || [] });
      } catch (err) {
        console.warn(`Failed to fetch character ${name}:`, err.message);
        characters.push({ name, profession: 'Unknown', story: {} });
      }
      await new Promise(r => setTimeout(r, 100));
    }

    // 4. Fetch story metadata to map IDs to campaigns
    let storyIdToCampaign = {};
    try {
      // Fetch seasons to get UUID -> name mapping
      const seasons = await gw2Fetch('/v2/stories/seasons');
      const seasonIdToName = {};
      if (Array.isArray(seasons)) {
        for (const s of seasons) {
          seasonIdToName[s.id] = s.name;
        }
      }

      // Map season names to campaign keys
      const SEASON_NAME_MAP = {
        'Personal Story': 'personal_story',
        'Heart of Thorns': 'heart_of_thorns',
        'Path of Fire': 'path_of_fire',
        'End of Dragons': 'end_of_dragons',
        'Secrets of the Obscure': 'secrets_of_the_obscure',
        'Janthir Wilds': 'janthir_wilds',
        'Living World Season 1': 'living_world_season_1',
        'Living World Season 2': 'living_world_season_2',
        'Living World Season 3': 'living_world_season_3',
        'Living World Season 4': 'living_world_season_4',
        'The Icebrood Saga': 'living_world_season_5',
      };

      // Fetch all stories and map each ID to its campaign
      const allStories = await gw2Fetch('/v2/stories');
      if (Array.isArray(allStories)) {
        for (const s of allStories) {
          const seasonName = seasonIdToName[s.season];
          const campaign = SEASON_NAME_MAP[seasonName];
          if (campaign) {
            storyIdToCampaign[s.id] = campaign;
          }
        }
      }
    } catch (err) {
      console.warn('Failed to fetch story metadata:', err.message);
    }

    // 5. Build campaign progress for each character
    const resultCharacters = characters.map(char => {
      const completedStoryIds = Array.isArray(char.story) ? char.story : [];

      // Group completed story IDs by campaign
      const campaignCounts = {};
      for (const id of completedStoryIds) {
        const campKey = storyIdToCampaign[id] || 'unknown';
        if (!campaignCounts[campKey]) campaignCounts[campKey] = [];
        campaignCounts[campKey].push(id);
      }

      const campaigns = CAMPAIGNS.map(camp => {
        const completed = campaignCounts[camp.key] || [];
        return {
          key: camp.key,
          name: camp.name,
          color: camp.color,
          completedCount: completed.length,
          started: completed.length > 0,
        };
      });

      const livingWorldCampaigns = LIVING_WORLD.filter(lw => {
        return campaignCounts[lw.key]?.length > 0;
      }).map(lw => ({
        key: lw.key,
        name: lw.name,
        color: '#888888',
        completedCount: campaignCounts[lw.key]?.length || 0,
        started: (campaignCounts[lw.key]?.length || 0) > 0,
      }));

      return {
        name: char.name,
        profession: char.profession,
        campaigns: [...campaigns, ...livingWorldCampaigns],
      };
    });

    res.json({ characters: resultCharacters, campaigns: CAMPAIGNS });
  } catch (err) {
    console.error('Error fetching story:', err);
    if (err.status === 401 || err.status === 403) {
      return res.status(401).json({ error: 'Invalid or missing API key. Check your permissions (needs: characters).' });
    }
    res.status(500).json({ error: 'Failed to fetch story progress.' });
  }
});

module.exports = router;
