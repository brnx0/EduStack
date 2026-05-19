import type { Request, Response } from 'express';
import { findAll, findById, create, update, softDelete } from '../services/jsonStorage.js';

const COLLECTION = 'environments';

interface Environment {
  id: number;
  codServidor: number;
  sistemaNome: string;
  tipo: string;
  tipoOrigem: string | null;
  descricao: string | null;
  url: string | null;
  contexto: string;
  systemCode: string;
  dirWebrun: string | null;
  dirTomcat: string | null;
  servicoTomcat: string | null;
  makerInterna: string | null;
  makerExterna: string | null;
  login: string;
  senha: string;
  ativo: boolean;
  criadoEm: string;
}

function enrichWithServer(env: Environment) {
  const server = findById('servers', env.codServidor);
  return { ...env, serverNome: server?.nome, serverIp: server?.ip };
}

export async function listEnvironments(_req: Request, res: Response) {
  try {
    const envs = findAll(COLLECTION).map(enrichWithServer);
    res.json(envs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getEnvironment(req: Request, res: Response) {
  try {
    const id = parseInt(req.params['id'] as string);
    const env = findById(COLLECTION, id);
    if (!env) {
      res.status(404).json({ error: 'Ambiente não encontrado' });
      return;
    }
    res.json(enrichWithServer(env));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createEnvironment(req: Request, res: Response) {
  try {
    const {
      codServidor, sistemaNome, tipo, tipoOrigem, descricao,
      url, contexto, systemCode, dirWebrun, dirTomcat,
      servicoTomcat, makerInterna, makerExterna, login, senha
    } = req.body;

    const env = create(COLLECTION, {
      codServidor, sistemaNome, tipo,
      tipoOrigem: tipoOrigem || null,
      descricao: descricao || null,
      url: url || null,
      contexto, systemCode,
      dirWebrun: dirWebrun || null,
      dirTomcat: dirTomcat || null,
      servicoTomcat: servicoTomcat || null,
      makerInterna: makerInterna || null,
      makerExterna: makerExterna || null,
      login, senha,
      ativo: true,
    } as any);
    res.status(201).json(env);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateEnvironment(req: Request, res: Response) {
  try {
    const id = parseInt(req.params['id'] as string);
    const {
      codServidor, sistemaNome, tipo, tipoOrigem, descricao,
      url, contexto, systemCode, dirWebrun, dirTomcat,
      servicoTomcat, makerInterna, makerExterna, login, senha
    } = req.body;

    const env = update(COLLECTION, id, {
      codServidor, sistemaNome, tipo,
      tipoOrigem: tipoOrigem || null,
      descricao: descricao || null,
      url: url || null,
      contexto, systemCode,
      dirWebrun: dirWebrun || null,
      dirTomcat: dirTomcat || null,
      servicoTomcat: servicoTomcat || null,
      makerInterna: makerInterna || null,
      makerExterna: makerExterna || null,
      login, senha,
    });

    if (!env) {
      res.status(404).json({ error: 'Ambiente não encontrado' });
      return;
    }
    res.json(env);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function deleteEnvironment(req: Request, res: Response) {
  try {
    const id = parseInt(req.params['id'] as string);
    softDelete(COLLECTION, id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
