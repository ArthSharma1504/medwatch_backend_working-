// src/routes/mdrcases.js
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { MdrCase, Alert, ContactEdge } = require('../models');

// BFS helper
async function bfsContactDepths(startUid, maxDepth = 2) {
  const depths = {};
  depths[startUid] = 0;
  const queue = [{ uid: startUid, depth: 0 }];
  while (queue.length) {
    const { uid, depth } = queue.shift();
    if (depth >= maxDepth) continue;
    const related = await ContactEdge.findAll({
      where: { [Op.or]: [{ person_a_uid: uid }, { person_b_uid: uid }] }
    });
    for (const edge of related) {
      const neighbor = (edge.person_a_uid === uid) ? edge.person_b_uid : edge.person_a_uid;
      if (!neighbor) continue;
      if (!(neighbor in depths)) {
        depths[neighbor] = depth + 1;
        queue.push({ uid: neighbor, depth: depth + 1 });
      }
    }
  }
  return depths;
}

router.post('/', async (req, res) => {
  try {
    const { uid, organism } = req.body;
    if (!uid) return res.status(400).json({ ok: false, error: 'uid required' });

    const mdr = await MdrCase.create({ uid, organism: organism || null });
    const depths = await bfsContactDepths(uid, 2);

    const alertsCreated = [];
    for (const [targetUid, depth] of Object.entries(depths)) {
      let priority = depth === 0 ? 3 : depth === 1 ? 2 : 1;
      const label = depth === 0 ? 'Primary' : depth === 1 ? 'Secondary' : 'Tertiary';
      const message = depth === 0
        ? `${label}: MDR case detected for ${targetUid}${organism ? ` (organism: ${organism})` : ''}`
        : `${label} contact (depth=${depth}) from ${uid}${organism ? ` (organism: ${organism})` : ''}`;

      const alert = await Alert.create({
        type: 'mdr_contact',
        message,
        priority
      });

      const payload = {
        id: alert.id,
        target: targetUid,
        depth,
        priority,
        message
      };

      alertsCreated.push(payload);

      // Emit socket event for this alert
      try {
        const io = req.app.locals.io;
        if (io) io.emit('alert:new', payload);
      } catch (e) {
        console.warn('socket emit alert:new failed', e.message);
      }
    }

    return res.json({ ok: true, mdrCase: mdr, alertsCreated });
  } catch (err) {
    console.error('mdrcases.error', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
