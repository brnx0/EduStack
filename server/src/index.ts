import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import projectRoutes from './routes/projects.js';
import authRoutes from './routes/auth.js';
import { registerRoutes } from './routes/index.js';
import { registerSocketHandlers } from './sockets/index.js';
import { authMiddleware } from './middleware/auth.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api', authMiddleware, projectRoutes);

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

registerRoutes(app);
registerSocketHandlers(io);

const PORT = parseInt(process.env.PORT || '3001');
const HOST = process.env.HOST || '0.0.0.0';
httpServer.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
