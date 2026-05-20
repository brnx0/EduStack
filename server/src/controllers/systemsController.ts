import type { Request, Response } from 'express';
import { findAll, findById, create, update, softDelete } from '../services/jsonStorage.js';

const COLLECTION = 'systems';

interface System {
  id: number;
  codServidor: number;
  nome: string;
  pathRaiz: string;
  nomeServico: string;
  ativo: boolean;
  criadoEm: string;
}

function enrichWithServer(sys: System) {
  const server = findById('servers', sys.codServidor);
  return { ...sys, serverNome: server?.nome, serverIp: server?.ip };
}

export async function listSystems(_req: Request, res: Response) {
  try {
    const systems = findAll(COLLECTION).map(enrichWithServer);
    res.json(systems);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getSystem(req: Request, res: Response) {
  try {
    const id = parseInt(req.params['id'] as string);
    const sys = findById(COLLECTION, id);
    if (!sys) {
      res.status(404).json({ error: 'Sistema não encontrado' });
      return;
    }
    res.json(enrichWithServer(sys));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function listSystemsByServer(req: Request, res: Response) {
  try {
    const serverId = parseInt(req.params['serverId'] as string);
    const systems = findAll(COLLECTION)
      .filter(s => s.codServidor === serverId)
      .map(enrichWithServer);
    res.json(systems);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createSystem(req: Request, res: Response) {
  try {
    const { codServidor, nome, pathRaiz, nomeServico, nomeArquivo } = req.body;
    const sys = create(COLLECTION, {
      codServidor, nome, pathRaiz, nomeServico, nomeArquivo: nomeArquivo || '', ativo: true,
    } as any);
    res.status(201).json(sys);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateSystem(req: Request, res: Response) {
  try {
    const id = parseInt(req.params['id'] as string);
    const { codServidor, nome, pathRaiz, nomeServico, nomeArquivo } = req.body;
    const sys = update(COLLECTION, id, {
      codServidor, nome, pathRaiz, nomeServico, nomeArquivo: nomeArquivo || '',
    });
    if (!sys) {
      res.status(404).json({ error: 'Sistema não encontrado' });
      return;
    }
    res.json(sys);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function deleteSystem(req: Request, res: Response) {
  try {
    const id = parseInt(req.params['id'] as string);
    softDelete(COLLECTION, id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
