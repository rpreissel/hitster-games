import { getRandomGames, getAllGames } from './bggService.js';
import { loadRooms, debouncedSaveRooms, cleanupOldRooms } from './persistence.js';

// Spielraum-Management - Räume aus Datei laden beim Start
const rooms = loadRooms();

// Alte Räume beim Start aufräumen und periodisch (alle 30 Minuten)
cleanupOldRooms(rooms);
setInterval(() => cleanupOldRooms(rooms), 30 * 60 * 1000);

// Helper: Aktivität aktualisieren und speichern
function updateRoomActivity(room) {
  room.lastActivity = Date.now();
  debouncedSaveRooms(rooms);
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createRoom(hostPlayer) {
  let code = generateRoomCode();
  while (rooms.has(code)) {
    code = generateRoomCode();
  }
  
  const room = {
    code,
    host: hostPlayer.id,
    players: [hostPlayer],
    gameState: 'lobby', // lobby, playing, finished
    currentPlayerIndex: 0,
    deck: [], // Stapel mit noch nicht gezogenen Spielen
    currentGame: null, // Aktuell zu ratendes Spiel
    winCondition: 10,
    settings: {
      winCondition: 10
    },
    lastActivity: Date.now()
  };
  
  rooms.set(code, room);
  debouncedSaveRooms(rooms);
  return room;
}

export function joinRoom(code, player) {
  const room = rooms.get(code.toUpperCase());
  if (!room) {
    return { error: 'Raum nicht gefunden' };
  }
  if (room.gameState !== 'lobby') {
    return { error: 'Spiel läuft bereits' };
  }
  if (room.players.length >= 8) {
    return { error: 'Raum ist voll (max. 8 Spieler)' };
  }
  if (room.players.find(p => p.id === player.id)) {
    return { error: 'Du bist bereits im Raum' };
  }
  
  room.players.push(player);
  updateRoomActivity(room);
  return { room };
}

export function leaveRoom(code, playerId) {
  const room = rooms.get(code);
  if (!room) return null;
  
  room.players = room.players.filter(p => p.id !== playerId);
  
  if (room.players.length === 0) {
    rooms.delete(code);
    debouncedSaveRooms(rooms);
    return null;
  }
  
  // Neuen Host wählen wenn der Host geht
  if (room.host === playerId) {
    room.host = room.players[0].id;
  }
  
  // Aktuellen Spieler anpassen wenn nötig
  if (room.currentPlayerIndex >= room.players.length) {
    room.currentPlayerIndex = 0;
  }
  
  updateRoomActivity(room);
  return room;
}

export async function startGame(code) {
  const room = rooms.get(code);
  if (!room) return { error: 'Raum nicht gefunden' };
  if (room.players.length < 2) return { error: 'Mindestens 2 Spieler benötigt' };
  
  // Spiele laden
  const games = await getAllGames();
  if (games.length < 30) {
    return { error: 'Nicht genug Spiele geladen. Bitte warten...' };
  }
  
  // Deck mischen
  room.deck = shuffleArray(games);
  room.gameState = 'playing';
  room.currentPlayerIndex = 0;
  
  // Jedem Spieler Punkte und Timeline initialisieren
  room.players.forEach(player => {
    player.score = 0;
    player.timeline = [];
    // Erstes Spiel für jeden Spieler
    const firstGame = room.deck.pop();
    player.timeline.push({ ...firstGame, revealed: true });
  });
  
  // Erstes Spiel ziehen
  room.currentGame = room.deck.pop();
  
  updateRoomActivity(room);
  return { room };
}

export function getCurrentPlayer(room) {
  return room.players[room.currentPlayerIndex];
}

export function placeGame(code, playerId, position) {
  const room = rooms.get(code);
  if (!room) return { error: 'Raum nicht gefunden' };
  if (room.gameState !== 'playing') return { error: 'Spiel läuft nicht' };
  
  const currentPlayer = getCurrentPlayer(room);
  if (currentPlayer.id !== playerId) {
    return { error: 'Du bist nicht dran' };
  }
  
  const game = room.currentGame;
  if (!game) return { error: 'Kein aktuelles Spiel' };
  
  const player = room.players.find(p => p.id === playerId);
  const timeline = player.timeline;
  
  // Position validieren
  if (position < 0 || position > timeline.length) {
    return { error: 'Ungültige Position' };
  }
  
  // Prüfen ob die Platzierung korrekt ist
  let isCorrect = true;
  
  // Spiel links von der Position (muss älter oder gleich sein)
  if (position > 0) {
    const leftGame = timeline[position - 1];
    if (leftGame.year > game.year) {
      isCorrect = false;
    }
  }
  
  // Spiel rechts von der Position (muss neuer oder gleich sein)
  if (position < timeline.length) {
    const rightGame = timeline[position];
    if (rightGame.year < game.year) {
      isCorrect = false;
    }
  }
  
  const result = {
    correct: isCorrect,
    game: { ...game, revealed: true },
    position
  };
  
  if (isCorrect) {
    // Spiel in Timeline einfügen
    timeline.splice(position, 0, { ...game, revealed: true });
    player.score++;
    
    // Gewonnen?
    if (player.score >= room.settings.winCondition) {
      room.gameState = 'finished';
      room.winner = player;
      updateRoomActivity(room);
      return { result, room, winner: player };
    }
  }
  
  // Nächstes Spiel ziehen
  if (room.deck.length > 0) {
    room.currentGame = room.deck.pop();
  } else {
    // Deck leer - Spiel beenden, Spieler mit meisten Punkten gewinnt
    room.gameState = 'finished';
    room.winner = room.players.reduce((a, b) => a.score > b.score ? a : b);
    updateRoomActivity(room);
    return { result, room, winner: room.winner };
  }
  
  // Nächster Spieler
  room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
  
  updateRoomActivity(room);
  return { result, room };
}

export function getRoom(code) {
  return rooms.get(code?.toUpperCase());
}

export function getRoomForPlayer(playerId) {
  for (const room of rooms.values()) {
    if (room.players.find(p => p.id === playerId)) {
      return room;
    }
  }
  return null;
}

// Raum-Zustand für Client aufbereiten (ohne sensible Daten)
export function sanitizeRoomForClient(room, forPlayerId = null) {
  if (!room) return null;
  
  return {
    code: room.code,
    host: room.host,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      score: p.score || 0,
      timeline: p.timeline || [],
      isCurrentPlayer: room.gameState === 'playing' && 
        getCurrentPlayer(room)?.id === p.id
    })),
    gameState: room.gameState,
    currentPlayerIndex: room.currentPlayerIndex,
    currentGame: room.currentGame ? {
      id: room.currentGame.id,
      name: room.currentGame.name,
      thumbnail: room.currentGame.thumbnail,
      image: room.currentGame.image,
      // Jahr nur anzeigen wenn das Spiel aufgedeckt wird
      year: null
    } : null,
    deckSize: room.deck?.length || 0,
    winner: room.winner ? {
      id: room.winner.id,
      name: room.winner.name,
      score: room.winner.score
    } : null,
    settings: room.settings
  };
}
