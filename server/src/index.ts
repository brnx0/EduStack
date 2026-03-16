import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*', // For local development, allow all origins
  },
});

type RoomState = {
  deck: string;
  participants: {
    [userId: string]: {
      name: string;
      vote: string | null;
      hasVoted: boolean;
      connectedSockets: string[]; // Track multiple tabs per user
    };
  };
  revealed: boolean;
};

const rooms: Record<string, RoomState> = {};
// Map socket ID directly to room and user for efficient disconnection handling
const socketToUser: Record<string, { roomId: string; userId: string }> = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('create-room', ({ roomId, deck }: { roomId: string; deck: string }) => {
    if (!rooms[roomId]) {
      rooms[roomId] = {
        deck,
        participants: {},
        revealed: false,
      };
    }
  });

  socket.on('join-room', ({ roomId, name, userId }: { roomId: string; name: string; userId: string }) => {
    if (!rooms[roomId]) {
      socket.emit('error', 'Sala não encontrada');
      return;
    }

    socket.join(roomId);

    socketToUser[socket.id] = { roomId, userId };

    const participant = rooms[roomId].participants[userId];
    if (participant) {
      // User is already in the room, just add this new socket
      if (!participant.connectedSockets.includes(socket.id)) {
        participant.connectedSockets.push(socket.id);
      }
      
      // Update name in case they somehow changed it
      participant.name = name;
    } else {
      // First time this user connects to this room
      rooms[roomId].participants[userId] = { 
        name, 
        vote: null, 
        hasVoted: false,
        connectedSockets: [socket.id]
      };
    }
    
    io.to(roomId).emit('room-updated', rooms[roomId]);

  });

  socket.on('vote', ({ roomId, userId, vote }: { roomId: string; userId: string; vote: string | null }) => {
    if (rooms[roomId] && rooms[roomId].participants[userId]) {
      rooms[roomId].participants[userId]!.vote = vote;
      rooms[roomId].participants[userId]!.hasVoted = vote !== null;
      io.to(roomId).emit('room-updated', rooms[roomId]);
    }
  });

  socket.on('reveal-votes', ({ roomId }: { roomId: string }) => {
    if (rooms[roomId]) {
      rooms[roomId].revealed = true;
      io.to(roomId).emit('room-updated', rooms[roomId]);
    }
  });

  socket.on('reset-votes', ({ roomId }: { roomId: string }) => {
    if (rooms[roomId]) {
      rooms[roomId].revealed = false;
      Object.values(rooms[roomId].participants).forEach(p => {
        p.vote = null;
        p.hasVoted = false;
      });
      io.to(roomId).emit('room-updated', rooms[roomId]);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    const userSession = socketToUser[socket.id];
    
    if (userSession) {
      const { roomId, userId } = userSession;
      const room = rooms[roomId];
      
      if (room && room.participants[userId]) {
        // Remove this specific socket from their connected list
        const participant = room.participants[userId];
        participant.connectedSockets = participant.connectedSockets.filter(id => id !== socket.id);
        
        // If they have no more connected sockets (e.g. closed all tabs)
        if (participant.connectedSockets.length === 0) {
          delete room.participants[userId];
        }
        
        // Notify others
        io.to(roomId).emit('room-updated', room);
      }
      
      delete socketToUser[socket.id];
    }
  });
});

const PORT = process.env.VITE_SOCKET_PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO Server running on http://localhost:${PORT}`);
});
