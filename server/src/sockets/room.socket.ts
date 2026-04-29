import type { Server, Socket } from 'socket.io';
import {
  createRoom,
  joinRoom,
  castVote,
  revealVotes,
  resetVotes,
  disconnectSocket,
  socketToUser,
} from '../services/room.service.js';

export function registerRoomSocketHandlers(io: Server, socket: Socket) {
  socket.on('create-room', ({ roomId, deck }: { roomId: string; deck: string }) => {
    createRoom(roomId, deck);
  });

  socket.on('join-room', ({ roomId, name, userId }: { roomId: string; name: string; userId: string }) => {
    const room = joinRoom(roomId, userId, name, socket.id);
    if (!room) {
      socket.emit('error', 'Sala não encontrada');
      return;
    }

    socket.join(roomId);
    socketToUser[socket.id] = { roomId, userId };
    io.to(roomId).emit('room-updated', room);
  });

  socket.on('vote', ({ roomId, userId, vote }: { roomId: string; userId: string; vote: string | null }) => {
    const room = castVote(roomId, userId, vote);
    if (room) io.to(roomId).emit('room-updated', room);
  });

  socket.on('reveal-votes', ({ roomId }: { roomId: string }) => {
    const room = revealVotes(roomId);
    if (room) io.to(roomId).emit('room-updated', room);
  });

  socket.on('reset-votes', ({ roomId }: { roomId: string }) => {
    const room = resetVotes(roomId);
    if (room) io.to(roomId).emit('room-updated', room);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    const result = disconnectSocket(socket.id);
    if (result) {
      io.to(result.roomId).emit('room-updated', result.room);
    }
  });
}
