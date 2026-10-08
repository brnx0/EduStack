import type { Request, Response } from 'express';
import { findAll, findById } from '../services/jsonStorage.js';
import {
  sshRunner,
  discoverServices,
  controlService,
  readLogs,
  ServiceError,
  isServiceAction,
} from '../services/serviceManager.js';
import { recordAction, listActions } from '../services/serviceAudit.js';

type StoredServer = {
  id: number;
  nome: string;
  ip: string;
  portaSsh: number;
  usuarioSsh: string | null;
  senhaSsh: string | null;
  ativo: boolean;
};

function loadServer(req: Request): StoredServer {
  const id = parseInt(req.params['id'] as string);
  const server = Number.isFinite(id) ? (findById('servers', id) as StoredServer | undefined) : undefined;
  if (!server || server.ativo === false) throw new ServiceError(404, 'Servidor não encontrado.');
  if (!server.usuarioSsh || !server.senhaSsh) {
    throw new ServiceError(400, `O servidor ${server.nome} não tem usuário e senha SSH cadastrados.`);
  }
  return server;
}

function runnerFor(server: StoredServer) {
  return sshRunner({
    host: server.ip,
    port: server.portaSsh || 22,
    username: server.usuarioSsh as string,
    password: server.senhaSsh as string,
  });
}

export function describeError(err: unknown, server?: Pick<StoredServer, 'nome' | 'ip'>): { status: number; message: string } {
  if (err instanceof ServiceError) return { status: err.status, message: err.message };
  // A senha SSH é a mesma do sudo: senha errada falha já na autenticação do ssh2, antes de qualquer sudo.
  if ((err as { level?: string } | null)?.level === 'client-authentication') {
    return { status: 502, message: `Senha SSH/sudo inválida para o servidor ${server?.nome ?? ''}.` };
  }
  const where = server ? ` ${server.nome} (${server.ip})` : '';
  return {
    status: 502,
    message: `Não foi possível conectar ao servidor${where}: ${err instanceof Error ? err.message : String(err)}`,
  };
}

function errorMessage(err: unknown, server?: StoredServer): string {
  return describeError(err, server).message;
}

function sendError(res: Response, err: unknown, server?: StoredServer) {
  const { status, message } = describeError(err, server);
  res.status(status).json({ error: message });
}

export function listServiceServers(_req: Request, res: Response) {
  const servers = findAll('servers') as StoredServer[];
  res.json(servers.map((s) => ({ id: s.id, nome: s.nome, ip: s.ip })));
}

export async function listServices(req: Request, res: Response) {
  let server: StoredServer | undefined;
  try {
    server = loadServer(req);
    res.json(await discoverServices(runnerFor(server)));
  } catch (err) {
    sendError(res, err, server);
  }
}

export async function runServiceAction(req: Request, res: Response) {
  let server: StoredServer | undefined;
  const service = req.params['name'] as string;
  const action = req.params['action'] as string;
  const user = (req as any).user ?? {};

  const audit = (success: boolean, message: string) => {
    if (!server) return;
    recordAction({
      userId: user.id ?? null,
      userLogin: String(user.login ?? 'desconhecido'),
      serverId: server.id,
      serverName: server.nome,
      service,
      action,
      success,
      message,
    });
  };

  try {
    server = loadServer(req);
    if (!isServiceAction(action)) throw new ServiceError(400, 'Ação inválida.');
    const info = await controlService(runnerFor(server), service, action);
    audit(true, `${info.activeState} (${info.subState})`);
    res.json(info);
  } catch (err) {
    audit(false, errorMessage(err, server));
    sendError(res, err, server);
  }
}

export async function getServiceLogs(req: Request, res: Response) {
  let server: StoredServer | undefined;
  try {
    server = loadServer(req);
    const log = await readLogs(runnerFor(server), req.params['name'] as string, req.query['lines']);
    res.json({ log });
  } catch (err) {
    sendError(res, err, server);
  }
}

export function getServiceActions(req: Request, res: Response) {
  res.json(listActions(Number(req.query['limit'] ?? 50)));
}
