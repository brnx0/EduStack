# Gerenciador de Serviços (/opt) — Design

**Data:** 2026-10-07
**Status:** aguardando revisão

## Objetivo

Permitir que usuários logados do EduStack vejam os serviços das aplicações instaladas em `/opt` nos servidores de produção já cadastrados, possam **iniciar, parar e reiniciar** esses serviços e **consultar os logs**, sem precisar abrir um terminal SSH.

## Decisões tomadas

| Tema | Decisão |
|---|---|
| Descoberta dos serviços | Automática, via SSH, a partir dos serviços do systemd que referenciam `/opt` |
| Fonte dos logs | `journalctl` (systemd) |
| Acesso | Qualquer usuário logado pode listar, ler logs, iniciar, parar e reiniciar |
| Arquitetura | Uma conexão SSH por ação, reaproveitando `ssh2` e o cadastro de servidores |
| Logs ao vivo (streaming) | Fora do escopo; a tela usa atualização manual ou automática a cada 5 s |

## Contexto existente

- `data/servers.json` (CRUD em `serversController.ts`) guarda `ip`, `portaSsh`, `usuarioSsh` e `senhaSsh` de cada servidor.
- `services/sshService.ts` tem `execCommand` (exec simples via `ssh2`) e usa `echo 'senha' | sudo -S` no deploy do JAR.
- `services/jsonStorage.ts` faz a persistência em arquivos JSON de `data/`.
- O frontend é Vue 3 + Tailwind e as telas ficam em `client/src/views/<Nome>/`. O menu é definido em `App.vue`, e as chamadas usam `authFetch`.

## Arquitetura

```
Tela "Serviços" (Vue) ──authFetch──▶ /api/servers/:id/services... (Express, authMiddleware)
                                          │
                                          ▼
                              serviceManager.ts (regras + comandos)
                                          │  ssh2 (uma conexão por chamada)
                                          ▼
                              Servidor Linux: systemctl / journalctl via sudo
```

### Backend — unidades

1. **`services/sshService.ts`**: duas funções novas.
   - `runRemote(config, command, { stdin?, timeoutMs? })` executa um comando, opcionalmente enviando texto pelo stdin, e retorna `{ code, stdout, stderr }` sem lançar erro quando o código de saída é diferente de zero; quem chama decide o que fazer. Tem timeout de 30 s, e a conexão é sempre encerrada.
   - `runSudo(config, command)` executa `sudo -S -p '' <command>` passando a senha pelo stdin, sem colocá-la no texto do comando.

2. **`services/serviceManager.ts`** (novo), com toda a lógica e sem nada de Express:
   - `discoverServices(server)`: roda um único script shell via `execSudo`. O script:
     1. Lista as unidades com `systemctl list-units --type=service --all --no-legend --plain`, guardando o nome.
     2. Executa `systemctl show <unidades> -p Id,Description,LoadState,ActiveState,SubState,MainPID,ActiveEnterTimestamp,ExecStart,WorkingDirectory,FragmentPath,SourcePath` em lote.
     3. Para unidades com `SourcePath` em `/etc/init.d/`, roda `grep -q /opt <script>` e marca o resultado.

     O parser em TypeScript separa os blocos e mantém só as unidades em que `ExecStart`, `WorkingDirectory` ou `FragmentPath` contêm `/opt/`, ou cujo script de init referencia `/opt`. O resultado é uma lista de `ServiceInfo`.
   - `ServiceInfo = { name, description, activeState, subState, mainPid, since, workingDirectory, execPath }`.
   - `controlService(server, name, action)`: `action` ∈ `start | stop | restart`. Antes de executar:
     - valida o nome com `^[A-Za-z0-9@._-]+\.service$` (o sufixo é acrescentado se faltar);
     - confirma que o nome está na lista que `discoverServices` retorna, o que impede agir em serviços fora do `/opt`.

     Executa `systemctl <action> <name>` e depois devolve o estado atualizado do serviço.
   - `readLogs(server, name, lines)`: aplica a mesma validação de nome e pertencimento. `lines` ∈ {100, 500, 1000}, com padrão 500. Executa `journalctl -u <name> -n <lines> --no-pager -o short-iso` e devolve o texto.
   - O script de descoberta, o parser (`parseServiceDiscovery`) e as validações de nome e de quantidade de linhas ficam em `services/serviceDiscovery.ts` como funções puras, para serem testados isoladamente. O `serviceManager` recebe um `RemoteRunner` (`run`/`sudo`), o que permite testá-lo com um executor falso.

3. **`services/serviceAudit.ts`** (novo): `recordAction({ user, serverId, serverName, service, action, success, message })` grava em `data/service-actions.json` via `jsonStorage`. `listActions(limit = 50)` devolve as mais recentes primeiro.

4. **`controllers/servicesController.ts`** (novo): faz a camada HTTP. Busca o servidor (404 se não existir ou estiver inativo; 400 se não tiver usuário ou senha SSH), chama o `serviceManager` e registra a auditoria nas ações. O usuário vem de `req.user`, que o `authMiddleware` preenche com o JWT `{ id, login, isAdmin }`. A auditoria grava `id` e `login`.

5. **Rotas** em um novo `routes/services.ts`, montado em `index.ts` com `app.use('/api', authMiddleware, serviceRoutes)`:

| Método | Rota | Retorno |
|---|---|---|
| GET | `/api/servers/:id/services` | `ServiceInfo[]` |
| POST | `/api/servers/:id/services/:name/start` | `ServiceInfo` atualizado |
| POST | `/api/servers/:id/services/:name/stop` | `ServiceInfo` atualizado |
| POST | `/api/servers/:id/services/:name/restart` | `ServiceInfo` atualizado |
| GET | `/api/servers/:id/services/:name/logs?lines=500` | `{ log: string }` |
| GET | `/api/service-actions?limit=50` | registros de auditoria |

A tela precisa da lista de servidores, mas `GET /api/jar/servers` devolve `senhaSsh`. Por isso o novo controller expõe `GET /api/service-servers`, que retorna apenas `{ id, nome, ip }` dos servidores ativos.

### Erros

- Falha de conexão SSH ou timeout: 502 com a mensagem "Não foi possível conectar ao servidor X".
- Senha de sudo incorreta (o stderr contém "incorrect password" ou "Sorry"): 502 com a mensagem "Senha SSH/sudo inválida para o servidor X".
- `systemctl` com código de saída diferente de zero numa ação: 502 com o stderr resumido. A auditoria registra `success: false`.
- Serviço fora da lista do `/opt` ou com nome inválido: 400. Essa tentativa não é executada no servidor.

### Frontend

- Nova view `client/src/views/Services/ServicesView.vue`, com rota `/servicos` e o item "Serviços" no menu (`adminOnly: false`).
- A view tem:
  - **Seletor de servidor** no topo. O último servidor escolhido fica guardado no `localStorage`.
  - **Tabela de serviços** com nome, descrição, estado (selo verde para ativo, cinza para parado, vermelho para falhou), PID, desde quando e ações. Há busca por nome ou descrição e botão "Atualizar".
  - **Ações:** Iniciar (quando parado) e Parar/Reiniciar (quando ativo). Parar e Reiniciar pedem confirmação num modal. Durante a ação o botão fica desabilitado com spinner; no fim, a linha é atualizada.
  - **Painel de logs:** gaveta lateral com fonte monoespaçada, seletor de 100/500/1000 linhas, botão "Atualizar", opção "Atualizar a cada 5 s" (que para quando o painel fecha) e rolagem automática para o fim.
  - **Últimas ações:** seção recolhível com as 20 ações mais recentes (quem, quando, serviço, ação, resultado).
- Um composable `useServices.ts` concentra as chamadas, no mesmo padrão de `useProjects.ts`.
- A tela segue o padrão visual atual (tema claro e escuro, `isDark`, Tailwind).

## Testes

- **Unitários (parser):** `parseServiceDiscovery` com uma saída real de exemplo, cobrindo unidade em `/opt`, unidade fora do `/opt`, script SysV marcado e campos vazios. Também a validação de nome do serviço (nomes válidos, tentativas de injeção como `x; rm -rf /` e espaços).
- **Integração manual:** contra um servidor cadastrado, listar os serviços, ler os logs de um deles e reiniciar um serviço não crítico combinado com o usuário. A verificação é feita na tela e pelo `systemctl status` no servidor.
- **Checagens de compilação:** `tsc --noEmit` no server e `vue-tsc --build` no client.

O projeto não tem framework de testes. A proposta é usar o test runner nativo do Node (`node --test`) com `tsx`, sem adicionar dependências.

## Fora do escopo

- Logs em tempo real (`journalctl -f`) via socket.io.
- Leitura de arquivos `.log` dentro do `/opt`.
- Habilitar ou desabilitar serviços no boot (`systemctl enable/disable`).
- Permissões por perfil: todos os usuários logados têm o mesmo acesso.
- Corrigir o vazamento de `senhaSsh` em `GET /api/jar/servers` e o `echo 'senha' | sudo` do deploy do JAR. Os dois foram registrados como melhorias separadas.

## Premissas a confirmar na implementação

- Os servidores usam systemd. Serviços SysV aparecem através do `systemd-sysv-generator`.
- O usuário SSH cadastrado tem sudo com senha para `systemctl` e `journalctl`.
