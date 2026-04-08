import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

let socket: Socket | null = null;

function normalizeToken(token?: string | null): string | null {
  if (!token) return null;
  const value = token.trim();
  return value.length > 0 ? value : null;
}

export function getSocket(): Socket {
  if (!socket) {
    const token = typeof window !== 'undefined' ? normalizeToken(localStorage.getItem('accessToken')) : null;
    socket = io(SOCKET_URL, {
      auth: { token },
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) {
    const token = normalizeToken(localStorage.getItem('accessToken'));
    s.auth = { token };
    s.connect();
  }
}

export function updateSocketAuthToken(token: string | null): void {
  if (!socket) return;

  const nextToken = normalizeToken(token);
  socket.auth = { token: nextToken };

  // Reconnect only when already connected so handshake uses the newest JWT.
  if (socket.connected) {
    socket.disconnect();
    socket.connect();
  }
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
