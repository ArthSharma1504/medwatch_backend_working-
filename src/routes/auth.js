// src/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_super_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';
const SALT_ROUNDS = 10;

// Helper to sign token
function signToken(user) {
  const payload = { id: user.id, username: user.username, role: user.role };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Register route
// Rules:
// - If there are NO users in the DB, allow creating an admin freely (first-time bootstrap).
// - After at least one user exists, creating an admin requires an existing admin token in Authorization header.
router.post('/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ ok: false, error: 'username and password required' });

    // Normalize role
    const wantedRole = (role || 'staff').toLowerCase();
    if (!['admin', 'doctor', 'staff'].includes(wantedRole)) {
      return res.status(400).json({ ok: false, error: 'role must be one of admin, doctor, staff' });
    }

    // check if any users exist
    const existingCount = await User.count();

    // if trying to create admin and users already exist, require admin token
    if (existingCount > 0 && wantedRole === 'admin') {
      // check Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(403).json({ ok: false, error: 'creating admin requires an existing admin token in Authorization header' });
      }
      const token = authHeader.split(' ')[1];
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (payload.role !== 'admin') return res.status(403).json({ ok: false, error: 'only admin can create admin users' });
      } catch (e) {
        return res.status(403).json({ ok: false, error: 'invalid admin token' });
      }
    }

    // If username exists, error
    const found = await User.findOne({ where: { username } });
    if (found) return res.status(409).json({ ok: false, error: 'username already exists' });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = await User.create({ username, passwordHash, role: wantedRole });

    const token = signToken({ id: newUser.id, username: newUser.username, role: newUser.role });
    return res.json({ ok: true, user: { id: newUser.id, username: newUser.username, role: newUser.role }, token });
  } catch (err) {
    console.error('auth.register error', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ ok: false, error: 'username and password required' });

    const user = await User.findOne({ where: { username } });
    if (!user) return res.status(401).json({ ok: false, error: 'invalid credentials' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ ok: false, error: 'invalid credentials' });

    const token = signToken({ id: user.id, username: user.username, role: user.role });
    return res.json({ ok: true, user: { id: user.id, username: user.username, role: user.role }, token });
  } catch (err) {
    console.error('auth.login error', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
