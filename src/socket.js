// src/socket.js
let io = null;

function init(server) {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: {
      origin: "*", // in production, set your frontend origin here
      methods: ["GET","POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
    });
  });

  return io;
}

function getIo() {
  if (!io) throw new Error('Socket.io not initialized. Call init(httpServer) first.');
  return io;
}

module.exports = { init, getIo };
