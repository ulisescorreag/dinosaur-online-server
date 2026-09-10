const http = require('http');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT || 10000);
const MAX_PLAYERS_PER_ROOM = 15;
const rooms = new Map();
const sockets = new Map();

function cleanText(value, max) {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max);
}

function roomKey(value) {
  return cleanText(value, 24).toLowerCase() || 'jungla';
}

function spawnFor(index) {
  // Jugadores nuevos aparecen en un círculo pequeño alrededor del centro de la sala.
  const radius = 55 + Math.min(index, 14) * 8;
  const angle = (index * Math.PI * 2) / MAX_PLAYERS_PER_ROOM;
  return {
    x: Math.cos(angle) * radius + (Math.random() - 0.5) * 12,
    z: Math.sin(angle) * radius + (Math.random() - 0.5) * 12,
  };
}

function publicPlayer(p) {
  return {
    id: p.id,
    name: p.name,
    dino: p.dino,
    x: p.x,
    z: p.z,
    rotY: p.rotY,
    level: p.level,
    hp: p.hp,
    score: p.score,
  };
}

function send(ws, payload) {
  if (ws.readyState === 1) ws.send(JSON.stringify(payload));
}

function broadcastRoom(room) {
  const players = [...room.players.values()].map(publicPlayer);
  for (const p of room.players.values()) send(p.ws, { type: 'state', room: room.name, players });
}

function leave(ws) {
  const state = sockets.get(ws);
  if (!state) return;
  const room = rooms.get(state.roomKey);
  if (room) {
    room.players.delete(state.id);
    broadcastRoom(room);
    if (room.players.size === 0) rooms.delete(state.roomKey);
  }
  sockets.delete(ws);
}

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    const players = [...rooms.values()].reduce((sum, room) => sum + room.players.size, 0);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, players, maxPerRoom: MAX_PLAYERS_PER_ROOM }));
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  const state = {
    ws,
    id: crypto.randomUUID(),
    roomKey: null,
    name: 'RexMaster',
    roomName: 'Jungla',
    dino: 0,
    x: 0,
    z: 0,
    rotY: 0,
    level: 1,
    hp: 100,
    score: 0,
    joined: false,
  };
  sockets.set(ws, state);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'join' && !state.joined) {
      state.name = cleanText(msg.name, 15) || 'RexMaster';
      state.roomName = cleanText(msg.room, 24) || 'Jungla';
      state.roomKey = roomKey(state.roomName);
      state.dino = Math.max(0, Math.min(3, Number(msg.dino) || 0));

      let room = rooms.get(state.roomKey);
      if (!room) {
        room = { name: state.roomName, players: new Map() };
        rooms.set(state.roomKey, room);
      }
      if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
        send(ws, { type: 'error', message: 'La sala está llena (15/15).' });
        ws.close(1008, 'Room full');
        return;
      }

      const spawn = spawnFor(room.players.size);
      state.x = spawn.x;
      state.z = spawn.z;
      state.joined = true;
      room.players.set(state.id, state);
      sockets.set(ws, state);
      send(ws, { type: 'welcome', id: state.id, room: room.name, count: room.players.size, spawn });
      broadcastRoom(room);
      return;
    }

    if (!state.joined) return;

    if (msg.type === 'state') {
      state.name = cleanText(msg.name, 15) || state.name;
      state.dino = Math.max(0, Math.min(3, Number(msg.dino) || 0));
      state.x = Math.max(-1600, Math.min(1600, Number(msg.x) || 0));
      state.z = Math.max(-1600, Math.min(1600, Number(msg.z) || 0));
      state.rotY = Number.isFinite(Number(msg.rotY)) ? Number(msg.rotY) : state.rotY;
      state.level = Math.max(1, Math.min(100, Number(msg.level) || 1));
      state.hp = Math.max(0, Math.min(10000, Number(msg.hp) || 0));
      state.score = Math.max(0, Math.min(1000000000, Number(msg.score) || 0));
    }
  });

  ws.on('close', () => leave(ws));
  ws.on('error', () => leave(ws));
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

wss.on('connection', ws => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
});

// Sincronización de estados a 10 Hz: suficiente para movimiento suave con interpolación en el cliente.
setInterval(() => {
  for (const room of rooms.values()) broadcastRoom(room);
}, 100);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Dinosaur.io WebSocket server listening on port ${PORT}`);
});
