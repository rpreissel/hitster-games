import https from 'https';

// BoardGameGeek API Service
// Nutzt die api.geekdo.com JSON API für Bilder

const GEEKDO_API_BASE = 'https://api.geekdo.com/api';

// Cache für geladene Spiele
let gamesCache = [];
let lastFetch = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 Stunde

// Erweiterte Spieleliste mit Namen und Jahr
const GAME_DATA = [
  { id: '174430', name: 'Gloomhaven', year: 2017 },
  { id: '224517', name: 'Brass: Birmingham', year: 2018 },
  { id: '167791', name: 'Terraforming Mars', year: 2016 },
  { id: '233078', name: 'Wingspan', year: 2019 },
  { id: '12333', name: 'Twilight Struggle', year: 2005 },
  { id: '182028', name: 'Through the Ages: A New Story of Civilization', year: 2015 },
  { id: '193738', name: 'Great Western Trail', year: 2016 },
  { id: '220308', name: 'Gaia Project', year: 2017 },
  { id: '169786', name: 'Scythe', year: 2016 },
  { id: '187645', name: 'Star Wars: Rebellion', year: 2016 },
  { id: '3076', name: 'Puerto Rico', year: 2002 },
  { id: '822', name: 'Carcassonne', year: 2000 },
  { id: '13', name: 'CATAN', year: 1995 },
  { id: '30549', name: 'Pandemic', year: 2008 },
  { id: '28720', name: 'Brass: Lancashire', year: 2007 },
  { id: '31260', name: 'Agricola', year: 2007 },
  { id: '2651', name: 'Power Grid', year: 2004 },
  { id: '68448', name: '7 Wonders', year: 2010 },
  { id: '36218', name: 'Dominion', year: 2008 },
  { id: '9209', name: 'Ticket to Ride', year: 2004 },
  { id: '521', name: 'Crokinole', year: 1876 },
  { id: '1406', name: 'Monopoly', year: 1935 },
  { id: '181', name: 'Risk', year: 1959 },
  { id: '188', name: 'Go', year: -2200 },
  { id: '171', name: 'Chess', year: 1475 },
  { id: '320', name: 'Scrabble', year: 1948 },
  { id: '2083', name: 'Trivial Pursuit', year: 1981 },
  { id: '178900', name: 'Codenames', year: 2015 },
  { id: '342942', name: 'Ark Nova', year: 2021 },
  { id: '312484', name: 'Lost Ruins of Arnak', year: 2020 },
  { id: '324856', name: 'Cascadia', year: 2021 },
  { id: '316554', name: 'Dune: Imperium', year: 2020 },
  { id: '237182', name: 'Root', year: 2018 },
  { id: '205637', name: 'Arkham Horror: The Card Game', year: 2016 },
  { id: '161936', name: 'Pandemic Legacy: Season 1', year: 2015 },
  { id: '84876', name: 'The Castles of Burgundy', year: 2011 },
  { id: '120677', name: 'Terra Mystica', year: 2012 },
  { id: '102794', name: 'Caverna: The Cave Farmers', year: 2013 },
  { id: '96848', name: 'Mage Knight Board Game', year: 2011 },
  { id: '70323', name: 'King of Tokyo', year: 2011 },
  { id: '148228', name: 'Splendor', year: 2014 },
  { id: '199792', name: 'Everdell', year: 2018 },
  { id: '356123', name: 'Earth', year: 2023 },
  { id: '359438', name: 'Forest Shuffle', year: 2023 },
  { id: '295770', name: 'Frosthaven', year: 2023 },
  { id: '291457', name: 'Gloomhaven: Jaws of the Lion', year: 2020 },
  { id: '37111', name: 'Battlestar Galactica', year: 2008 },
  { id: '25613', name: 'Through the Ages', year: 2006 },
  { id: '5782', name: 'The Game of Life', year: 1960 },
  { id: '463', name: 'Clue', year: 1949 },
  { id: '15987', name: 'Arkham Horror', year: 2005 },
  { id: '43111', name: 'Chaos in the Old World', year: 2009 },
  { id: '230802', name: 'Azul', year: 2017 },
  { id: '40834', name: 'Dixit', year: 2008 },
  { id: '131357', name: 'Coup', year: 2012 },
  { id: '209778', name: 'Magic Maze', year: 2017 },
  { id: '173346', name: 'Champions of Midgard', year: 2015 },
  { id: '172818', name: 'Above and Below', year: 2015 },
  { id: '244992', name: 'The Mind', year: 2018 },
  { id: '256226', name: 'Just One', year: 2018 },
  { id: '266810', name: 'Pax Pamir (Second Edition)', year: 2019 },
  { id: '283355', name: 'Nemesis', year: 2018 },
  { id: '317985', name: 'Beyond the Sun', year: 2020 },
  { id: '251247', name: 'Barrage', year: 2019 },
  { id: '184267', name: 'On Mars', year: 2020 },
  { id: '175640', name: 'Castle Panic', year: 2009 },
  { id: '126163', name: 'Tzolk\'in: The Mayan Calendar', year: 2012 },
  { id: '35677', name: 'Le Havre', year: 2008 },
  { id: '72125', name: 'Eclipse', year: 2011 },
];

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BoardGameTimeline/1.0'
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
      res.on('error', reject);
    });
    
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function fetchGameImage(gameId) {
  try {
    // Erst versuchen BoxFront Bilder zu holen (offizielle Cover)
    const boxFrontUrl = `${GEEKDO_API_BASE}/images?objectid=${gameId}&objecttype=thing&tag=BoxFront&nosession=1`;
    const boxFrontData = await fetchJson(boxFrontUrl);
    
    if (boxFrontData.images && boxFrontData.images.length > 0) {
      // Suche nach dem beliebtesten BoxFront Bild
      const images = boxFrontData.images;
      // Sortiere nach Empfehlungen (numrecommend)
      images.sort((a, b) => (b.numrecommend || 0) - (a.numrecommend || 0));
      const image = images[0];
      return image.imageurl_lg || image.imageurl || null;
    }
    
    // Fallback: Hole aus der game gallery
    const gameUrl = `${GEEKDO_API_BASE}/images?objectid=${gameId}&objecttype=thing&gallery=game&nosession=1`;
    const gameData = await fetchJson(gameUrl);
    
    if (gameData.images && gameData.images.length > 0) {
      const image = gameData.images[0];
      return image.imageurl_lg || image.imageurl || null;
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching image for game ${gameId}:`, error.message);
    return null;
  }
}

async function loadGamesWithImages() {
  console.log('Loading game images from Geekdo API...');
  
  const gamesWithImages = [];
  
  // Lade Bilder für alle Spiele
  for (const game of GAME_DATA) {
    try {
      const image = await fetchGameImage(game.id);
      
      gamesWithImages.push({
        ...game,
        image: image,
        thumbnail: image // Nutze das gleiche Bild als Thumbnail
      });
      
      // Kurze Pause um API nicht zu überlasten
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Failed to load image for ${game.name}:`, error.message);
      gamesWithImages.push({
        ...game,
        image: null,
        thumbnail: null
      });
    }
  }
  
  // Filtere Spiele ohne Bilder nicht aus - sie zeigen Fallback an
  console.log(`Loaded images for ${gamesWithImages.filter(g => g.image).length}/${gamesWithImages.length} games`);
  
  return gamesWithImages;
}

export async function getRandomGames(count = 20) {
  const now = Date.now();
  
  // Cache prüfen
  if (gamesCache.length > 0 && now - lastFetch < CACHE_DURATION) {
    return shuffleArray([...gamesCache]).slice(0, count);
  }
  
  // Spiele mit Bildern laden
  gamesCache = await loadGamesWithImages();
  lastFetch = now;
  
  return shuffleArray([...gamesCache]).slice(0, count);
}

export async function getAllGames() {
  if (gamesCache.length === 0) {
    await getRandomGames(50);
  }
  return [...gamesCache];
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function getGameById(id) {
  return gamesCache.find(g => g.id === id);
}
