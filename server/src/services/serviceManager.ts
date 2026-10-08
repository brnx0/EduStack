import { runRemote, runSudo, type SSHConfig, type RemoteResult } from './sshService.js';
import {
  DISCOVERY_SCRIPT,
  parseServiceDiscovery,
  normalizeServiceName,
  normalizeLogLines,
  isSudoAuthFailure,
  type ServiceInfo,
} from './serviceDiscovery.js';

export class ServiceError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export type ServiceAction = 'start' | 'stop' | 'restart';

const ACTION_LABELS: Record<ServiceAction, string> = {
  start: 'iniciar',
  stop: 'parar',
  restart: 'reiniciar',
};

export function isServiceAction(value: string): value is ServiceAction {
  return Object.hasOwn(ACTION_LABELS, value);
}

export type RemoteRunner = {
  run(command: string, stdin?: string): Promise<RemoteResult>;
  sudo(command: string): Promise<RemoteResult>;
};

export function sshRunner(config: SSHConfig): RemoteRunner {
  return {
    run: (command, stdin) => runRemote(config, command, stdin === undefined ? {} : { stdin }),
    sudo: (command) => runSudo(config, command),
  };
}

function summarize(text: string): string {
  return text.trim().split(/\r?\n/).slice(-3).join(' ').slice(0, 300);
}

function ensureOk(result: RemoteResult, what: string): void {
  if (isSudoAuthFailure(result.stderr)) {
    throw new ServiceError(502, 'Senha SSH/sudo inválida para este servidor.');
  }
  if (result.code !== 0) {
    const detail = summarize(result.stderr || result.stdout) || `código ${result.code}`;
    throw new ServiceError(502, `Falha ao ${what}: ${detail}`);
  }
}

export async function discoverServices(runner: RemoteRunner): Promise<ServiceInfo[]> {
  const result = await runner.run('bash -s', DISCOVERY_SCRIPT);
  ensureOk(result, 'listar os serviços');
  return parseServiceDiscovery(result.stdout);
}

async function requireOptService(runner: RemoteRunner, rawName: string): Promise<string> {
  const name = normalizeServiceName(rawName);
  if (!name) throw new ServiceError(400, 'Nome de serviço inválido.');

  const services = await discoverServices(runner);
  if (!services.some((s) => s.name === name)) {
    throw new ServiceError(400, `O serviço ${name} não é uma aplicação do /opt neste servidor.`);
  }
  return name;
}

export async function controlService(
  runner: RemoteRunner,
  rawName: string,
  action: ServiceAction,
): Promise<ServiceInfo> {
  const name = await requireOptService(runner, rawName);
  ensureOk(await runner.sudo(`systemctl ${action} ${name}`), `${ACTION_LABELS[action]} ${name}`);

  const updated = (await discoverServices(runner)).find((s) => s.name === name);
  if (!updated) throw new ServiceError(502, `O serviço ${name} não foi encontrado após ${ACTION_LABELS[action]}.`);
  return updated;
}

export async function readLogs(runner: RemoteRunner, rawName: string, rawLines: unknown): Promise<string> {
  const name = await requireOptService(runner, rawName);
  const lines = normalizeLogLines(rawLines);
  const result = await runner.sudo(`journalctl -u ${name} -n ${lines} --no-pager -o short-iso`);
  ensureOk(result, `ler os logs de ${name}`);
  return result.stdout;
}
