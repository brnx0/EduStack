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
