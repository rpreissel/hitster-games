import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import https from 'https';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRandomGames } from './bggService.js';
import {
  createRoom,
  joinRoom,
  leaveRoom,
  startGame,
  placeGame,
  getRoom,
  getRoomForPlayer,
  sanitizeRoomForClient
} from './gameLogic.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// CORS configuration - allow all origins in production (WebSocket handles auth)
const corsOrigins = process.env.NODE_ENV === 'production' 
  ? true  // Allow all origins in production
  : ['http://localhost:5173', 'http://localhost:3000'];

const io = new Server(httpServer, {
  cors: {
    origin: corsOrigins,
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Bild-Proxy für BoardGameGeek Bilder (CORS umgehen)
app.get('/api/image-proxy', (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl || !imageUrl.includes('geekdo-images.com')) {
    return res.status(400).send('Invalid URL');
  }
  
  const fetchImage = (url, redirectCount = 0) => {
    if (redirectCount > 5) {
      return res.status(500).send('Too many redirects');
    }
    
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BoardGameTimeline/1.0)'
      }
    }, (proxyRes) => {
      // Handle redirects
      if (proxyRes.statusCode === 301 || proxyRes.statusCode === 302 || proxyRes.statusCode === 307) {
        const redirectUrl = proxyRes.headers.location;
        if (redirectUrl) {
          return fetchImage(redirectUrl, redirectCount + 1);
        }
      }
      
      if (proxyRes.statusCode !== 200) {
        return res.status(proxyRes.statusCode).send('Image fetch failed');
      }
      
      res.set('Content-Type', proxyRes.headers['content-type'] || 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=86400');
      proxyRes.pipe(res);
    }).on('error', (err) => {
      console.error('Proxy error:', err);
      res.status(500).send('Proxy error');
    });
  };
  
  fetchImage(imageUrl);
});

// Spiele beim Start vorladen
console.log('Preloading board games from BoardGameGeek...');
getRandomGames(50).then(games => {
  console.log(`Preloaded ${games.length} games`);
}).catch(err => {
  console.error('Failed to preload games:', err);
});

// REST Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientPath));
  
  // Handle SPA routing - serve index.html for all non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

// Socket.IO Event Handling
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  
  // Spieler-Daten
  let playerData = {
    id: socket.id,
    name: 'Spieler'
  };
  
  // Name setzen
  socket.on('setName', (name) => {
    playerData.name = name.substring(0, 20);
    socket.emit('nameSet', playerData);
  });
  
  // Raum erstellen
  socket.on('createRoom', () => {
    const room = createRoom(playerData);
    socket.join(room.code);
    socket.emit('roomCreated', sanitizeRoomForClient(room, socket.id));
    console.log(`Room ${room.code} created by ${playerData.name}`);
  });
  
  // Raum beitreten
  socket.on('joinRoom', (code) => {
    const result = joinRoom(code, playerData);
    
    if (result.error) {
      socket.emit('error', result.error);
      return;
    }
    
    socket.join(result.room.code);
    
    // Allen im Raum mitteilen
    io.to(result.room.code).emit('roomUpdated', sanitizeRoomForClient(result.room));
    socket.emit('roomJoined', sanitizeRoomForClient(result.room, socket.id));
    console.log(`${playerData.name} joined room ${result.room.code}`);
  });
  
  // Raum verlassen
  socket.on('leaveRoom', () => {
    const room = getRoomForPlayer(socket.id);
    if (room) {
      socket.leave(room.code);
      const updatedRoom = leaveRoom(room.code, socket.id);
      if (updatedRoom) {
        io.to(room.code).emit('roomUpdated', sanitizeRoomForClient(updatedRoom));
      }
      socket.emit('leftRoom');
    }
  });
  
  // Spiel starten
  socket.on('startGame', async () => {
    const room = getRoomForPlayer(socket.id);
    if (!room) {
      socket.emit('error', 'Du bist in keinem Raum');
      return;
    }
    if (room.host !== socket.id) {
      socket.emit('error', 'Nur der Host kann das Spiel starten');
      return;
    }
    
    const result = await startGame(room.code);
    if (result.error) {
      socket.emit('error', result.error);
      return;
    }
    
    io.to(room.code).emit('gameStarted', sanitizeRoomForClient(result.room));
    console.log(`Game started in room ${room.code}`);
  });
  
  // Spiel platzieren
  socket.on('placeGame', (position) => {
    const room = getRoomForPlayer(socket.id);
    if (!room) {
      socket.emit('error', 'Du bist in keinem Raum');
      return;
    }
    
    const result = placeGame(room.code, socket.id, position);
    
    if (result.error) {
      socket.emit('error', result.error);
      return;
    }
    
    // Ergebnis an alle senden
    io.to(room.code).emit('gamePlaced', {
      playerId: socket.id,
      playerName: playerData.name,
      result: result.result,
      room: sanitizeRoomForClient(result.room)
    });
    
    if (result.winner) {
      io.to(room.code).emit('gameEnded', {
        winner: result.winner,
        room: sanitizeRoomForClient(result.room)
      });
      console.log(`Game ended in room ${room.code}. Winner: ${result.winner.name}`);
    }
  });
  
  // Einstellungen ändern
  socket.on('updateSettings', (settings) => {
    const room = getRoomForPlayer(socket.id);
    if (!room || room.host !== socket.id) return;
    
    if (settings.winCondition) {
      room.settings.winCondition = Math.min(20, Math.max(5, settings.winCondition));
    }
    
    io.to(room.code).emit('roomUpdated', sanitizeRoomForClient(room));
  });
  
  // Neues Spiel (Rematch)
  socket.on('rematch', async () => {
    const room = getRoomForPlayer(socket.id);
    if (!room) return;
    
    room.gameState = 'lobby';
    room.winner = null;
    room.players.forEach(p => {
      p.score = 0;
      p.timeline = [];
    });
    
    io.to(room.code).emit('roomUpdated', sanitizeRoomForClient(room));
  });
  
  // Disconnect
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    const room = getRoomForPlayer(socket.id);
    if (room) {
      const updatedRoom = leaveRoom(room.code, socket.id);
      if (updatedRoom) {
        io.to(room.code).emit('roomUpdated', sanitizeRoomForClient(updatedRoom));
        io.to(room.code).emit('playerLeft', { playerId: socket.id, playerName: playerData.name });
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
