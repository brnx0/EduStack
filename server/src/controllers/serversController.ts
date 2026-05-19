import type { Request, Response } from 'express';
import { findAll, findById, create, update, softDelete } from '../services/jsonStorage.js';

const COLLECTION = 'servers';

interface Server {
  id: number;
  nome: string;
  ip: string;
  portaSsh: number;
  usuarioSsh: string | null;
  senhaSsh: string | null;
  ativo: boolean;
  criadoEm: string;
}

export async function listServers(_req: Request, res: Response) {
  try {
    res.json(findAll(COLLECTION));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getServer(req: Request, res: Response) {
  try {
    const id = parseInt(req.params['id'] as string);
    const server = findById(COLLECTION, id);
    if (!server) {
      res.status(404).json({ error: 'Servidor não encontrado' });
      return;
    }
    res.json(server);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createServer(req: Request, res: Response) {
  try {
    const { nome, ip, portaSsh, usuarioSsh, senhaSsh } = req.body;
    const server = create(COLLECTION, {
      nome,
      ip,
      portaSsh: portaSsh || 22,
      usuarioSsh: usuarioSsh || null,
      senhaSsh: senhaSsh || null,
      ativo: true,
    } as any);
    res.status(201).json(server);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateServer(req: Request, res: Response) {
  try {
    const id = parseInt(req.params['id'] as string);
    const { nome, ip, portaSsh, usuarioSsh, senhaSsh } = req.body;
    const server = update(COLLECTION, id, {
      nome,
      ip,
      portaSsh: portaSsh || 22,
      usuarioSsh: usuarioSsh || null,
      senhaSsh: senhaSsh || null,
    });
    if (!server) {
      res.status(404).json({ error: 'Servidor não encontrado' });
      return;
    }
    res.json(server);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function deleteServer(req: Request, res: Response) {
  try {
    const id = parseInt(req.params['id'] as string);
    softDelete(COLLECTION, id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
