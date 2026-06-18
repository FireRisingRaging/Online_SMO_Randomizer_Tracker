'use strict';

const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = parseInt(process.env.PORT || '3000', 10);

// roomCode -> { state: object|null, sockets: Set<ws> }
const rooms = new Map();

function getRoom(code) {
  if (!rooms.has(code)) {
    rooms.set(code, { state: null, sockets: new Set() });
  }
  return rooms.get(code);
}

function broadcast(roomCode, message, excludeSocket) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const data = JSON.stringify(message);
  for (const socket of room.sockets) {
    if (socket === excludeSocket) continue;
    if (socket.readyState === 1 /* OPEN */) {
      socket.send(data);
    }
  }
}

const server = http.createServer((req, res) => {
  // Lightweight health endpoint for Docker/Cloudflare.
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (socket) => {
  let roomCode = null;

  socket.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      socket.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'join' && typeof msg.room === 'string' && msg.room.length > 0) {
      // Leave previous room if switching.
      if (roomCode) {
        const oldRoom = rooms.get(roomCode);
        if (oldRoom) {
          oldRoom.sockets.delete(socket);
          if (oldRoom.sockets.size === 0) rooms.delete(roomCode);
        }
      }

      roomCode = msg.room;
      const room = getRoom(roomCode);
      room.sockets.add(socket);

      socket.send(JSON.stringify({ type: 'joined', room: roomCode }));

      // Send cached state immediately if we have it.
      if (room.state) {
        socket.send(JSON.stringify({ type: 'state', room: roomCode, data: room.state }));
      }
      return;
    }

    if (msg.type === 'state' && roomCode && msg.room === roomCode && msg.data) {
      const room = getRoom(roomCode);
      room.state = msg.data;
      broadcast(roomCode, { type: 'state', room: roomCode, data: msg.data }, socket);
      return;
    }
  });

  socket.on('close', () => {
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (room) {
      room.sockets.delete(socket);
      if (room.sockets.size === 0) rooms.delete(roomCode);
    }
  });

  socket.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });
});

server.listen(PORT, () => {
  console.log(`SMO Randomizer Tracker sync server listening on port ${PORT}`);
  console.log(`WebSocket path: /ws`);
});
