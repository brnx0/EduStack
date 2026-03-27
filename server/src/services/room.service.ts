import type { RoomState } from '../types/poker.js';

// In-memory state — single source of truth for both HTTP routes and WebSocket handlers
const rooms: Record<string, RoomState> = {};

// Map socket ID → { roomId, userId } for efficient disconnect handling
export const socketToUser: Record<string, { roomId: string; userId: string }> = {};

export function getRoom(roomId: string): RoomState | undefined {
  return rooms[roomId];
}

export function getAllRooms(): Record<string, RoomState> {
  return rooms;
}

export function createRoom(roomId: string, deck: string): RoomState {
  if (!rooms[roomId]) {
    rooms[roomId] = { deck, participants: {}, revealed: false };
  }
  return rooms[roomId];
}

export function joinRoom(roomId: string, userId: string, name: string, socketId: string): RoomState | null {
  const room = rooms[roomId];
  if (!room) return null;

  const participant = room.participants[userId];
  if (participant) {
    if (!participant.connectedSockets.includes(socketId)) {
      participant.connectedSockets.push(socketId);
    }
    participant.name = name;
  } else {
    room.participants[userId] = {
      name,
      vote: null,
      hasVoted: false,
      connectedSockets: [socketId],
    };
  }

  return room;
}

export function castVote(roomId: string, userId: string, vote: string | null): RoomState | null {
  const room = rooms[roomId];
  if (!room || !room.participants[userId]) return null;

  room.participants[userId]!.vote = vote;
  room.participants[userId]!.hasVoted = vote !== null;
  return room;
}

export function revealVotes(roomId: string): RoomState | null {
  const room = rooms[roomId];
  if (!room) return null;

  room.revealed = true;
  return room;
}

export function resetVotes(roomId: string): RoomState | null {
  const room = rooms[roomId];
  if (!room) return null;

  room.revealed = false;
  Object.values(room.participants).forEach((p) => {
    p.vote = null;
    p.hasVoted = false;
  });
  return room;
}

export function disconnectSocket(socketId: string): { roomId: string; room: RoomState } | null {
  const session = socketToUser[socketId];
  if (!session) return null;

  const { roomId, userId } = session;
  const room = rooms[roomId];

  if (room && room.participants[userId]) {
    const participant = room.participants[userId];
    participant.connectedSockets = participant.connectedSockets.filter((id) => id !== socketId);

    if (participant.connectedSockets.length === 0) {
      delete room.participants[userId];
    }
  }

  delete socketToUser[socketId];
  return room ? { roomId, room } : null;
}
