// src/routes/contacts.js
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { RawEvent, ContactEdge } = require('../models');

// Helper: compute overlap in ms
function overlapMs(aStart, aEnd, bStart, bEnd) {
  const start = aStart > bStart ? aStart : bStart;
  const end = aEnd < bEnd ? aEnd : bEnd;
  return Math.max(0, end - start);
}

// POST /api/contacts/compute
// optional payload: { room: '101' } to compute only that room
router.post('/compute', async (req, res) => {
  try {
    const roomFilter = req.body && req.body.room ? { room: req.body.room } : null;

    // fetch distinct rooms if no room provided
    const rooms = roomFilter
      ? [roomFilter.room]
      : (await RawEvent.findAll({
          attributes: ['room'],
          where: { room: { [Op.ne]: null } },
          group: ['room']
        })).map(r => r.room);

    const createdEdges = [];

    for (const room of rooms) {
      // get events for this room ordered by entry_time
      const events = await RawEvent.findAll({
        where: { room },
        order: [['entry_time', 'ASC']]
      });

      // naive O(n^2) overlap detection
      for (let i = 0; i < events.length; i++) {
        for (let j = i + 1; j < events.length; j++) {
          const a = events[i];
          const b = events[j];

          // ensure we have valid dates
          if (!a.entry_time || !a.exit_time || !b.entry_time || !b.exit_time) continue;

          const ms = overlapMs(new Date(a.entry_time), new Date(a.exit_time), new Date(b.entry_time), new Date(b.exit_time));
          if (ms > 0) {
            // canonical order to avoid duplicate edge directions
            const [pa, pb] = (a.uid <= b.uid) ? [a.uid, b.uid] : [b.uid, a.uid];
            // avoid creating duplicate identical edge entries: check existing overlapping edge in same room/time range
            const exists = await ContactEdge.findOne({
              where: {
                person_a_uid: pa,
                person_b_uid: pb,
                room,
                overlap_start: { [Op.lte]: new Date(Math.max(new Date(a.entry_time), new Date(b.entry_time))) },
                overlap_end: { [Op.gte]: new Date(Math.min(new Date(a.exit_time), new Date(b.exit_time))) }
              }
            });
            if (!exists) {
              const edge = await ContactEdge.create({
                person_a_uid: pa,
                person_b_uid: pb,
                room,
                overlap_start: new Date(Math.max(new Date(a.entry_time), new Date(b.entry_time))),
                overlap_end: new Date(Math.min(new Date(a.exit_time), new Date(b.exit_time))),
                weight: ms / 1000 // seconds
              });
              createdEdges.push(edge);
            }
          }
        }
      }
    }

    return res.json({ ok: true, roomsProcessed: rooms.length, created: createdEdges.length });
  } catch (err) {
    console.error('contacts.compute error', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/contacts/chain/:uid?depth=2
// returns nodes and edges up to `depth` levels (default 2)
router.get('/chain/:uid', async (req, res) => {
  try {
    const startUid = req.params.uid;
    const maxDepth = parseInt(req.query.depth || '2', 10);
    if (!startUid) return res.status(400).json({ ok: false, error: 'uid required' });

    // BFS across ContactEdge relationships (undirected)
    const visited = new Set([startUid]);
    const queue = [{ uid: startUid, depth: 0 }];
    const nodes = new Set([startUid]);
    const edges = [];

    while (queue.length) {
      const { uid, depth } = queue.shift();
      if (depth >= maxDepth) continue;

      // find all edges where uid is either person_a_uid or person_b_uid
      const related = await ContactEdge.findAll({
        where: {
          [Op.or]: [{ person_a_uid: uid }, { person_b_uid: uid }]
        }
      });

      for (const edge of related) {
        const a = edge.person_a_uid;
        const b = edge.person_b_uid;
        // determine neighbor
        const neighbor = (a === uid) ? b : a;

        // push edge (normalize direction)
        edges.push({
          id: edge.id,
          a,
          b,
          room: edge.room,
          overlap_start: edge.overlap_start,
          overlap_end: edge.overlap_end,
          weight: edge.weight
        });

        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          nodes.add(neighbor);
          queue.push({ uid: neighbor, depth: depth + 1 });
        }
      }
    }

    return res.json({
      ok: true,
      start: startUid,
      depth: maxDepth,
      nodes: Array.from(nodes),
      edges
    });
  } catch (err) {
    console.error('contacts.chain error', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
