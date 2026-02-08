import { io } from 'socket.io-client';

// In production, connect to same origin. In development, use localhost:3001
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 
  (import.meta.env.PROD ? window.location.origin : 'http://localhost:3001');

export const socket = io(SOCKET_URL, {
  autoConnect: false
});

export const connectSocket = () => {
  if (!socket.connected) {
    socket.connect();
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};
