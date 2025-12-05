// src/routes/ingest.js
const express = require('express');
const router = express.Router();
const { RawEvent, Person } = require('../models');

// normalize helper (same as earlier)
function normalizeRow(r) {
  const out = {};
  for (const k of Object.keys(r)) {
    const key = k.toString().trim().toLowerCase().replace(/\s+/g, '_');
    out[key] = r[k];
  }
  return out;
}

router.post('/sheet', async (req, res) => {
  try {
    const rows = req.body.rows || req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ ok: false, error: 'payload must be an array in `rows`' });

    const created = [];
    const roomsTouched = new Set();

    for (const raw of rows) {
      const r = normalizeRow(raw);
      const uid = r.uid || r.uid_number || r.id || r['u id'] || null;
      const profile = r.profile || r.role || null;
      const room = r.room || r.location || null;
      const entry_raw = r.entry_time || r.entry || r['entry time'] || null;
      const exit_raw = r.exit_time || r.exit || r['exit time'] || null;
      const parseDate = (val) => {
        if (!val) return null;
        if (Object.prototype.toString.call(val) === '[object Date]') return val;
        if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?/.test(val)) {
          return new Date(val.replace(' ', 'T'));
        }
        const d = new Date(val);
        if (isNaN(d.getTime())) return null;
        return d;
      };
      const entry_time = parseDate(entry_raw);
      const exit_time = parseDate(exit_raw);

      const ev = await RawEvent.create({
        uid: uid,
        profile: profile,
        room: room,
        entry_time: entry_time,
        exit_time: exit_time,
        status: r.status || r.state || null
      });

      created.push(ev);
      if (room) roomsTouched.add(room);

      // upsert person
      if (uid) {
        try {
          await Person.findOrCreate({
            where: { uid: uid },
            defaults: { name: uid, profile: profile }
          });
        } catch (err) {
          console.warn('Person upsert warning', err.message);
        }
      }

      // Emit socket event for new raw event
      try {
        const io = req.app.locals.io; // from server.js
        if (io) {
          io.emit('rawevent:new', {
            id: ev.id,
            uid: ev.uid,
            profile: ev.profile,
            room: ev.room,
            entry_time: ev.entry_time,
            exit_time: ev.exit_time,
            status: ev.status
          });
        }
      } catch (e) {
        console.warn('socket emit rawevent:new failed', e.message);
      }
    }

    // Emit map update after batch insert: send last-known for each room touched
    try {
      const io = req.app.locals.io;
      if (io && roomsTouched.size > 0) {
        // Lightweight map update: notify frontend that rooms changed
        io.emit('map:update', { rooms: Array.from(roomsTouched) });
      }
    } catch (e) {
      console.warn('socket emit map:update failed', e.message);
    }

    return res.json({ ok: true, count: created.length, insertedIds: created.map(c => c.id) });
  } catch (err) {
    console.error('Ingest error', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
