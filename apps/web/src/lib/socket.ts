import { io, type Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || '';

export function createPairingSocket(): Socket {
  return io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
  });
}

export function createAuthedSocket(token: string): Socket {
  return io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });
}
