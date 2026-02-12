// ============================================================
// POKEMON TCG - WebSocket Multiplayer Server
// ============================================================
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const path = require('path');
const crypto = require('crypto');
const engine = require('./game-engine');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from parent directory
app.use(express.static(path.join(__dirname, '..')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ============================================================
// ROOM MANAGEMENT
// ============================================================
const rooms = new Map(); // code -> { game, players, tokens, createdAt, lastActivity }

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (rooms.has(code));
  return code;
}

function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

// Clean up old rooms every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > 2 * 60 * 60 * 1000) { // 2 hours
      console.log(`Cleaning up room ${code}`);
      room.players.forEach(p => {
        if (p && p.ws && p.ws.readyState === 1) {
          p.ws.close(1000, 'Room expired');
        }
      });
      rooms.delete(code);
    }
  }
}, 10 * 60 * 1000);

// ============================================================
// SEND HELPERS
// ============================================================
function send(ws, msg) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcastState(room) {
  const game = room.game;
  const events = game.events || [];
  game.events = [];

  for (let pNum = 1; pNum <= 2; pNum++) {
    const player = room.players[pNum];
    if (!player || !player.ws) continue;
    const state = engine.filterStateForPlayer(game, pNum);
    // Include copied attacks info for the current player
    if (game.currentPlayer === pNum && game.phase === 'battle') {
      state.copiedAttacks = engine.getCopiedAttacks(game);
    }
    send(player.ws, {
      type: 'gameState',
      state: state,
      events: events,
    });
  }
}

function broadcastPhaseState(room) {
  const game = room.game;
  for (let pNum = 1; pNum <= 2; pNum++) {
    const player = room.players[pNum];
    if (!player || !player.ws) continue;
    const state = engine.filterStateForPlayer(game, pNum);
    send(player.ws, {
      type: 'gameState',
      state: state,
      events: [],
    });
  }
}

// ============================================================
// MESSAGE HANDLING
// ============================================================
function handleMessage(ws, data) {
  let msg;
  try {
    msg = JSON.parse(data);
  } catch (e) {
    send(ws, { type: 'error', message: 'Invalid JSON' });
    return;
  }

  switch (msg.type) {
    case 'createRoom': return handleCreateRoom(ws, msg);
    case 'joinRoom': return handleJoinRoom(ws, msg);
    case 'reconnect': return handleReconnect(ws, msg);
    case 'confirmDeck': return handleConfirmDeck(ws, msg);
    case 'setupChoice': return handleSetupChoice(ws, msg);
    case 'action': return handleAction(ws, msg);
    case 'ping': return send(ws, { type: 'pong' });
    default:
      send(ws, { type: 'error', message: 'Unknown message type: ' + msg.type });
  }
}

function handleCreateRoom(ws, msg) {
  const code = generateRoomCode();
  const game = engine.createGame();
  const name = (msg.name || 'Player 1').substring(0, 20);
  game.players[1].name = name;

  const token = generateToken();
  const room = {
    game,
    players: {
      1: { ws, name, token, connected: true },
      2: null,
    },
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };
  rooms.set(code, room);
  ws._roomCode = code;
  ws._playerNum = 1;

  console.log(`Room ${code} created by ${name}`);
  send(ws, { type: 'roomCreated', code, playerNum: 1, token });
}

function handleJoinRoom(ws, msg) {
  const code = (msg.code || '').toUpperCase().trim();
  const room = rooms.get(code);
  if (!room) {
    send(ws, { type: 'error', message: 'Room not found: ' + code });
    return;
  }
  if (room.players[2] && room.players[2].connected) {
    send(ws, { type: 'error', message: 'Room is full' });
    return;
  }

  const name = (msg.name || 'Player 2').substring(0, 20);
  const token = generateToken();
  room.game.players[2].name = name;
  room.players[2] = { ws, name, token, connected: true };
  room.lastActivity = Date.now();
  ws._roomCode = code;
  ws._playerNum = 2;

  console.log(`${name} joined room ${code}`);

  send(ws, { type: 'joined', playerNum: 2, token, oppName: room.players[1].name });
  send(room.players[1].ws, { type: 'oppJoined', oppName: name });

  // Send initial game state to both
  broadcastPhaseState(room);
}

function handleReconnect(ws, msg) {
  const code = (msg.code || '').toUpperCase().trim();
  const token = msg.token;
  const room = rooms.get(code);
  if (!room) {
    send(ws, { type: 'error', message: 'Room not found' });
    return;
  }

  let playerNum = null;
  for (let pNum = 1; pNum <= 2; pNum++) {
    if (room.players[pNum] && room.players[pNum].token === token) {
      playerNum = pNum;
      break;
    }
  }
  if (!playerNum) {
    send(ws, { type: 'error', message: 'Invalid reconnect token' });
    return;
  }

  room.players[playerNum].ws = ws;
  room.players[playerNum].connected = true;
  room.lastActivity = Date.now();
  ws._roomCode = code;
  ws._playerNum = playerNum;

  console.log(`Player ${playerNum} reconnected to room ${code}`);

  send(ws, { type: 'reconnected', playerNum, oppName: room.players[engine.oppPlayer(playerNum)]?.name || '' });

  // Notify opponent
  const oppNum = engine.oppPlayer(playerNum);
  if (room.players[oppNum] && room.players[oppNum].ws) {
    send(room.players[oppNum].ws, { type: 'oppReconnected' });
  }

  // Re-send current state
  const state = engine.filterStateForPlayer(room.game, playerNum);
  if (room.game.phase === 'battle' && room.game.currentPlayer === playerNum) {
    state.copiedAttacks = engine.getCopiedAttacks(room.game);
  }
  send(ws, { type: 'gameState', state, events: [] });
}

function handleConfirmDeck(ws, msg) {
  const room = getRoom(ws);
  if (!room) return;
  const playerNum = ws._playerNum;

  room.lastActivity = Date.now();
  room.game.events = [];
  const prevPhase = room.game.phase;
  const ok = engine.processDeckConfirm(room.game, playerNum, msg.deck || []);
  if (!ok) {
    send(ws, { type: 'error', message: 'Invalid deck' });
    return;
  }

  send(ws, { type: 'deckConfirmed' });

  // Notify opponent they're waiting (if not both ready)
  if (room.game.phase === prevPhase) {
    const oppNum = engine.oppPlayer(playerNum);
    if (room.players[oppNum] && room.players[oppNum].ws) {
      send(room.players[oppNum].ws, { type: 'oppDeckConfirmed' });
    }
  } else {
    // Both confirmed, phase changed
    broadcastPhaseState(room);
  }
}

function handleSetupChoice(ws, msg) {
  const room = getRoom(ws);
  if (!room) return;
  const playerNum = ws._playerNum;

  room.lastActivity = Date.now();
  room.game.events = [];
  const prevPhase = room.game.phase;
  const ok = engine.processSetupChoice(room.game, playerNum, msg.choices || []);
  if (!ok) {
    send(ws, { type: 'error', message: 'Invalid setup choice' });
    return;
  }

  send(ws, { type: 'setupConfirmed' });
  const oppNum = engine.oppPlayer(playerNum);
  if (room.players[oppNum] && room.players[oppNum].ws) {
    if (room.game.players[playerNum].ready && !room.game.players[oppNum].ready) {
      send(room.players[oppNum].ws, { type: 'oppSetupConfirmed' });
    }
  }

  // If phase changed (both ready), broadcast new state
  if (room.game.phase === 'battle' || room.game.phase !== prevPhase) {
    broadcastState(room);
  }
}

function handleAction(ws, msg) {
  const room = getRoom(ws);
  if (!room) return;
  const playerNum = ws._playerNum;

  if (room.game.phase !== 'battle') {
    send(ws, { type: 'error', message: 'Game not in battle phase' });
    return;
  }

  room.lastActivity = Date.now();
  room.game.events = [];

  const action = msg.action || msg;
  delete action.type; // Remove 'action' wrapper type
  action.type = msg.actionType || action.actionType;
  if (!action.type) {
    send(ws, { type: 'error', message: 'Missing action type' });
    return;
  }

  const ok = engine.processAction(room.game, playerNum, action);
  if (!ok) {
    send(ws, { type: 'error', message: 'Invalid action' });
    return;
  }

  broadcastState(room);
}

function getRoom(ws) {
  const code = ws._roomCode;
  if (!code) {
    send(ws, { type: 'error', message: 'Not in a room' });
    return null;
  }
  const room = rooms.get(code);
  if (!room) {
    send(ws, { type: 'error', message: 'Room no longer exists' });
    return null;
  }
  return room;
}

// ============================================================
// WEBSOCKET CONNECTION
// ============================================================
wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (data) => {
    try {
      handleMessage(ws, data.toString());
    } catch (e) {
      console.error('Error handling message:', e);
      send(ws, { type: 'error', message: 'Server error' });
    }
  });

  ws.on('close', () => {
    const code = ws._roomCode;
    const playerNum = ws._playerNum;
    if (!code || !playerNum) return;

    const room = rooms.get(code);
    if (!room) return;

    const player = room.players[playerNum];
    if (player) {
      player.connected = false;
      console.log(`Player ${playerNum} disconnected from room ${code}`);

      // Notify opponent
      const oppNum = engine.oppPlayer(playerNum);
      if (room.players[oppNum] && room.players[oppNum].ws) {
        send(room.players[oppNum].ws, { type: 'oppDisconnected' });
      }

      // Set disconnect timeout (5 minutes)
      setTimeout(() => {
        if (room.players[playerNum] && !room.players[playerNum].connected) {
          console.log(`Player ${playerNum} timed out in room ${code}`);
          // Clean up room if both disconnected
          const allDisconnected = [1, 2].every(n => !room.players[n] || !room.players[n].connected);
          if (allDisconnected) {
            rooms.delete(code);
            console.log(`Room ${code} cleaned up (all disconnected)`);
          }
        }
      }, 5 * 60 * 1000);
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });
});

// ============================================================
// START SERVER
// ============================================================
server.listen(PORT, () => {
  console.log(`Pokemon TCG Server running on http://localhost:${PORT}`);
});
