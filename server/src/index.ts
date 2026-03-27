import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { registerRoutes } from './routes/index.js';
import { registerSocketHandlers } from './sockets/index.js';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

registerRoutes(app);
registerSocketHandlers(io);

const PORT = process.env.VITE_SOCKET_PORT || 3001;
httpServer.listen(PORT, () => {

});
