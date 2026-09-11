'use strict';

// Live auto-tracking bridge (Phase 2). Sits between the Switch's raw TrackerBridge socket
// (plain newline-delimited JSON: {"exitId", "from", "to"}, "from"/"to" being internal stage
// names) and this tracker's own room relay (server.js). Does the stage-name -> map_node
// resolution here, with direct filesystem access to loading_zone_dictionary.json, so the
// browser side (map.html) only ever has to call connect() with values it already understands.
//
// Usage: node tracker-bridge.js <roomCode> [switchListenPort] [relayWsUrl]

const net = require('net');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const roomCode = process.argv[2];
if (!roomCode) {
  console.error('Usage: node tracker-bridge.js <roomCode> [switchListenPort] [relayWsUrl]');
  process.exit(1);
}
const switchListenPort = parseInt(process.argv[3] || '8173', 10);
const relayWsUrl = process.argv[4] || 'ws://localhost:3000/ws';

// ── Stage name -> map_node lookup ──────────────────────────────────────
// Ambiguous stage names (a handful, listed in _meta.ambiguous_stages) map to more than one
// map_node depending on subarea context the randomizer tracks internally that we don't have
// access to here - first listed candidate is used as a documented, imperfect fallback.
const dictPath = path.join(__dirname, 'loading_zone_dictionary.json');
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

// ── Relay connection (this tracker's own room, same as OBS sync) ──────
let relaySocket = null;
let relayReady = false;

function connectRelay() {
  relaySocket = new WebSocket(relayWsUrl);
  relaySocket.on('open', () => {
    relaySocket.send(JSON.stringify({ type: 'join', room: roomCode }));
  });
  relaySocket.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    if (msg.type === 'joined' && msg.room === roomCode) {
      relayReady = true;
      console.log(`Joined relay room "${roomCode}" at ${relayWsUrl}`);
    }
  });
  relaySocket.on('close', () => {
    relayReady = false;
    console.log('Relay connection closed, retrying in 3s...');
    setTimeout(connectRelay, 3000);
  });
  relaySocket.on('error', (err) => {
    console.error('Relay connection error:', err.message);
  });
}
connectRelay();

function sendLiveEvent(src, tgt) {
  if (!relayReady) {
    console.warn('Relay not connected yet - dropping event');
    return;
  }
  relaySocket.send(JSON.stringify({
    type: 'liveEvent',
    room: roomCode,
    data: { src, sPart: 'out', tgt, tPart: 'in' },
  }));
}

// ── Switch listener (same protocol as tracker_bridge_listener.py) ─────
//
// lastKnownNode bridges over stages with no map_node at all (e.g. a boss re-fight's painting
// room, which is deliberately untracked - see tracker discussion) - if the "from" side of a
// transition doesn't resolve, we fall back to the last node we DID successfully resolve, so
// e.g. "Precision Rolling -> painting room" followed by "painting room -> Dragon" still draws
// a single "Precision Rolling -> Dragon" edge instead of silently dropping both.
let lastKnownNode = null;

const server = net.createServer((conn) => {
  console.log(`Switch connected from ${conn.remoteAddress}`);
  let buf = '';

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

      const resolvedSrc = resolveStage(event.from);
      const resolvedTgt = resolveStage(event.to);
      const effectiveSrc = resolvedSrc || lastKnownNode;

      console.log(
        `${event.from} -> ${event.to}  (exit=${event.exitId || '?'}, arrivalDoorId=${event.debugArrivalDoorId || '?'})  =>  ` +
        `${resolvedSrc || (effectiveSrc ? `(bridged from ${effectiveSrc})` : '?')} -> ${resolvedTgt || '?'}`
      );

      if (resolvedSrc) lastKnownNode = resolvedSrc;

      if (!effectiveSrc || !resolvedTgt) {
        console.warn(`Could not resolve one or both stage names - skipping (from="${event.from}" to="${event.to}")`);
        continue;
      }

      sendLiveEvent(effectiveSrc, resolvedTgt);
      lastKnownNode = resolvedTgt;
    }
  });

  conn.on('close', () => console.log('Switch disconnected'));
  conn.on('error', (err) => console.error('Switch socket error:', err.message));
});

server.listen(switchListenPort, '0.0.0.0', () => {
  console.log(`Listening for the Switch on port ${switchListenPort}`);
});
