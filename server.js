// server.js
require('dotenv').config(); // load .env if present
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');

const { sequelize } = require('./src/models'); // Sequelize instance
const authRoutes = require('./src/routes/auth');
const ingestRoutes = require('./src/routes/ingest');
const patientRoutes = require('./src/routes/patients');
const contactRoutes = require('./src/routes/contacts');
const alertRoutes = require('./src/routes/alerts');
const mapRoutes = require('./src/routes/map');
const mdrRoutes = require('./src/routes/mdrcases');
const { requireAuth, requireRole } = require('./src/middleware/auth');

const { init: initSocket } = require('./src/socket'); // socket initializer

const app = express();
app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json());

// --- API routes ---
app.use('/api/auth', authRoutes);
app.use('/api/ingest', ingestRoutes); // Google Sheets -> Apps Script -> POST here
app.use('/api/patients', patientRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/map', mapRoutes);
app.use('/api/mdrcases', requireAuth, requireRole('admin','doctor'), mdrRoutes);

// simple health check
app.get('/', (req, res) => res.json({ ok: true, msg: 'MedWatch backend running' }));

// Create HTTP server and wire Socket.IO
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const io = initSocket(server);

// make io available to routes via app.locals
app.locals.io = io;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('DB connected');

    // NOTE: in development you can use { alter: true } or { force: true } carefully
    await sequelize.sync();

    server.listen(PORT, () => {
      console.log('Server + Socket listening on', PORT);
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

start();
