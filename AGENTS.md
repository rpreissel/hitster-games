# Board Game Timeline - Agent Guidelines

This is a **multiplayer board game** (Hitster-style) where players guess board game release years. It's a full-stack monorepo with React 19 + Vite client and Express + Socket.IO server, deployed on Fly.io.

## Project Structure

```
/
├── client/               # React 19 + Vite SPA
│   ├── src/
│   │   ├── App.jsx      # Main component (458 lines, all components here)
│   │   ├── App.css      # All styles (598 lines)
│   │   └── socket.js    # Socket.IO client setup
│   └── vite.config.js
├── server/              # Express + Socket.IO backend
│   ├── src/
│   │   ├── index.js        # Server entry, Socket.IO handlers
│   │   ├── gameLogic.js    # Game state management
│   │   ├── bggService.js   # BoardGameGeek API integration
│   │   └── persistence.js  # File-based persistence
│   └── package.json
└── package.json         # Root workspace config
```

## Build/Run Commands

### Development
```bash
npm run dev              # Run both server + client concurrently
npm run dev:server       # Server only (auto-restart with --watch)
npm run dev:client       # Client only (Vite dev server)
```

### Production
```bash
npm run build            # Build client for production
npm start                # Start production server
```

### Linting
```bash
npm run lint --workspace=client   # ESLint client code
```

### Testing
**No tests exist.** When adding tests:
- Client: Use Vitest (matches Vite ecosystem)
- Server: Use Node.js native test runner or Vitest
- Add scripts: `"test": "vitest"` and `"test:single": "vitest run <file>"`

### Deployment
```bash
flyctl deploy            # Deploy to Fly.io
flyctl logs -a boardgame-timeline --no-tail  # View logs
```

## Code Style Guidelines

### Language & Modules
- **Pure JavaScript** (no TypeScript)
- **ES Modules** everywhere (`"type": "module"` in all package.json)
- **File extensions required** in imports: `.js` for server, `.jsx` for React components

### Import Style

**Client (React):**
```javascript
import React, { useState, useEffect, useCallback } from 'react';
import App from './App.jsx';           // .jsx extension required
import { socket } from './socket';      // Local modules
import './App.css';                     // CSS imports
```

**Server (Node.js):**
```javascript
import express from 'express';
import { createRoom } from './gameLogic.js';  // .js extension required
import path from 'path';                       // Node built-ins
```

### Formatting
- **Semicolons:** Always use
- **Quotes:** Single quotes (`'text'`), except JSX attributes
- **Indentation:** 2 spaces
- **Trailing commas:** Do NOT use in objects/arrays
- **Max line length:** No strict limit, but keep readable

### Naming Conventions

**Variables & Functions:**
```javascript
const CACHE_DURATION = 1000 * 60 * 60;  // SCREAMING_SNAKE_CASE for constants
const roomCode = 'ABC123';               // camelCase for variables
function generateRoomCode() {}           // camelCase for functions
function handleSubmit() {}               // Event handlers: handle* prefix
async function startGame() {}            // Async functions: regular camelCase
```

**React Specific:**
```javascript
function GameCard({ game, showYear = false }) {}  // PascalCase components
const handleSetName = useCallback(() => {}, []);  // Callbacks: handle* prefix
<Button onClick={onPlaceGame} />                  // Props: on* prefix
```

**Files:**
- React components: `App.jsx` (PascalCase with .jsx)
- Utilities/services: `socket.js`, `gameLogic.js` (camelCase with .js)

### React Patterns

**Component Structure:**
- All components currently in single `App.jsx` file
- When splitting, use named exports for sub-components
- Keep components functional (no classes)
- Use hooks (`useState`, `useEffect`, `useCallback`)

**State Management:**
```javascript
// Screen-based state machine
const [screen, setScreen] = useState('name');  // 'name' | 'menu' | 'lobby' | 'game' | 'winner'

// Wrap handlers in useCallback
const handleSetName = useCallback((name) => {
  setPlayerName(name);
  socket.emit('setName', name);
}, []);
```

**Conditional Rendering:**
```javascript
{screen === 'game' && <GameScreen room={room} />}
{isMyTurn && <p className="hint">Your turn!</p>}
{imageUrl && !imgError ? <img src={imageUrl} /> : <FallbackIcon />}
```

**Effects & Cleanup:**
```javascript
useEffect(() => {
  socket.on('roomCreated', handleRoomCreated);
  return () => {
    socket.off('roomCreated', handleRoomCreated);
  };
}, [handleRoomCreated]);
```

### Server Patterns

**Module Exports:**
```javascript
// Export public API
export function createRoom(hostPlayer) {}
export async function startGame(code) {}

// Private helpers (not exported)
function generateRoomCode() {}
function shuffleArray(array) {}
```

**Data Validation:**
```javascript
export function joinRoom(code, player) {
  const room = rooms.get(code.toUpperCase());
  if (!room) {
    return { error: 'Raum nicht gefunden' };
  }
  if (room.gameState !== 'lobby') {
    return { error: 'Spiel läuft bereits' };
  }
  // ... continue logic
  return { room };
}
```

**State Management:**
- Use `Map` for in-memory collections (not plain objects)
- Call `debouncedSaveRooms(rooms)` after mutations
- Update `lastActivity` timestamp on room changes

### Error Handling

**Client-Side:**
```javascript
// User feedback via state
const [error, setError] = useState('');
socket.on('error', (msg) => {
  setError(msg);
  setTimeout(() => setError(''), 3000);
});

// Image fallbacks
<img onError={() => setImgError(true)} />
```

**Server-Side:**
```javascript
// Try-catch for external APIs
try {
  const response = await fetch(url);
  return await response.json();
} catch (error) {
  console.error('Error fetching data:', error.message);
  return null;
}

// Validation with error objects
if (!room) {
  return { error: 'Room not found' };
}

// Socket error emission
if (result.error) {
  socket.emit('error', result.error);
  return;
}
```

### Socket.IO Conventions

**Event Naming:**
- Client → Server: camelCase verbs (`setName`, `createRoom`, `joinRoom`, `placeGame`)
- Server → Client: past tense (`roomCreated`, `roomJoined`, `gameStarted`, `roomUpdated`)
- Errors: `error` event with string message

**Data Sanitization:**
Always use `sanitizeRoomForClient()` before sending room data to clients to hide sensitive information (like unrevealed game years).

### CSS Conventions
- **No CSS-in-JS**, use plain CSS files
- **BEM-like naming:** `.game-card`, `.timeline-slot`, `.player-list`
- **CSS custom properties** for theming in `:root`
- **Mobile-first** responsive design

### Environment Variables

**Client (Vite):**
```javascript
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 
  (import.meta.env.PROD ? window.location.origin : 'http://localhost:3001');
```

**Server:**
```javascript
const PORT = process.env.PORT || 3001;
const DATA_DIR = process.env.DATA_DIR || './data';
```

## Language & Text
- **UI/User-facing text:** German (error messages, labels, hints)
- **Code:** English (variables, functions, comments)
- **Comments:** Mix acceptable, prefer English for technical details

## Dependencies & Constraints

### DO NOT Add Without Discussion:
- TypeScript (project is intentionally vanilla JS)
- State management libraries (Redux, Zustand, etc.)
- UI frameworks (Material-UI, Chakra, etc.)
- Routing libraries (React Router - single-page design)
- Databases (uses file-based persistence)
- Authentication libraries (not needed yet)

### Acceptable to Add:
- Testing frameworks (Vitest recommended)
- Utility libraries (lodash, date-fns if needed)
- Development tools (Prettier, additional ESLint rules)

## Persistence & Data
- Room state stored in-memory `Map` + file persistence (`/app/data/rooms.json`)
- Use `debouncedSaveRooms(rooms)` after mutations (1 second debounce)
- Cleanup runs every 30 minutes to remove rooms older than 24 hours
- Volume mounted at `/app/data` on Fly.io

## Deployment Notes
- **Docker multi-stage build:** Builder stage + production stage
- **Single machine** (WebSocket sticky sessions required)
- **Fly.io Frankfurt region** with persistent volume
- **Static files** served from server in production
- **SPA fallback:** All routes serve `index.html`

## When Making Changes

1. **Preserve patterns:** Match existing code style
2. **Test manually:** No automated tests exist, test in browser
3. **Update both sides:** Changes often affect client AND server
4. **Check persistence:** Verify `debouncedSaveRooms()` called after state changes
5. **Consider mobile:** Design is mobile-first
6. **Error handling:** Always provide user feedback for errors
7. **Socket cleanup:** Always clean up Socket.IO listeners in React effects
