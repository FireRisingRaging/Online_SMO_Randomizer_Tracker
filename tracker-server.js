'use strict';

// All-in-one local dev server: static file hosting for the tracker page, the
// room-based WebSocket relay (join/state/liveEvent - same protocol as
// server.js), and the raw TCP listener the Switch mod's TrackerBridge speaks.
// Replaces the old 3-terminal setup (python static server + server.js +
// tracker-bridge.js) with a single `node tracker-server.js`.
//
// server.js itself is left untouched - it's still what the Docker image
// (cloud relay) builds from - this is purely the local all-in-one dev path.
//
// The room code used to be a CLI argument to tracker-bridge.js, requiring a
// rebuild-free but still per-tester manual step. Now the Switch mod sends its
// own room code (and the tracker's browser page enters the same one, same as
// before) inside each event, so one running instance can serve any number of
// simultaneous testers/rooms without restarting.

const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { WebSocketServer } = require('ws');

const HTTP_PORT = parseInt(process.env.PORT || process.argv[2] || '8080', 10);
const SWITCH_PORT = parseInt(process.env.SWITCH_PORT || process.argv[3] || '8173', 10);

const ROOT = __dirname;

// ── Stage name -> map_node lookup (same as the old tracker-bridge.js) ─────
const dictPath = path.join(ROOT, 'loading_zone_dictionary.json');
const dict = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
const stageToNode = new Map();
// Seed ambiguous stages with their documented first-listed candidate first -
// the general zones loop below's "if (!has(...))" then skips them, instead
// of whichever candidate happened to appear first in dict.zones winning by
// accident (that used to silently contradict the log line right below).
if (dict._meta && dict._meta.ambiguous_stages) {
  for (const [stageName, nodes] of Object.entries(dict._meta.ambiguous_stages)) {
    if (nodes && nodes.length) stageToNode.set(stageName, nodes[0]);
  }
}
for (const zone of dict.zones) {
  if (!stageToNode.has(zone.loading_zone_name)) {
    stageToNode.set(zone.loading_zone_name, zone.map_node);
  }
}
console.log(`Loaded ${stageToNode.size} stage-name -> map_node mappings`);
if (dict._meta && dict._meta.ambiguous_stages) {
  const ambiguous = Object.keys(dict._meta.ambiguous_stages);
  console.log(`${ambiguous.length} ambiguous stage name(s) resolved to their first listed candidate: ${ambiguous.join(', ')}`);
}

function resolveStage(stageName) {
  return stageToNode.get(stageName) || null;
}

// ── Static file serving ────────────────────────────────────────────────
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res) {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/map.html';

  // Resolve against ROOT and reject anything that escapes it (basic
  // directory-traversal guard - this is LAN dev tooling, not hardened for
  // hostile input, but there's no reason to skip the one-line check).
  const filePath = path.normalize(path.join(ROOT, reqPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// ── Room relay (identical protocol/behavior to server.js) ─────────────
const rooms = new Map();

function getRoom(code) {
  if (!rooms.has(code)) rooms.set(code, { state: null, sockets: new Set() });
  return rooms.get(code);
}

function broadcast(roomCode, message, excludeSocket) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const data = JSON.stringify(message);
  for (const socket of room.sockets) {
    if (socket === excludeSocket) continue;
    if (socket.readyState === 1 /* OPEN */) socket.send(data);
  }
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  serveStatic(req, res);
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (socket, req) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`[+] Browser client connected from ${clientIp} | total connections: ${wss.clients.size}`);

  let roomCode = null;

  socket.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) {
      socket.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'join' && typeof msg.room === 'string' && msg.room.length > 0) {
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
      console.log(`[→] Browser client joined room ${roomCode} | clients in room: ${room.sockets.size}`);
      socket.send(JSON.stringify({ type: 'joined', room: roomCode }));
      if (room.state) socket.send(JSON.stringify({ type: 'state', room: roomCode, data: room.state }));
      return;
    }

    if (msg.type === 'state' && roomCode && msg.room === roomCode && msg.data) {
      const room = getRoom(roomCode);
      room.state = msg.data;
      broadcast(roomCode, { type: 'state', room: roomCode, data: msg.data }, socket);
      return;
    }

    if (msg.type === 'liveEvent' && roomCode && msg.room === roomCode && msg.data) {
      broadcast(roomCode, { type: 'liveEvent', room: roomCode, data: msg.data }, socket);
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

  socket.on('error', (err) => console.error('[!] WebSocket error:', err.message));
});

function sendLiveEvent(roomCode, src, tgt) {
  broadcast(roomCode, { type: 'liveEvent', room: roomCode, data: { src, sPart: 'out', tgt, tPart: 'in' } });
}

// ── Switch listener ─────────────────────────────────────────────────────
// One TCP connection per Switch session. Each connection tracks its own
// lastKnownNode and room code independently, so this single server instance
// can serve multiple simultaneous testers (each in their own room) without a
// restart - the room code now comes from the mod itself (entered in-game via
// the on-screen keyboard) rather than a server-launch CLI argument.
const switchServer = net.createServer((conn) => {
  console.log(`Switch connected from ${conn.remoteAddress}`);
  let buf = '';
  let lastKnownNode = null;

  conn.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    let idx;
    while ((idx = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (!line) continue;

      let event;
      try { event = JSON.parse(line); } catch (e) {
        console.warn('Ignoring malformed line from Switch:', line);
        continue;
      }

      const roomCode = event.room;
      if (!roomCode) {
        console.warn('Ignoring event with no room code (mod not configured yet?):', line);
        continue;
      }

      const resolvedSrc = resolveStage(event.from);
      const resolvedTgt = resolveStage(event.to);
      const effectiveSrc = resolvedSrc || lastKnownNode;

      console.log(
        `[${roomCode}] ${event.from} -> ${event.to}  (exit=${event.exitId || '?'}, arrivalDoorId=${event.debugArrivalDoorId || '?'})  =>  ` +
        `${resolvedSrc || (effectiveSrc ? `(bridged from ${effectiveSrc})` : '?')} -> ${resolvedTgt || '?'}`
      );

      if (resolvedSrc) lastKnownNode = resolvedSrc;

      if (!effectiveSrc || !resolvedTgt) {
        console.warn(`Could not resolve one or both stage names - skipping (from="${event.from}" to="${event.to}")`);
        continue;
      }

      sendLiveEvent(roomCode, effectiveSrc, resolvedTgt);
      lastKnownNode = resolvedTgt;
    }
  });

  conn.on('close', () => console.log('Switch disconnected'));
  conn.on('error', (err) => console.error('Switch socket error:', err.message));
});

switchServer.listen(SWITCH_PORT, '0.0.0.0', () => {
  console.log(`Listening for the Switch on port ${SWITCH_PORT}`);
});

server.listen(HTTP_PORT, () => {
  console.log(`Tracker + relay listening on http://localhost:${HTTP_PORT}  (map.html, WebSocket /ws)`);
  console.log(`Open http://localhost:${HTTP_PORT}/map.html and enter a room code in the Live Tracking panel.`);
});
