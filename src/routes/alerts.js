const express = require('express');
const router = express.Router();
const { Alert } = require('../models');

// GET /api/alerts?target=RFID001&limit=50
router.get('/', async (req, res) => {
  try {
    const where = {};
    if (req.query.target) where.target_uid = req.query.target;
    const limit = parseInt(req.query.limit || '50', 10);
    const alerts = await Alert.findAll({
      where,
      order: [['id','DESC']],
      limit
    });
    res.json({ ok: true, count: alerts.length, alerts });
  } catch (err) {
    console.error('alerts.get error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
