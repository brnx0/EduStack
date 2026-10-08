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
