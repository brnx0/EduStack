import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// jsonStorage resolve data/ a partir do cwd no carregamento: isola num diretório temporário.
const originalCwd = process.cwd();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'edustack-services-'));
let controller: typeof import('../src/controllers/servicesController.js');

before(async () => {
  fs.mkdirSync(path.join(tmp, 'data'));
  fs.writeFileSync(
    path.join(tmp, 'data', 'servers.json'),
    JSON.stringify([
      { id: 1, nome: 'PROD', ip: '10.0.0.1', portaSsh: 22, usuarioSsh: 'u', senhaSsh: 'segredo', ativo: true },
      { id: 2, nome: 'ANTIGO', ip: '10.0.0.2', portaSsh: 22, usuarioSsh: 'u', senhaSsh: 'x', ativo: false },
    ]),
  );
  process.chdir(tmp);
  controller = await import('../src/controllers/servicesController.js');
});

after(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
});

function fakeRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (body: unknown) => { res.body = body; return res; };
  return res;
}

test('service-servers lista só ativos e nunca expõe a senha', () => {
  const res = fakeRes();
  controller.listServiceServers({} as any, res);
  assert.deepEqual(res.body, [{ id: 1, nome: 'PROD', ip: '10.0.0.1' }]);
  assert.ok(!JSON.stringify(res.body).includes('segredo'));
});

test('servidor inexistente ou inativo devolve 404', async () => {
  for (const id of ['99', '2', 'abc']) {
    const res = fakeRes();
    await controller.listServices({ params: { id } } as any, res);
    assert.equal(res.statusCode, 404, `id ${id}`);
  }
});

test('ação inválida devolve 400 e fica registrada na auditoria', async () => {
  const res = fakeRes();
  await controller.runServiceAction(
    { params: { id: '1', name: 'maracas', action: 'enable' }, user: { id: 7, login: 'breno' } } as any,
    res,
  );
  assert.equal(res.statusCode, 400);

  const audit = JSON.parse(fs.readFileSync(path.join(tmp, 'data', 'service-actions.json'), 'utf8'));
  assert.equal(audit.length, 1);
  assert.equal(audit[0].userLogin, 'breno');
  assert.equal(audit[0].success, false);
  assert.equal(audit[0].action, 'enable');
});

test('service-actions devolve as mais recentes primeiro', () => {
  const res = fakeRes();
  controller.getServiceActions({ query: { limit: '5' } } as any, res);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].userLogin, 'breno');
});

test('senha SSH errada (falha na autenticação) vira mensagem de senha inválida', () => {
  const server = { id: 1, nome: 'PROD', ip: '10.0.0.1' } as any;
  const authError = Object.assign(new Error('All configured authentication methods failed'), { level: 'client-authentication' });
  assert.deepEqual(controller.describeError(authError, server), {
    status: 502,
    message: 'Senha SSH/sudo inválida para o servidor PROD.',
  });
  const netError = new Error('connect ECONNREFUSED');
  assert.equal(controller.describeError(netError, server).status, 502);
  assert.match(controller.describeError(netError, server).message, /Não foi possível conectar ao servidor PROD/);
});
