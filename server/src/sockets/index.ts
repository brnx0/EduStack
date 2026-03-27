import type { Server } from 'socket.io';
import { registerRoomSocketHandlers } from './room.socket.js';

export function registerSocketHandlers(io: Server) {
  io.on('connection', (socket) => {
    registerRoomSocketHandlers(io, socket);
  });
}
