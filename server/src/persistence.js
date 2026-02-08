import fs from 'fs';
import path from 'path';

// Persistence Layer für Spielräume
const DATA_DIR = process.env.DATA_DIR || './data';
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');

// Sicherstellen, dass das Datenverzeichnis existiert
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`Created data directory: ${DATA_DIR}`);
  }
}

// Räume aus Datei laden
export function loadRooms() {
  ensureDataDir();
  
  try {
    if (fs.existsSync(ROOMS_FILE)) {
      const data = fs.readFileSync(ROOMS_FILE, 'utf8');
      const roomsArray = JSON.parse(data);
      console.log(`Loaded ${roomsArray.length} rooms from disk`);
      return new Map(roomsArray.map(room => [room.code, room]));
    }
  } catch (error) {
    console.error('Error loading rooms:', error.message);
  }
  
  return new Map();
}

// Räume in Datei speichern
export function saveRooms(rooms) {
  ensureDataDir();
  
  try {
    const roomsArray = Array.from(rooms.values());
    fs.writeFileSync(ROOMS_FILE, JSON.stringify(roomsArray, null, 2));
  } catch (error) {
    console.error('Error saving rooms:', error.message);
  }
}

// Debounced save - um nicht bei jeder Änderung sofort zu speichern
let saveTimeout = null;
export function debouncedSaveRooms(rooms, delay = 1000) {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    saveRooms(rooms);
    saveTimeout = null;
  }, delay);
}

// Alte/inaktive Räume aufräumen (älter als 24 Stunden)
export function cleanupOldRooms(rooms) {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 Stunden
  
  let cleaned = 0;
  for (const [code, room] of rooms.entries()) {
    if (room.lastActivity && (now - room.lastActivity) > maxAge) {
      rooms.delete(code);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} inactive rooms`);
    saveRooms(rooms);
  }
  
  return cleaned;
}
