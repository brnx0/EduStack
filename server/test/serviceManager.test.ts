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
