import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { runRemote } from '../src/services/sshService.js';

const config = (port: number) => ({ host: '127.0.0.1', port, username: 'x', password: 'y' });

function listen(server: net.Server): Promise<number> {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve((server.address() as net.AddressInfo).port)));
}

test('runRemote rejeita quando a conexão é recusada', async () => {
  const server = net.createServer();
  const port = await listen(server);
  await new Promise((r) => server.close(r)); // porta livre: ninguém escutando

  await assert.rejects(runRemote(config(port), 'true', { timeoutMs: 5000 }));
});

test('runRemote desiste no timeout quando o servidor não responde', async () => {
  const sockets: net.Socket[] = [];
  const server = net.createServer((s) => { sockets.push(s); }); // aceita e fica mudo
  const port = await listen(server);

  const started = Date.now();
  try {
    await assert.rejects(runRemote(config(port), 'true', { timeoutMs: 1500 }), /tempo esgotado|Timed out/i);
    assert.ok(Date.now() - started < 4000, 'deveria desistir perto do timeout');
  } finally {
    sockets.forEach((s) => s.destroy());
    await new Promise((r) => server.close(r));
  }
});
