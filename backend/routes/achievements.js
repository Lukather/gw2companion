const express = require('express');
const router = express.Router();
const { gw2Fetch } = require('../services/gw2-api');
const { chunkIds } = require('../services/utils');

// GET /api/achievements — account achievements with progress
// Supports ?filter=near (close to completion) and ?category=<id>
router.get('/achievements', async (req, res) => {
  try {
    const filterNear = req.query.filter === 'near';
    const filterCategory = req.query.category ? parseInt(req.query.category) : null;

    // 1. Fetch account achievement progress
    const accountAchievements = await gw2Fetch('/v2/account/achievements');
    console.log('[Achievements] /v2/account/achievements count:', accountAchievements?.length);

    if (!accountAchievements || accountAchievements.length === 0) {
      return res.json({
        achievements: [],
        categories: [],
        summary: { total: 0, completed: 0, nearComplete: 0, totalAP: 0 },
      });
    }

    // 2. Gather unique achievement IDs for definition lookup
    const achievedIds = accountAchievements.map(a => a.id);

    // 3. Fetch achievement definitions in batches
    const definitionsMap = {};
    const idChunks = chunkIds(achievedIds);

    for (const chunk of idChunks) {
      const defs = await gw2Fetch(`/v2/achievements?ids=${chunk.join(',')}`);
      for (const d of defs) definitionsMap[d.id] = d;
      await new Promise(r => setTimeout(r, 100));
    }

    // 4. Fetch categories
    let categories = [];
    try {
      categories = await gw2Fetch('/v2/achievements/categories');
    } catch (err) {
      console.warn('Failed to fetch achievement categories:', err.message);
    }

    // 5. Merge progress with definitions
    const achievements = accountAchievements.map(acc => {
      const def = definitionsMap[acc.id] || {};
      const done = acc.done || false;
      const current = acc.current || 0;
      const max = acc.max || def.tiers?.[def.tiers.length - 1]?.count || 1;
      const repeated = acc.repeated || 0;
      const percent = max > 0 ? Math.round((current / max) * 100) : 0;
      const nearComplete = !done && percent >= 80;

      return {
        id: acc.id,
        name: def.name || `Achievement ${acc.id}`,
        description: def.description || '',
        icon: def.icon || '',
        category: acc.category || def.category || 0,
        done,
        current,
        max,
        percent,
        nearComplete,
        repeated,
        bits: acc.bits || null,
        tiers: def.tiers || [],
        rewards: def.rewards || [],
        requirements: def.requirements || [],
        locked: def.locked || false,
      };
    });

    // Apply filters
    let filtered = achievements;
    if (filterNear) {
      filtered = filtered.filter(a => a.nearComplete);
    }
    if (filterCategory) {
      filtered = filtered.filter(a => a.category === filterCategory);
    }

    // Sort: near completion first, then by percent desc
    filtered.sort((a, b) => {
      if (a.nearComplete && !b.nearComplete) return -1;
      if (!a.nearComplete && b.nearComplete) return 1;
      return b.percent - a.percent;
    });

    // Summary
    const summary = {
      total: achievements.length,
      completed: achievements.filter(a => a.done).length,
      nearComplete: achievements.filter(a => a.nearComplete).length,
      inProgress: achievements.filter(a => !a.done && a.current > 0).length,
    };

    res.json({ achievements: filtered, categories, summary });
    console.log('[Achievements] Response: total=%d completed=%d near=%d', summary.total, summary.completed, summary.nearComplete);
  } catch (err) {
    console.error('Error fetching achievements:', err);
    if (err.status === 401 || err.status === 403) {
      return res.status(401).json({ error: 'Invalid or missing API key. Check your permissions (needs: account).' });
    }
    res.status(500).json({ error: 'Failed to fetch achievements.' });
  }
});

// GET /api/achievements/daily — today's dailies
router.get('/achievements/daily', async (req, res) => {
  try {
    const [daily, dailyTomorrow] = await Promise.all([
      gw2Fetch('/v2/achievements/daily').catch(() => null),
      gw2Fetch('/v2/achievements/daily/tomorrow').catch(() => null),
    ]);

    res.json({ daily, dailyTomorrow });
  } catch (err) {
    console.error('Error fetching dailies:', err);
    res.status(500).json({ error: 'Failed to fetch daily achievements.' });
  }
});

module.exports = router;
