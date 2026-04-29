import type { Express } from 'express';
import roomsRouter from './rooms.routes.js';

export function registerRoutes(app: Express) {
    app.use('/rooms', roomsRouter);
}
