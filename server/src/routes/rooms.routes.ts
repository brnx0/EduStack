import { Router } from 'express';
import { createRoom, getRoom, getAllRooms } from '../services/room.service.js';

const router = Router();

// GET /rooms — list all active rooms (IDs and participant count)
router.get('/', (_req, res) => {
  const rooms = getAllRooms();
  const summary = Object.entries(rooms).map(([id, room]) => ({
    id,
    deck: room.deck,
    participantCount: Object.keys(room.participants).length,
    revealed: room.revealed,
  }));
  res.json(summary);
});

// GET /rooms/:roomId — get full room state
router.get('/:roomId', (req, res) => {
  const room = getRoom(req.params.roomId);
  if (!room) {
    res.status(404).json({ error: 'Sala não encontrada' });
    return;
  }
  res.json(room);
});

// POST /rooms — create a new room
router.post('/', (req, res) => {
  const { roomId, deck } = req.body as { roomId?: string; deck?: string };

  if (!roomId || !deck) {
    res.status(400).json({ error: 'roomId e deck são obrigatórios' });
    return;
  }

  const room = createRoom(roomId, deck);
  res.status(201).json({ roomId, ...room });
});

export default router;
