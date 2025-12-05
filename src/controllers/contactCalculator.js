// controllers/contactCalculator.js
const { RawEvent, ContactEdge } = require('../models');

function overlapMs(aStart, aEnd, bStart, bEnd) {
  const start = aStart > bStart ? aStart : bStart;
  const end = aEnd < bEnd ? aEnd : bEnd;
  return Math.max(0, end - start);
}

async function computeContactsForRoom(room) {
  const events = await RawEvent.findAll({ where: { room }, order: [['entry_time','ASC']] });
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];
      if (!a.entry_time || !a.exit_time || !b.entry_time || !b.exit_time) continue;
      const ms = overlapMs(new Date(a.entry_time), new Date(a.exit_time), new Date(b.entry_time), new Date(b.exit_time));
      if (ms > 0) {
        const [pa, pb] = (a.uid <= b.uid) ? [a.uid, b.uid] : [b.uid, a.uid];
        // check existing overlap (simple)
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
          await ContactEdge.create({
            person_a_uid: pa,
            person_b_uid: pb,
            room,
            overlap_start: new Date(Math.max(new Date(a.entry_time), new Date(b.entry_time))),
            overlap_end: new Date(Math.min(new Date(a.exit_time), new Date(b.exit_time))),
            weight: ms / 1000
          });
        }
      }
    }
  }
}

module.exports = { computeContactsForRoom };
