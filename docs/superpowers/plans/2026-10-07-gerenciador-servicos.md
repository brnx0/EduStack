# Gerenciador de Serviços (/opt) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** criar a tela "Serviços", que lista os serviços systemd das aplicações em `/opt` de um servidor cadastrado, permite iniciar, parar e reiniciar esses serviços, mostra os logs do `journalctl` e registra quem fez cada ação.

**Arquitetura:** o backend Express abre uma conexão SSH (`ssh2`) por chamada e executa um script de descoberta (`systemctl list-units`, `list-unit-files` e `show`), `sudo systemctl <ação>` ou `sudo journalctl`. A lógica fica em módulos puros e testáveis (`serviceDiscovery.ts`) e num orquestrador que recebe um executor injetável (`serviceManager.ts`). O frontend Vue tem uma view nova e um composable.

**Stack:** Node 24, TypeScript 5.9 (ESM, `nodenext`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`), Express 5, `ssh2`, Vue 3 + Tailwind 4, test runner nativo do Node com `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-07-gerenciador-servicos-design.md`

**Commits:** este repositório só recebe commits quando o usuário pede. Não há passos de commit; ao terminar cada tarefa, informe o que mudou.

## Restrições globais

- Acesso: qualquer usuário logado. As rotas ficam atrás do `authMiddleware`, sem `adminMiddleware`.
- Só é permitido agir em serviços que a descoberta retornou, ou seja, que referenciam `/opt/`.
- Nome de serviço válido: `^[A-Za-z0-9@._-]+$`, terminando em `.service` (o sufixo é acrescentado se faltar) e sem começar com `-`.
- Quantidades de linhas de log permitidas: 100, 500 e 1000, com padrão 500.
- A senha do sudo nunca aparece no texto do comando. Ela vai pelo stdin com `sudo -S -p ''`.
- Timeout de cada chamada SSH: 30 s. Timeout de conexão: 15 s.
- A auditoria fica em `data/service-actions.json` (via `jsonStorage`).
- Nenhuma resposta da API pode incluir `senhaSsh`.
- Não adicionar dependências de produção. Testes com `node --import tsx --test`.
- Os textos visíveis para o usuário ficam em português.

## Foco de revisão

1. **Serviço parado sumindo da lista:** depois de "Parar", o serviço deve continuar listado como "Parado". Por isso a descoberta une `list-units --all` com `list-unit-files` (teste na Tarefa 1).
2. **Nome com caracteres de shell na URL** (`x;reboot`, `$(id)`, espaço, nome começando com `-`): deve retornar 400 sem executar nada no servidor (testes nas Tarefas 1 e 3).
3. **Senha de sudo errada:** deve aparecer "Senha SSH/sudo inválida para este servidor.", e não um erro genérico (testes nas Tarefas 1 e 3).
4. **Servidor fora do ar ou lento:** a resposta deve ser 502 em até cerca de 30 s, e a tela continua utilizável, com a mensagem de erro (timeout na Tarefa 2 e tratamento na Tarefa 4).
5. **Servidor sem nenhum serviço no `/opt`:** a tela mostra o estado vazio "Nenhum serviço do /opt encontrado neste servidor.", sem erro (teste do parser na Tarefa 1 e estado vazio na Tarefa 5).

---

### Tarefa 1: descoberta e validações (módulo puro)

**Arquivos:**
- Criar: `server/src/services/serviceDiscovery.ts`
- Criar: `server/test/serviceDiscovery.test.ts`
- Modificar: `server/package.json` (script `test`)

**Interfaces:**
- Consome: nada.
- Produz:
  - `type ServiceInfo = { name: string; description: string; activeState: string; subState: string; mainPid: number | null; since: string | null; workingDirectory: string | null; execPath: string | null }`
  - `const SYSV_MARKER: string`, `const DISCOVERY_SCRIPT: string`
  - `parseServiceDiscovery(output: string): ServiceInfo[]`
  - `normalizeServiceName(raw: string): string | null`
  - `const LOG_LINE_OPTIONS: readonly number[]`, `normalizeLogLines(raw: unknown): number`
  - `isSudoAuthFailure(stderr: string): boolean`

- [ ] **Passo 1: adicionar o script de teste em `server/package.json`**

Em `"scripts"`, acrescente:

```json
    "test": "node --import tsx --test test/*.test.ts"
```

- [ ] **Passo 2: escrever os testes (devem falhar)**

`server/test/serviceDiscovery.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseServiceDiscovery,
  normalizeServiceName,
  normalizeLogLines,
  isSudoAuthFailure,
  SYSV_MARKER,
  DISCOVERY_SCRIPT,
} from '../src/services/serviceDiscovery.js';

const SAMPLE = [
  'Id=maracas.service',
  'Description=Maracas',
  'LoadState=loaded',
  'ActiveState=active',
  'SubState=running',
  'MainPID=1234',
  'ActiveEnterTimestamp=Tue 2026-10-06 10:00:00 -03',
  'ExecStart={ path=/opt/maracas/bin/start.sh ; argv[]=/opt/maracas/bin/start.sh ; ignore_errors=no ; start_time=[n/a] ; stop_time=[n/a] ; pid=0 ; code=(null) ; status=0/0 }',
  'WorkingDirectory=/opt/maracas',
  'FragmentPath=/etc/systemd/system/maracas.service',
  'SourcePath=',
  '',
  'Id=sshd.service',
  'Description=OpenSSH server daemon',
  'LoadState=loaded',
  'ActiveState=active',
  'SubState=running',
  'MainPID=800',
  'ActiveEnterTimestamp=Mon 2026-10-05 08:00:00 -03',
  'ExecStart={ path=/usr/sbin/sshd ; argv[]=/usr/sbin/sshd -D ; ignore_errors=no ; start_time=[n/a] ; stop_time=[n/a] ; pid=0 ; code=(null) ; status=0/0 }',
  'WorkingDirectory=',
  'FragmentPath=/usr/lib/systemd/system/sshd.service',
  'SourcePath=',
  '',
  'Id=tomcat.service',
  'Description=LSB: Tomcat',
  'LoadState=loaded',
  'ActiveState=inactive',
  'SubState=dead',
  'MainPID=0',
  'ActiveEnterTimestamp=',
  'ExecStart={ path=/etc/init.d/tomcat ; argv[]=/etc/init.d/tomcat start ; ignore_errors=no ; start_time=[n/a] ; stop_time=[n/a] ; pid=0 ; code=(null) ; status=0/0 }',
  'WorkingDirectory=',
  'FragmentPath=',
  'SourcePath=/etc/init.d/tomcat',
  '',
  'Id=ghost.service',
  'Description=ghost.service',
  'LoadState=not-found',
  'ActiveState=inactive',
  'SubState=dead',
  'MainPID=0',
  'ActiveEnterTimestamp=',
  'ExecStart=',
  'WorkingDirectory=/opt/ghost',
  'FragmentPath=',
  'SourcePath=',
  SYSV_MARKER,
  '/etc/init.d/tomcat',
  '',
].join('\n');

test('mantém só serviços do /opt (systemd e SysV) e ignora not-found', () => {
  const services = parseServiceDiscovery(SAMPLE);
  assert.deepEqual(services.map((s) => s.name), ['maracas.service', 'tomcat.service']);
});

test('preenche os campos do serviço ativo', () => {
  const maracas = parseServiceDiscovery(SAMPLE).find((s) => s.name === 'maracas.service');
  assert.deepEqual(maracas, {
    name: 'maracas.service',
    description: 'Maracas',
    activeState: 'active',
    subState: 'running',
    mainPid: 1234,
    since: 'Tue 2026-10-06 10:00:00 -03',
    workingDirectory: '/opt/maracas',
    execPath: '/opt/maracas/bin/start.sh',
  });
});

test('serviço parado continua listado, sem PID e sem "desde"', () => {
  const tomcat = parseServiceDiscovery(SAMPLE).find((s) => s.name === 'tomcat.service');
  assert.equal(tomcat?.activeState, 'inactive');
  assert.equal(tomcat?.mainPid, null);
  assert.equal(tomcat?.since, null);
  assert.equal(tomcat?.execPath, '/etc/init.d/tomcat');
});

test('servidor sem serviços do /opt retorna lista vazia', () => {
  assert.deepEqual(parseServiceDiscovery(`${SYSV_MARKER}\n`), []);
  assert.deepEqual(parseServiceDiscovery(''), []);
});

test('aceita saída com CRLF', () => {
  assert.equal(parseServiceDiscovery(SAMPLE.replace(/\n/g, '\r\n')).length, 2);
});

test('script de descoberta une list-units e list-unit-files', () => {
  assert.match(DISCOVERY_SCRIPT, /list-units --type=service --all/);
  assert.match(DISCOVERY_SCRIPT, /list-unit-files --type=service/);
  assert.ok(DISCOVERY_SCRIPT.includes(SYSV_MARKER));
});

test('normalizeServiceName acrescenta .service e rejeita nomes perigosos', () => {
  assert.equal(normalizeServiceName('maracas'), 'maracas.service');
  assert.equal(normalizeServiceName('tomcat@app.service'), 'tomcat@app.service');
  assert.equal(normalizeServiceName('x;reboot'), null);
  assert.equal(normalizeServiceName('$(id)'), null);
  assert.equal(normalizeServiceName('a b'), null);
  assert.equal(normalizeServiceName('-H.service'), null);
  assert.equal(normalizeServiceName(''), null);
});

test('normalizeLogLines aceita só 100/500/1000, padrão 500', () => {
  assert.equal(normalizeLogLines('100'), 100);
  assert.equal(normalizeLogLines(1000), 1000);
  assert.equal(normalizeLogLines('99999'), 500);
  assert.equal(normalizeLogLines(undefined), 500);
  assert.equal(normalizeLogLines('abc'), 500);
});

test('isSudoAuthFailure reconhece senha errada', () => {
  assert.equal(isSudoAuthFailure('Sorry, try again.\nsudo: 1 incorrect password attempt'), true);
  assert.equal(isSudoAuthFailure('sudo: a password is required'), true);
  assert.equal(isSudoAuthFailure('Job for x.service failed'), false);
});
```

- [ ] **Passo 3: rodar e confirmar que falha**

Execute: `cd server && npm test`
Esperado: FALHA com erro de módulo não encontrado (`serviceDiscovery.js`).

- [ ] **Passo 4: implementar `server/src/services/serviceDiscovery.ts`**

```ts
export type ServiceInfo = {
  name: string;
  description: string;
  activeState: string;
  subState: string;
  mainPid: number | null;
  since: string | null;
  workingDirectory: string | null;
  execPath: string | null;
};

export const SYSV_MARKER = '@@EDUSTACK_SYSV@@';

const SHOW_PROPERTIES =
  'Id,Description,LoadState,ActiveState,SubState,MainPID,ActiveEnterTimestamp,ExecStart,WorkingDirectory,FragmentPath,SourcePath';

// Executado com "bash -s" (o script vai pelo stdin). Não precisa de sudo.
// list-unit-files garante que serviços parados e não carregados continuem aparecendo.
export const DISCOVERY_SCRIPT = `
UNITS=$( { systemctl list-units --type=service --all --no-legend --plain 2>/dev/null | awk '{print $1}'; systemctl list-unit-files --type=service --no-legend 2>/dev/null | awk '{print $1}'; } | grep -E '\\.service$' | grep -v '@\\.service$' | sort -u )
if [ -n "$UNITS" ]; then
  systemctl show $UNITS --no-pager -p ${SHOW_PROPERTIES}
fi
echo "${SYSV_MARKER}"
grep -l '/opt/' /etc/init.d/* 2>/dev/null || true
`;

const OPT = '/opt/';

function parseBlocks(text: string): Record<string, string>[] {
  return text
    .split(/\r?\n[ \t]*\r?\n/)
    .map((block) => {
      const record: Record<string, string> = {};
      for (const line of block.split(/\r?\n/)) {
        const eq = line.indexOf('=');
        if (eq > 0) record[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
      }
      return record;
    })
    .filter((record) => Boolean(record['Id']));
}

function extractExecPath(execStart: string): string | null {
  return /path=([^\s;]+)/.exec(execStart)?.[1] ?? null;
}

export function parseServiceDiscovery(output: string): ServiceInfo[] {
  const [showPart = '', sysvPart = ''] = output.split(SYSV_MARKER);
  const sysvScripts = new Set(
    sysvPart.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
  );

  const services: ServiceInfo[] = [];
  for (const record of parseBlocks(showPart)) {
    if (record['LoadState'] === 'not-found') continue;

    const execStart = record['ExecStart'] ?? '';
    const workingDirectory = record['WorkingDirectory'] || null;
    const underOpt =
      execStart.includes(OPT) ||
      (workingDirectory?.includes(OPT) ?? false) ||
      (record['FragmentPath'] ?? '').includes(OPT) ||
      sysvScripts.has(record['SourcePath'] ?? '');
    if (!underOpt) continue;

    const pid = Number(record['MainPID']);
    const since = record['ActiveEnterTimestamp'];
    services.push({
      name: record['Id'] as string,
      description: record['Description'] ?? '',
      activeState: record['ActiveState'] ?? 'unknown',
      subState: record['SubState'] ?? '',
      mainPid: Number.isFinite(pid) && pid > 0 ? pid : null,
      since: since && since !== 'n/a' ? since : null,
      workingDirectory,
      execPath: extractExecPath(execStart),
    });
  }

  return services.sort((a, b) => a.name.localeCompare(b.name));
}

const SERVICE_NAME = /^[A-Za-z0-9@._-]+$/;

export function normalizeServiceName(raw: string): string | null {
  if (!raw) return null;
  const name = raw.endsWith('.service') ? raw : `${raw}.service`;
  if (name.startsWith('-') || !SERVICE_NAME.test(name)) return null;
  return name;
}

export const LOG_LINE_OPTIONS: readonly number[] = [100, 500, 1000];

export function normalizeLogLines(raw: unknown): number {
  const value = Number(raw);
  return LOG_LINE_OPTIONS.includes(value) ? value : 500;
}

export function isSudoAuthFailure(stderr: string): boolean {
  return /incorrect password|sorry, try again|a password is required/i.test(stderr);
}
```

- [ ] **Passo 5: rodar e confirmar que passa**

Execute: `cd server && npm test`
Esperado: todos os testes de `serviceDiscovery.test.ts` em PASS.

- [ ] **Passo 6: checar tipos**

Execute: `cd server && npx tsc --noEmit`
Esperado: sem erros.

---

### Tarefa 2: execução remota com stdin, timeout e sudo

**Arquivos:**
- Modificar: `server/src/services/sshService.ts` (exportar `SSHConfig` e acrescentar `runRemote`/`runSudo` no fim do arquivo; as funções existentes não mudam)

**Interfaces:**
- Consome: nada.
- Produz:
  - `export interface SSHConfig { host: string; port: number; username: string; password: string }`
  - `export type RemoteResult = { code: number; stdout: string; stderr: string }`
  - `runRemote(config: SSHConfig, command: string, options?: { stdin?: string; timeoutMs?: number }): Promise<RemoteResult>`. Rejeita apenas em erro de conexão ou timeout; código de saída diferente de zero volta como resultado.
  - `runSudo(config: SSHConfig, command: string, options?: { timeoutMs?: number }): Promise<RemoteResult>`

Esta tarefa não tem teste automatizado, porque depende de um servidor SSH real. Ela é coberta pelos testes da Tarefa 3, que usam um executor falso, e pela verificação manual da Tarefa 6.

- [ ] **Passo 1: exportar a interface**

Em `server/src/services/sshService.ts`, troque `interface SSHConfig {` por `export interface SSHConfig {`.

- [ ] **Passo 2: acrescentar as funções no fim do arquivo**

```ts
export type RemoteResult = { code: number; stdout: string; stderr: string };

/**
 * Executa um comando e devolve código de saída, stdout e stderr.
 * Só rejeita em erro de conexão ou timeout; código de saída ≠ 0 é devolvido para quem chamou decidir.
 */
export function runRemote(
  config: SSHConfig,
  command: string,
  options: { stdin?: string; timeoutMs?: number } = {},
): Promise<RemoteResult> {
  const timeoutMs = options.timeoutMs ?? 30_000;

  return new Promise((resolve, reject) => {
    const conn = new Client();
    let settled = false;

    const finish = (done: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      conn.end();
      done();
    };

    const timer = setTimeout(
      () => finish(() => reject(new Error(`tempo esgotado após ${Math.round(timeoutMs / 1000)}s`))),
      timeoutMs,
    );

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) return finish(() => reject(err));
        let stdout = '';
        let stderr = '';
        stream.on('data', (data: Buffer) => { stdout += data.toString(); });
        stream.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
        stream.on('close', (code: number | null) =>
          finish(() => resolve({ code: code ?? -1, stdout, stderr })),
        );
        if (options.stdin !== undefined) stream.end(options.stdin);
        else stream.end();
      });
    });
    conn.on('error', (err) => finish(() => reject(err)));
    conn.connect({ ...config, readyTimeout: Math.min(timeoutMs, 15_000) });
  });
}

/** Executa com sudo enviando a senha pelo stdin (nunca no texto do comando). */
export function runSudo(
  config: SSHConfig,
  command: string,
  options: { timeoutMs?: number } = {},
): Promise<RemoteResult> {
  return runRemote(config, `sudo -S -p '' ${command}`, { ...options, stdin: `${config.password}\n` });
}
```

- [ ] **Passo 3: checar tipos**

Execute: `cd server && npx tsc --noEmit`
Esperado: sem erros. Se o `ssh2` reclamar do tipo de `code` no `close`, use `(code: number | null | undefined)`.

---

### Tarefa 3: orquestrador do serviço (`serviceManager`)

**Arquivos:**
- Criar: `server/src/services/serviceManager.ts`
- Criar: `server/test/serviceManager.test.ts`

**Interfaces:**
- Consome: Tarefa 1 (`DISCOVERY_SCRIPT`, `parseServiceDiscovery`, `normalizeServiceName`, `normalizeLogLines`, `isSudoAuthFailure`, `ServiceInfo`) e Tarefa 2 (`runRemote`, `runSudo`, `SSHConfig`, `RemoteResult`).
- Produz:
  - `class ServiceError extends Error { status: number }`
  - `type ServiceAction = 'start' | 'stop' | 'restart'`, `isServiceAction(value: string): value is ServiceAction`
  - `type RemoteRunner = { run(command: string, stdin?: string): Promise<RemoteResult>; sudo(command: string): Promise<RemoteResult> }`
  - `sshRunner(config: SSHConfig): RemoteRunner`
  - `discoverServices(runner: RemoteRunner): Promise<ServiceInfo[]>`
  - `controlService(runner: RemoteRunner, rawName: string, action: ServiceAction): Promise<ServiceInfo>`
  - `readLogs(runner: RemoteRunner, rawName: string, rawLines: unknown): Promise<string>`

- [ ] **Passo 1: escrever os testes (devem falhar)**

`server/test/serviceManager.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  controlService,
  discoverServices,
  readLogs,
  ServiceError,
  isServiceAction,
  type RemoteRunner,
} from '../src/services/serviceManager.js';
import { SYSV_MARKER } from '../src/services/serviceDiscovery.js';
import type { RemoteResult } from '../src/services/sshService.js';

function discoveryOutput(activeState: string) {
  return [
    'Id=maracas.service',
    'Description=Maracas',
    'LoadState=loaded',
    `ActiveState=${activeState}`,
    'SubState=running',
    'MainPID=10',
    'ActiveEnterTimestamp=',
    'ExecStart={ path=/opt/maracas/start.sh ; argv[]=/opt/maracas/start.sh }',
    'WorkingDirectory=/opt/maracas',
    'FragmentPath=/etc/systemd/system/maracas.service',
    'SourcePath=',
    SYSV_MARKER,
    '',
  ].join('\n');
}

function fakeRunner(sudoResult: RemoteResult = { code: 0, stdout: '', stderr: '' }) {
  const sudoCalls: string[] = [];
  let runCalls = 0;
  const runner: RemoteRunner = {
    async run(command, stdin) {
      runCalls++;
      assert.equal(command, 'bash -s');
      assert.ok(stdin && stdin.includes('systemctl'));
      return { code: 0, stdout: discoveryOutput(sudoCalls.length > 0 ? 'inactive' : 'active'), stderr: '' };
    },
    async sudo(command) {
      sudoCalls.push(command);
      return sudoResult;
    },
  };
  return { runner, sudoCalls, runCount: () => runCalls };
}

test('discoverServices devolve os serviços do /opt', async () => {
  const { runner } = fakeRunner();
  const services = await discoverServices(runner);
  assert.deepEqual(services.map((s) => s.name), ['maracas.service']);
});

test('controlService executa systemctl e devolve o estado novo', async () => {
  const { runner, sudoCalls } = fakeRunner();
  const info = await controlService(runner, 'maracas', 'stop');
  assert.deepEqual(sudoCalls, ['systemctl stop maracas.service']);
  assert.equal(info.activeState, 'inactive');
});

test('controlService recusa serviço fora do /opt sem executar nada', async () => {
  const { runner, sudoCalls } = fakeRunner();
  await assert.rejects(controlService(runner, 'sshd', 'stop'), (err: unknown) =>
    err instanceof ServiceError && err.status === 400,
  );
  assert.deepEqual(sudoCalls, []);
});

test('controlService recusa nome com caracteres de shell sem conectar', async () => {
  const { runner, sudoCalls, runCount } = fakeRunner();
  for (const bad of ['x;reboot', '$(id)', 'a b', '-H']) {
    await assert.rejects(controlService(runner, bad, 'restart'), (err: unknown) =>
      err instanceof ServiceError && err.status === 400,
    );
  }
  assert.deepEqual(sudoCalls, []);
  assert.equal(runCount(), 0);
});

test('senha de sudo errada vira mensagem clara', async () => {
  const { runner } = fakeRunner({ code: 1, stdout: '', stderr: 'Sorry, try again.\nsudo: 1 incorrect password attempt' });
  await assert.rejects(controlService(runner, 'maracas', 'restart'), (err: unknown) =>
    err instanceof ServiceError && err.status === 502 && /Senha SSH\/sudo inválida/.test(err.message),
  );
});

test('falha do systemctl vira 502 com o stderr resumido', async () => {
  const { runner } = fakeRunner({ code: 1, stdout: '', stderr: 'Job for maracas.service failed because the control process exited with error code.' });
  await assert.rejects(controlService(runner, 'maracas', 'start'), (err: unknown) =>
    err instanceof ServiceError && err.status === 502 && /Job for maracas.service failed/.test(err.message),
  );
});

test('readLogs usa journalctl com linhas normalizadas', async () => {
  const { runner, sudoCalls } = fakeRunner({ code: 0, stdout: 'linha 1\nlinha 2\n', stderr: '' });
  const log = await readLogs(runner, 'maracas.service', '99999');
  assert.equal(log, 'linha 1\nlinha 2\n');
  assert.deepEqual(sudoCalls, ['journalctl -u maracas.service -n 500 --no-pager -o short-iso']);
});

test('isServiceAction só aceita start/stop/restart', () => {
  assert.equal(isServiceAction('start'), true);
  assert.equal(isServiceAction('enable'), false);
  assert.equal(isServiceAction('toString'), false);
});
```

- [ ] **Passo 2: rodar e confirmar que falha**

Execute: `cd server && npm test`
Esperado: FALHA com módulo `serviceManager.js` não encontrado.

- [ ] **Passo 3: implementar `server/src/services/serviceManager.ts`**

```ts
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
```

- [ ] **Passo 4: rodar e confirmar que passa**

Execute: `cd server && npm test`
Esperado: todos os testes das Tarefas 1 e 3 em PASS.

- [ ] **Passo 5: checar tipos**

Execute: `cd server && npx tsc --noEmit`
Esperado: sem erros.

---

### Tarefa 4: auditoria, controller e rotas

**Arquivos:**
- Criar: `server/src/services/serviceAudit.ts`
- Criar: `server/src/controllers/servicesController.ts`
- Criar: `server/src/routes/services.ts`
- Modificar: `server/src/index.ts` (montar as rotas)

**Interfaces:**
- Consome: Tarefa 3 (`sshRunner`, `discoverServices`, `controlService`, `readLogs`, `ServiceError`, `isServiceAction`) e `jsonStorage` (`findAll`, `findById`, `create`, `readCollection`).
- Produz (HTTP, todas sob `/api` com `authMiddleware`):
  - `GET /api/service-servers` → `{ id, nome, ip }[]`
  - `GET /api/servers/:id/services` → `ServiceInfo[]`
  - `POST /api/servers/:id/services/:name/:action` (`start|stop|restart`) → `ServiceInfo`
  - `GET /api/servers/:id/services/:name/logs?lines=500` → `{ log: string }`
  - `GET /api/service-actions?limit=20` → `ServiceActionRecord[]` (mais recentes primeiro)

- [ ] **Passo 1: criar `server/src/services/serviceAudit.ts`**

```ts
import { create, readCollection } from './jsonStorage.js';

const COLLECTION = 'service-actions';

export type ServiceActionRecord = {
  id: number;
  criadoEm: string;
  userId: string | number | null;
  userLogin: string;
  serverId: number;
  serverName: string;
  service: string;
  action: string;
  success: boolean;
  message: string;
};

export function recordAction(entry: Omit<ServiceActionRecord, 'id' | 'criadoEm'>): ServiceActionRecord {
  return create(COLLECTION, entry) as ServiceActionRecord;
}

export function listActions(limit = 50): ServiceActionRecord[] {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 50, 1), 200);
  return (readCollection(COLLECTION) as ServiceActionRecord[]).slice(-safeLimit).reverse();
}
```

- [ ] **Passo 2: criar `server/src/controllers/servicesController.ts`**

```ts
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

function errorMessage(err: unknown, server?: StoredServer): string {
  if (err instanceof ServiceError) return err.message;
  const where = server ? ` ${server.nome} (${server.ip})` : '';
  return `Não foi possível conectar ao servidor${where}: ${err instanceof Error ? err.message : String(err)}`;
}

function sendError(res: Response, err: unknown, server?: StoredServer) {
  const status = err instanceof ServiceError ? err.status : 502;
  res.status(status).json({ error: errorMessage(err, server) });
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
```

- [ ] **Passo 3: criar `server/src/routes/services.ts`**

```ts
import { Router } from 'express';
import {
  listServiceServers,
  listServices,
  runServiceAction,
  getServiceLogs,
  getServiceActions,
} from '../controllers/servicesController.js';

const router = Router();

router.get('/service-servers', listServiceServers);
router.get('/service-actions', getServiceActions);
router.get('/servers/:id/services', listServices);
router.get('/servers/:id/services/:name/logs', getServiceLogs);
router.post('/servers/:id/services/:name/:action', runServiceAction);

export default router;
```

- [ ] **Passo 4: montar em `server/src/index.ts`**

Acrescente o import junto aos outros:

```ts
import serviceRoutes from './routes/services.js';
```

E logo após `app.use('/api/jar', authMiddleware, jarGeneratorRoutes);`:

```ts
app.use('/api', authMiddleware, serviceRoutes);
```

- [ ] **Passo 5: checar tipos e testes**

Execute: `cd server && npx tsc --noEmit && npm test`
Esperado: sem erros de tipo e todos os testes em PASS.

- [ ] **Passo 6: teste rápido de fumaça (sem SSH)**

Com o server rodando (`npm run dev` em `server`), confirme que as rotas exigem login:

Execute: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/service-servers`
Esperado: `401`.

---

### Tarefa 5: tela "Serviços" (frontend)

**Arquivos:**
- Criar: `client/src/composables/useServices.ts`
- Criar: `client/src/views/Services/ServicesView.vue`
- Modificar: `client/src/router/index.ts` (rota `/servicos`)
- Modificar: `client/src/App.vue` (item do menu e ícone `server`)

**Interfaces:**
- Consome: rotas HTTP da Tarefa 4 e `authFetch` de `client/src/composables/useAuth.ts`.
- Produz: rota `/servicos` com o componente `ServicesView`, que recebe a prop `isDark: boolean` (passada pelo `App.vue` a todas as views).

- [ ] **Passo 1: criar `client/src/composables/useServices.ts`**

```ts
import { ref } from 'vue';
import { authFetch } from './useAuth';

const API_BASE = '/api';

export type ServiceServer = { id: number; nome: string; ip: string };

export type ServiceInfo = {
  name: string;
  description: string;
  activeState: string;
  subState: string;
  mainPid: number | null;
  since: string | null;
  workingDirectory: string | null;
  execPath: string | null;
};

export type ServiceAction = 'start' | 'stop' | 'restart';

export type ServiceActionRecord = {
  id: number;
  criadoEm: string;
  userLogin: string;
  serverName: string;
  service: string;
  action: string;
  success: boolean;
  message: string;
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error || `Erro ${res.status}`);
  return body as T;
}

export function useServices() {
  const servers = ref<ServiceServer[]>([]);
  const services = ref<ServiceInfo[]>([]);
  const actions = ref<ServiceActionRecord[]>([]);
  const loadingServices = ref(false);
  const busyService = ref<string | null>(null);
  const error = ref<string | null>(null);
  let servicesRequest = 0;

  async function fetchServers() {
    try {
      servers.value = await request<ServiceServer[]>(`${API_BASE}/service-servers`);
    } catch (e: any) {
      error.value = e.message;
    }
  }

  async function fetchServices(serverId: number) {
    const current = ++servicesRequest;
    loadingServices.value = true;
    error.value = null;
    services.value = [];
    try {
      const result = await request<ServiceInfo[]>(`${API_BASE}/servers/${serverId}/services`);
      if (current === servicesRequest) services.value = result;
    } catch (e: any) {
      if (current === servicesRequest) error.value = e.message;
    } finally {
      if (current === servicesRequest) loadingServices.value = false;
    }
  }

  async function fetchActions() {
    actions.value = await request<ServiceActionRecord[]>(`${API_BASE}/service-actions?limit=20`);
  }

  async function runAction(serverId: number, name: string, action: ServiceAction) {
    busyService.value = name;
    error.value = null;
    try {
      const updated = await request<ServiceInfo>(
        `${API_BASE}/servers/${serverId}/services/${encodeURIComponent(name)}/${action}`,
        { method: 'POST' },
      );
      services.value = services.value.map((s) => (s.name === name ? updated : s));
    } catch (e: any) {
      error.value = e.message;
    } finally {
      busyService.value = null;
      fetchActions().catch(() => {});
    }
  }

  async function fetchLogs(serverId: number, name: string, lines: number): Promise<string> {
    const result = await request<{ log: string }>(
      `${API_BASE}/servers/${serverId}/services/${encodeURIComponent(name)}/logs?lines=${lines}`,
    );
    return result.log;
  }

  return {
    servers,
    services,
    actions,
    loadingServices,
    busyService,
    error,
    fetchServers,
    fetchServices,
    fetchActions,
    runAction,
    fetchLogs,
  };
}
```

- [ ] **Passo 2: criar `client/src/views/Services/ServicesView.vue`**

```vue
<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useServices, type ServiceInfo, type ServiceAction } from '../../composables/useServices'

defineProps<{ isDark: boolean }>()

const {
  servers,
  services,
  actions,
  loadingServices,
  busyService,
  error,
  fetchServers,
  fetchServices,
  fetchActions,
  runAction,
  fetchLogs,
} = useServices()

const SERVER_KEY = 'edustack:services-server'
const selectedServerId = ref<number | null>(null)
const search = ref('')
const showActions = ref(false)

function normalize(text: unknown) {
  return String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

const filteredServices = computed(() => {
  const term = normalize(search.value)
  if (!term) return services.value
  return services.value.filter(s => normalize(s.name).includes(term) || normalize(s.description).includes(term))
})

onMounted(async () => {
  await fetchServers()
  let saved: number | null = null
  try { saved = Number(localStorage.getItem(SERVER_KEY)) || null } catch { /* sem preferência */ }
  const initial = servers.value.find(s => s.id === saved) ?? servers.value[0]
  if (initial) selectedServerId.value = initial.id
  fetchActions().catch(() => {})
})

watch(selectedServerId, id => {
  if (id === null) return
  try { localStorage.setItem(SERVER_KEY, String(id)) } catch { /* preferência opcional */ }
  closeLogs()
  search.value = ''
  fetchServices(id)
})

function refresh() {
  if (selectedServerId.value !== null) fetchServices(selectedServerId.value)
}

// ── Estado ───────────────────────────────────────────────────────────────────
function isRunning(s: ServiceInfo) {
  return s.activeState === 'active' || s.activeState === 'activating' || s.activeState === 'reloading'
}

function stateLabel(s: ServiceInfo) {
  switch (s.activeState) {
    case 'active': return 'Ativo'
    case 'activating': return 'Iniciando'
    case 'deactivating': return 'Parando'
    case 'failed': return 'Falhou'
    default: return 'Parado'
  }
}

function stateClass(s: ServiceInfo, dark: boolean) {
  if (s.activeState === 'failed') return dark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'
  if (isRunning(s)) return dark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
  return dark ? 'bg-zinc-500/10 text-zinc-400' : 'bg-zinc-100 text-zinc-500'
}

function formatSince(since: string | null) {
  return since ? since.replace(/^[A-Za-z]{3} /, '') : '—'
}

// ── Ações ────────────────────────────────────────────────────────────────────
const ACTION_LABELS: Record<ServiceAction, string> = { start: 'Iniciar', stop: 'Parar', restart: 'Reiniciar' }
const pendingAction = ref<{ service: ServiceInfo; action: ServiceAction } | null>(null)

function requestAction(service: ServiceInfo, action: ServiceAction) {
  if (action === 'start') {
    execute(service, action)
    return
  }
  pendingAction.value = { service, action }
}

async function confirmAction() {
  const pending = pendingAction.value
  pendingAction.value = null
  if (pending) await execute(pending.service, pending.action)
}

async function execute(service: ServiceInfo, action: ServiceAction) {
  if (selectedServerId.value === null) return
  await runAction(selectedServerId.value, service.name, action)
}

// ── Logs ─────────────────────────────────────────────────────────────────────
const LOG_LINE_OPTIONS = [100, 500, 1000]
const logService = ref<ServiceInfo | null>(null)
const logText = ref('')
const logLines = ref(500)
const logLoading = ref(false)
const logError = ref<string | null>(null)
const autoRefresh = ref(false)
const logBox = ref<HTMLElement | null>(null)
let logTimer: ReturnType<typeof setInterval> | null = null
let logRequest = 0

async function loadLogs() {
  const service = logService.value
  const serverId = selectedServerId.value
  if (!service || serverId === null) return
  const current = ++logRequest
  logLoading.value = true
  logError.value = null
  try {
    const text = await fetchLogs(serverId, service.name, logLines.value)
    if (current !== logRequest) return
    logText.value = text
    await nextTick()
    if (logBox.value) logBox.value.scrollTop = logBox.value.scrollHeight
  } catch (e: any) {
    if (current === logRequest) logError.value = e.message
  } finally {
    if (current === logRequest) logLoading.value = false
  }
}

function openLogs(service: ServiceInfo) {
  logService.value = service
  logText.value = ''
  loadLogs()
}

function closeLogs() {
  logService.value = null
  autoRefresh.value = false
  logRequest++
}

watch(logLines, () => loadLogs())

watch(autoRefresh, on => {
  if (logTimer) { clearInterval(logTimer); logTimer = null }
  if (on) logTimer = setInterval(() => { if (!logLoading.value) loadLogs() }, 5000)
})

onBeforeUnmount(() => { if (logTimer) clearInterval(logTimer) })
</script>

<template>
  <div class="h-full overflow-y-auto p-6" :class="isDark ? 'text-zinc-100' : 'text-zinc-800'">

    <!-- Cabeçalho -->
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 class="text-lg font-semibold" :class="isDark ? 'text-white' : 'text-zinc-900'">Serviços</h2>
        <p class="text-xs mt-0.5" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
          Aplicações em /opt do servidor selecionado.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <select
          v-model="selectedServerId"
          class="rounded-lg border px-3 py-2 text-sm outline-none"
          :class="isDark ? 'border-white/[.06] bg-zinc-800 text-zinc-100' : 'border-zinc-200 bg-white text-zinc-800'"
        >
          <option v-if="servers.length === 0" :value="null" disabled>Nenhum servidor cadastrado</option>
          <option v-for="s in servers" :key="s.id" :value="s.id">{{ s.nome }} ({{ s.ip }})</option>
        </select>
        <button
          @click="refresh"
          :disabled="loadingServices || selectedServerId === null"
          class="rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50"
          :class="isDark ? 'border-white/[.06] text-zinc-300 hover:bg-white/[.06]' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-100'"
        >
          Atualizar
        </button>
      </div>
    </div>

    <!-- Erro -->
    <div
      v-if="error"
      class="mb-4 rounded-lg border px-4 py-3 text-sm"
      :class="isDark ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-red-200 bg-red-50 text-red-600'"
    >
      {{ error }}
    </div>

    <!-- Busca -->
    <div v-if="services.length > 0" class="mb-4 flex items-center gap-3">
      <input
        v-model="search"
        type="text"
        placeholder="Buscar por nome ou descrição…"
        class="w-full max-w-sm rounded-lg border px-3 py-2 text-sm outline-none"
        :class="isDark
          ? 'border-white/[.06] bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500/50'
          : 'border-zinc-200 bg-white text-zinc-800 placeholder:text-zinc-400 focus:border-blue-400'"
      />
      <span class="text-xs" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
        {{ filteredServices.length }} de {{ services.length }}
      </span>
    </div>

    <!-- Carregando -->
    <div v-if="loadingServices" class="flex items-center justify-center py-24">
      <div class="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    </div>

    <!-- Vazio -->
    <div
      v-else-if="selectedServerId !== null && services.length === 0 && !error"
      class="py-24 text-center text-sm"
      :class="isDark ? 'text-zinc-500' : 'text-zinc-400'"
    >
      Nenhum serviço do /opt encontrado neste servidor.
    </div>

    <!-- Tabela -->
    <div
      v-else-if="services.length > 0"
      class="overflow-x-auto rounded-xl border"
      :class="isDark ? 'border-white/[.06]' : 'border-zinc-200'"
    >
      <table class="w-full text-left text-sm">
        <thead :class="isDark ? 'bg-zinc-800/60 text-zinc-400' : 'bg-zinc-50 text-zinc-500'">
          <tr class="text-xs uppercase tracking-wide">
            <th class="px-4 py-2 font-semibold">Serviço</th>
            <th class="px-4 py-2 font-semibold">Estado</th>
            <th class="px-4 py-2 font-semibold">PID</th>
            <th class="px-4 py-2 font-semibold">Desde</th>
            <th class="px-4 py-2 font-semibold text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="s in filteredServices"
            :key="s.name"
            class="border-t"
            :class="isDark ? 'border-white/[.06]' : 'border-zinc-100'"
          >
            <td class="px-4 py-3">
              <div class="font-semibold" :class="isDark ? 'text-white' : 'text-zinc-900'">{{ s.name }}</div>
              <div class="text-xs" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
                {{ s.description }}<span v-if="s.workingDirectory"> · {{ s.workingDirectory }}</span>
              </div>
            </td>
            <td class="px-4 py-3">
              <span class="rounded-full px-2 py-0.5 text-[.65rem] font-semibold uppercase" :class="stateClass(s, isDark)">
                {{ stateLabel(s) }}
              </span>
            </td>
            <td class="px-4 py-3 text-xs">{{ s.mainPid ?? '—' }}</td>
            <td class="px-4 py-3 text-xs whitespace-nowrap">{{ formatSince(s.since) }}</td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-1.5">
                <div
                  v-if="busyService === s.name"
                  class="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
                />
                <template v-else>
                  <button
                    v-if="!isRunning(s)"
                    @click="requestAction(s, 'start')"
                    :disabled="busyService !== null"
                    class="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >Iniciar</button>
                  <template v-else>
                    <button
                      @click="requestAction(s, 'restart')"
                      :disabled="busyService !== null"
                      class="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                    >Reiniciar</button>
                    <button
                      @click="requestAction(s, 'stop')"
                      :disabled="busyService !== null"
                      class="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                    >Parar</button>
                  </template>
                </template>
                <button
                  @click="openLogs(s)"
                  class="rounded-md border px-2.5 py-1 text-xs font-semibold"
                  :class="isDark ? 'border-white/[.06] text-zinc-300 hover:bg-white/[.06]' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-100'"
                >Logs</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Últimas ações -->
    <div class="mt-8">
      <button
        @click="showActions = !showActions"
        class="text-xs font-semibold"
        :class="isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-500 hover:text-zinc-800'"
      >
        {{ showActions ? '▾' : '▸' }} Últimas ações ({{ actions.length }})
      </button>
      <ul v-if="showActions" class="mt-2 flex flex-col gap-1 text-xs">
        <li v-if="actions.length === 0" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">Nenhuma ação registrada.</li>
        <li v-for="a in actions" :key="a.id" :class="isDark ? 'text-zinc-400' : 'text-zinc-600'">
          <span :class="a.success ? 'text-emerald-500' : 'text-red-500'">●</span>
          {{ new Date(a.criadoEm).toLocaleString('pt-BR') }} · <strong>{{ a.userLogin }}</strong>
          · {{ a.action }} {{ a.service }} em {{ a.serverName }} — {{ a.message }}
        </li>
      </ul>
    </div>
  </div>

  <Teleport to="body">
    <!-- Confirmação -->
    <div
      v-if="pendingAction"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      @click.self="pendingAction = null"
    >
      <div
        class="w-full max-w-sm rounded-2xl p-5 shadow-2xl"
        :class="isDark ? 'bg-zinc-900 border border-white/[.06] text-zinc-100' : 'bg-white border border-zinc-200 text-zinc-800'"
      >
        <h3 class="text-sm font-semibold">
          {{ ACTION_LABELS[pendingAction.action] }} {{ pendingAction.service.name }}?
        </h3>
        <p class="mt-2 text-xs" :class="isDark ? 'text-zinc-400' : 'text-zinc-500'">
          A aplicação ficará indisponível enquanto o serviço estiver parado ou reiniciando.
        </p>
        <div class="mt-4 flex justify-end gap-2">
          <button
            @click="pendingAction = null"
            class="rounded-lg px-3 py-2 text-xs font-semibold"
            :class="isDark ? 'text-zinc-400 hover:bg-white/[.06]' : 'text-zinc-600 hover:bg-zinc-100'"
          >Cancelar</button>
          <button
            @click="confirmAction"
            class="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500"
          >{{ ACTION_LABELS[pendingAction.action] }}</button>
        </div>
      </div>
    </div>

    <!-- Painel de logs -->
    <div
      v-if="logService"
      class="fixed inset-0 z-50 flex justify-end bg-black/40"
      @click.self="closeLogs"
    >
      <div
        class="flex h-full w-full max-w-3xl flex-col shadow-2xl"
        :class="isDark ? 'bg-zinc-900 border-l border-white/[.06] text-zinc-100' : 'bg-white border-l border-zinc-200 text-zinc-800'"
      >
        <div class="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3" :class="isDark ? 'border-white/[.06]' : 'border-zinc-200'">
          <div>
            <h3 class="text-sm font-semibold">Logs · {{ logService.name }}</h3>
            <p class="text-xs" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">journalctl</p>
          </div>
          <div class="flex items-center gap-2 text-xs">
            <select
              v-model="logLines"
              class="rounded-md border px-2 py-1"
              :class="isDark ? 'border-white/[.06] bg-zinc-800' : 'border-zinc-200 bg-white'"
            >
              <option v-for="n in LOG_LINE_OPTIONS" :key="n" :value="n">{{ n }} linhas</option>
            </select>
            <label class="flex items-center gap-1">
              <input v-model="autoRefresh" type="checkbox" /> A cada 5 s
            </label>
            <button
              @click="loadLogs"
              :disabled="logLoading"
              class="rounded-md border px-2 py-1 font-semibold disabled:opacity-50"
              :class="isDark ? 'border-white/[.06] hover:bg-white/[.06]' : 'border-zinc-200 hover:bg-zinc-100'"
            >Atualizar</button>
            <button
              @click="closeLogs"
              class="rounded-md px-2 py-1 font-semibold"
              :class="isDark ? 'hover:bg-white/[.06]' : 'hover:bg-zinc-100'"
            >Fechar</button>
          </div>
        </div>
        <div v-if="logError" class="mx-5 mt-3 rounded-lg border px-3 py-2 text-xs"
          :class="isDark ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-red-200 bg-red-50 text-red-600'"
        >{{ logError }}</div>
        <pre
          ref="logBox"
          class="flex-1 overflow-auto whitespace-pre-wrap break-all p-5 font-mono text-[.7rem] leading-relaxed"
          :class="isDark ? 'bg-zinc-950 text-zinc-300' : 'bg-zinc-50 text-zinc-700'"
        >{{ logLoading && !logText ? 'Carregando…' : (logText || 'Sem registros.') }}</pre>
      </div>
    </div>
  </Teleport>
</template>
```

- [ ] **Passo 3: registrar a rota em `client/src/router/index.ts`**

Antes da rota `/acesso-negado`, acrescente:

```ts
    {
      path: '/servicos',
      name: 'services',
      component: () => import('../views/Services/ServicesView.vue'),
    },
```

- [ ] **Passo 4: acrescentar o menu em `client/src/App.vue`**

Em `navItems`, depois de `Gerador de JAR`:

```ts
  { label: 'Serviços', href: '/servicos', icon: 'server', adminOnly: false },
```

E, depois do bloco `<svg v-else-if="item.icon === 'monitor'" ...>...</svg>`:

```html
            <svg v-else-if="item.icon === 'server'" class="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="12" height="5" rx="1.2" stroke="currentColor" stroke-width="1.3" />
              <rect x="2" y="9" width="12" height="5" rx="1.2" stroke="currentColor" stroke-width="1.3" />
              <path d="M4.5 4.5h.01M4.5 11.5h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
```

- [ ] **Passo 5: checar tipos**

Execute: `cd client && npx vue-tsc --build`
Esperado: sem erros.

- [ ] **Passo 6: conferir a tela sem servidor real**

Com client (`npm run dev` em `client`) e server rodando, faça login e abra `/servicos`. Confira:
- o menu "Serviços" aparece para usuário não-admin;
- o seletor lista os servidores cadastrados;
- com um servidor inacessível, aparece a mensagem de erro em vermelho (após no máximo cerca de 30 s) e a tela continua usável;
- o tema claro e o escuro ficam legíveis.

---

### Tarefa 6: verificação integrada num servidor real

**Arquivos:** nenhum.

**Interfaces:** consome tudo o que foi feito nas tarefas anteriores.

- [ ] **Passo 1: combinar com o usuário** qual servidor e qual serviço do `/opt` podem ser reiniciados sem impacto.

- [ ] **Passo 2: listar.** Na tela, selecione o servidor e confirme que os serviços do `/opt` aparecem e que serviços do sistema (ex.: `sshd`) não aparecem. Compare com `systemctl list-units --type=service --all` no servidor.

- [ ] **Passo 3: logs.** Abra os logs do serviço combinado, alterne 100/500/1000 e ative "A cada 5 s". Confirme que a atualização para quando o painel é fechado.

- [ ] **Passo 4: reiniciar.** Reinicie o serviço combinado e confirme no servidor com `systemctl status <serviço>` que o PID e o horário mudaram. Confira em "Últimas ações" o registro com o seu login.

- [ ] **Passo 5: parar e iniciar** (só se o usuário autorizar). Confirme que, parado, o serviço continua na lista como "Parado" e volta a "Ativo" depois de iniciar.

- [ ] **Passo 6: checagens finais**

Execute: `cd server && npx tsc --noEmit && npm test` e `cd client && npx vue-tsc --build`
Esperado: tudo sem erros e testes em PASS.
