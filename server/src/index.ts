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
    [socketId: string]: {
      name: string;
      vote: string | null;
      hasVoted: boolean;
    };
  };
  revealed: boolean;
};

const rooms: Record<string, RoomState> = {};

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

  socket.on('join-room', ({ roomId, name }: { roomId: string; name: string }) => {
    if (!rooms[roomId]) {
      socket.emit('error', 'Sala não encontrada');
      return;
    }

    socket.join(roomId);
    rooms[roomId].participants[socket.id] = { name, vote: null, hasVoted: false };
    
    io.to(roomId).emit('room-updated', rooms[roomId]);

  });

  socket.on('vote', ({ roomId, vote }: { roomId: string; vote: string | null }) => {
    if (rooms[roomId] && rooms[roomId].participants[socket.id]) {
      rooms[roomId].participants[socket.id]!.vote = vote;
      rooms[roomId].participants[socket.id]!.hasVoted = vote !== null;
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
    for (const roomId in rooms) {
      if (rooms[roomId]!.participants[socket.id]) {
        delete rooms[roomId]!.participants[socket.id];
        io.to(roomId).emit('room-updated', rooms[roomId]);
      }
    }
  });
});

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO Server running on http://localhost:${PORT}`);
});
