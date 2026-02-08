import React, { useState, useEffect, useCallback } from 'react';
import { socket, connectSocket } from './socket';
import './App.css';

// Komponenten
function NameInput({ onSubmit }) {
  const [name, setName] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
    }
  };
  
  return (
    <div className="screen name-screen">
      <h1>Board Game Timeline</h1>
      <p className="subtitle">Sortiere Brettspiele nach Erscheinungsjahr!</p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Dein Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          autoFocus
        />
        <button type="submit" disabled={!name.trim()}>
          Spielen
        </button>
      </form>
    </div>
  );
}

function MainMenu({ playerName, onCreateRoom, onJoinRoom }) {
  const [joinCode, setJoinCode] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  
  const handleJoin = (e) => {
    e.preventDefault();
    if (joinCode.trim().length === 4) {
      onJoinRoom(joinCode.trim().toUpperCase());
    }
  };
  
  return (
    <div className="screen menu-screen">
      <h1>Hallo, {playerName}!</h1>
      
      <div className="menu-buttons">
        <button onClick={onCreateRoom} className="primary">
          Neuen Raum erstellen
        </button>
        
        {!showJoin ? (
          <button onClick={() => setShowJoin(true)}>
            Raum beitreten
          </button>
        ) : (
          <form onSubmit={handleJoin} className="join-form">
            <input
              type="text"
              placeholder="CODE"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={4}
              autoFocus
            />
            <button type="submit" disabled={joinCode.length !== 4}>
              Beitreten
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Lobby({ room, playerId, onStart, onLeave, onUpdateSettings }) {
  const isHost = room.host === playerId;
  
  return (
    <div className="screen lobby-screen">
      <div className="lobby-header">
        <h2>Raum: {room.code}</h2>
        <button onClick={onLeave} className="leave-btn">Verlassen</button>
      </div>
      
      <div className="players-list">
        <h3>Spieler ({room.players.length}/8)</h3>
        {room.players.map((player) => (
          <div key={player.id} className={`player-item ${player.id === room.host ? 'host' : ''}`}>
            {player.name}
            {player.id === room.host && <span className="host-badge">Host</span>}
            {player.id === playerId && <span className="you-badge">Du</span>}
          </div>
        ))}
      </div>
      
      {isHost && (
        <div className="settings">
          <h3>Einstellungen</h3>
          <label>
            Punkte zum Gewinnen:
            <select 
              value={room.settings?.winCondition || 10}
              onChange={(e) => onUpdateSettings({ winCondition: parseInt(e.target.value) })}
            >
              {[5, 7, 10, 15, 20].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      
      <div className="lobby-actions">
        {isHost ? (
          <button 
            onClick={onStart} 
            className="primary start-btn"
            disabled={room.players.length < 2}
          >
            {room.players.length < 2 ? 'Warte auf Spieler...' : 'Spiel starten'}
          </button>
        ) : (
          <p className="waiting-text">Warte auf Host...</p>
        )}
      </div>
    </div>
  );
}

function GameCard({ game, showYear = false, small = false }) {
  // BGG Bilder über Proxy laden um CORS zu umgehen
  const originalUrl = game.image || game.thumbnail;
  const imageUrl = originalUrl 
    ? `/api/image-proxy?url=${encodeURIComponent(originalUrl)}`
    : null;
  const [imgError, setImgError] = React.useState(false);
  
  return (
    <div className={`game-card ${small ? 'small' : ''}`}>
      {imageUrl && !imgError ? (
        <img 
          src={imageUrl} 
          alt={game.name}
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="no-image">
          {game.name?.charAt(0) || '?'}
        </div>
      )}
      <div className="game-info">
        <h4>{game.name}</h4>
        {showYear && <span className="year">{game.year}</span>}
      </div>
    </div>
  );
}

function Timeline({ timeline, onPlaceGame, isMyTurn, currentGame }) {
  // Mögliche Positionen berechnen
  const positions = [];
  for (let i = 0; i <= timeline.length; i++) {
    positions.push(i);
  }
  
  return (
    <div className="timeline-container">
      <div className="timeline">
        {positions.map((pos) => (
          <div key={`pos-${pos}`} className="timeline-slot">
            {isMyTurn && currentGame && (
              <button 
                className="insert-btn"
                onClick={() => onPlaceGame(pos)}
                title={pos === 0 ? 'Am Anfang' : pos === timeline.length ? 'Am Ende' : `Zwischen ${timeline[pos-1].year} und ${timeline[pos].year}`}
              >
                +
              </button>
            )}
            {pos < timeline.length && (
              <GameCard game={timeline[pos]} showYear={true} small />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function GameScreen({ room, playerId, onPlaceGame }) {
  const currentPlayer = room.players.find(p => p.isCurrentPlayer);
  const myPlayer = room.players.find(p => p.id === playerId);
  const isMyTurn = currentPlayer?.id === playerId;
  
  return (
    <div className="screen game-screen">
      <div className="game-header">
        <div className="room-code">Raum: {room.code}</div>
        <div className="deck-info">Deck: {room.deckSize}</div>
      </div>
      
      <div className="scores">
        {room.players.map((player) => (
          <div 
            key={player.id} 
            className={`score-item ${player.isCurrentPlayer ? 'active' : ''} ${player.id === playerId ? 'me' : ''}`}
          >
            <span className="name">{player.name}</span>
            <span className="score">{player.score}/{room.settings?.winCondition || 10}</span>
          </div>
        ))}
      </div>
      
      <div className="current-game-section">
        <h3>{isMyTurn ? 'Du bist dran!' : `${currentPlayer?.name} ist dran`}</h3>
        {room.currentGame && (
          <GameCard game={room.currentGame} showYear={false} />
        )}
        {isMyTurn && (
          <p className="hint">Tippe auf + um das Spiel einzusortieren</p>
        )}
      </div>
      
      <div className="my-timeline-section">
        <h3>Deine Timeline</h3>
        <Timeline 
          timeline={myPlayer?.timeline || []}
          onPlaceGame={onPlaceGame}
          isMyTurn={isMyTurn}
          currentGame={room.currentGame}
        />
      </div>
    </div>
  );
}

function ResultOverlay({ result, onClose }) {
  if (!result) return null;
  
  return (
    <div className="overlay result-overlay" onClick={onClose}>
      <div className="overlay-content" onClick={e => e.stopPropagation()}>
        <h2>{result.correct ? 'Richtig!' : 'Falsch!'}</h2>
        <GameCard game={result.game} showYear={true} />
        <p>{result.game.name} erschien {result.game.year}</p>
        <button onClick={onClose}>Weiter</button>
      </div>
    </div>
  );
}

function WinnerScreen({ winner, room, playerId, onRematch, onLeave }) {
  const isHost = room.host === playerId;
  
  return (
    <div className="screen winner-screen">
      <h1>{winner.id === playerId ? 'Du hast gewonnen!' : `${winner.name} gewinnt!`}</h1>
      
      <div className="final-scores">
        <h3>Endergebnis</h3>
        {room.players
          .sort((a, b) => b.score - a.score)
          .map((player, index) => (
            <div key={player.id} className={`score-item ${index === 0 ? 'winner' : ''}`}>
              <span className="rank">{index + 1}.</span>
              <span className="name">{player.name}</span>
              <span className="score">{player.score} Punkte</span>
            </div>
          ))}
      </div>
      
      <div className="actions">
        {isHost && (
          <button onClick={onRematch} className="primary">Nochmal spielen</button>
        )}
        <button onClick={onLeave}>Verlassen</button>
      </div>
    </div>
  );
}

function App() {
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState(null);
  const [room, setRoom] = useState(null);
  const [screen, setScreen] = useState('name'); // name, menu, lobby, game, winner
  const [error, setError] = useState('');
  const [lastResult, setLastResult] = useState(null);
  
  // Socket Events
  useEffect(() => {
    connectSocket();
    
    socket.on('connect', () => {
      setPlayerId(socket.id);
    });
    
    socket.on('nameSet', (player) => {
      setPlayerId(player.id);
      setScreen('menu');
    });
    
    socket.on('roomCreated', (roomData) => {
      setRoom(roomData);
      setScreen('lobby');
    });
    
    socket.on('roomJoined', (roomData) => {
      setRoom(roomData);
      setScreen('lobby');
    });
    
    socket.on('roomUpdated', (roomData) => {
      setRoom(roomData);
    });
    
    socket.on('gameStarted', (roomData) => {
      setRoom(roomData);
      setScreen('game');
    });
    
    socket.on('gamePlaced', (data) => {
      setRoom(data.room);
      setLastResult(data.result);
    });
    
    socket.on('gameEnded', (data) => {
      setRoom(data.room);
      setTimeout(() => {
        setScreen('winner');
      }, 2000);
    });
    
    socket.on('leftRoom', () => {
      setRoom(null);
      setScreen('menu');
    });
    
    socket.on('playerLeft', (data) => {
      // Könnte eine Benachrichtigung anzeigen
    });
    
    socket.on('error', (msg) => {
      setError(msg);
      setTimeout(() => setError(''), 3000);
    });
    
    return () => {
      socket.off('connect');
      socket.off('nameSet');
      socket.off('roomCreated');
      socket.off('roomJoined');
      socket.off('roomUpdated');
      socket.off('gameStarted');
      socket.off('gamePlaced');
      socket.off('gameEnded');
      socket.off('leftRoom');
      socket.off('playerLeft');
      socket.off('error');
    };
  }, []);
  
  const handleSetName = useCallback((name) => {
    setPlayerName(name);
    socket.emit('setName', name);
  }, []);
  
  const handleCreateRoom = useCallback(() => {
    socket.emit('createRoom');
  }, []);
  
  const handleJoinRoom = useCallback((code) => {
    socket.emit('joinRoom', code);
  }, []);
  
  const handleLeaveRoom = useCallback(() => {
    socket.emit('leaveRoom');
  }, []);
  
  const handleStartGame = useCallback(() => {
    socket.emit('startGame');
  }, []);
  
  const handlePlaceGame = useCallback((position) => {
    socket.emit('placeGame', position);
  }, []);
  
  const handleUpdateSettings = useCallback((settings) => {
    socket.emit('updateSettings', settings);
  }, []);
  
  const handleRematch = useCallback(() => {
    socket.emit('rematch');
    setScreen('lobby');
  }, []);
  
  return (
    <div className="app">
      {error && <div className="error-toast">{error}</div>}
      
      {screen === 'name' && (
        <NameInput onSubmit={handleSetName} />
      )}
      
      {screen === 'menu' && (
        <MainMenu 
          playerName={playerName}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
        />
      )}
      
      {screen === 'lobby' && room && (
        <Lobby 
          room={room}
          playerId={playerId}
          onStart={handleStartGame}
          onLeave={handleLeaveRoom}
          onUpdateSettings={handleUpdateSettings}
        />
      )}
      
      {screen === 'game' && room && (
        <>
          <GameScreen 
            room={room}
            playerId={playerId}
            onPlaceGame={handlePlaceGame}
          />
          <ResultOverlay 
            result={lastResult}
            onClose={() => setLastResult(null)}
          />
        </>
      )}
      
      {screen === 'winner' && room && room.winner && (
        <WinnerScreen 
          winner={room.winner}
          room={room}
          playerId={playerId}
          onRematch={handleRematch}
          onLeave={handleLeaveRoom}
        />
      )}
    </div>
  );
}

export default App;
