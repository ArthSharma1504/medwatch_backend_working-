// src/routes/map.js
const express = require('express');
const router = express.Router();
const { RawEvent } = require('../models');
const { Sequelize } = require('sequelize');

// GET /api/map/live
// returns latest event per uid: { uid, room, last_seen_at }
router.get('/live', async (req, res) => {
  try {
    // Use raw query to get last event per uid efficiently
    const rows = await RawEvent.sequelize.query(
      `SELECT r.uid, r.room, r.entry_time AS last_seen_at
       FROM raw_events r
       INNER JOIN (
         SELECT uid, MAX(entry_time) AS max_entry
         FROM raw_events
         GROUP BY uid
       ) t ON r.uid = t.uid AND r.entry_time = t.max_entry
       WHERE r.uid IS NOT NULL;`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    return res.json({ ok: true, count: rows.length, rows });
  } catch (err) {
    console.error('map.live error', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
