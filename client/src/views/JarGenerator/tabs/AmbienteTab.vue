<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useEnvironments, useServers, type Environment } from '../../../composables/useJarGenerator'

const props = defineProps<{ isDark: boolean }>()

const { environments, loading, error, fetchEnvironments, saveEnvironment, deleteEnvironment } = useEnvironments()
const { servers, fetchServers } = useServers()

const formOpen = ref(false)
const editing = ref<Environment | null>(null)
const saving = ref(false)

const form = ref({
  codServidor: 0,
  sistemaNome: '',
  tipo: 'Dev',
  tipoOrigem: 'Maker Local',
  descricao: '',
  url: '',
  contexto: '',
  systemCode: '',
  dirWebrun: '',
  dirTomcat: '',
  servicoTomcat: '',
  makerInterna: '',
  makerExterna: '',
  login: '',
  senha: '',
})

const tipoOptions = ['Dev', 'Homolog', 'Prod']

onMounted(async () => {
  await Promise.all([fetchEnvironments(), fetchServers()])
})

function resetForm() {
  form.value = {
    codServidor: servers.value[0]?.id || 0,
    sistemaNome: '', tipo: 'Dev', tipoOrigem: 'Maker Local', descricao: '',
    url: '', contexto: '', systemCode: '', dirWebrun: '', dirTomcat: '',
    servicoTomcat: '', makerInterna: '', makerExterna: '', login: '', senha: '',
  }
}

function openNew() {
  editing.value = null
  resetForm()
  formOpen.value = true
}

function openEdit(e: Environment) {
  editing.value = e
  form.value = {
    codServidor: e.codServidor,
    sistemaNome: e.sistemaNome,
    tipo: e.tipo,
    tipoOrigem: e.tipoOrigem || 'Maker Local',
    descricao: e.descricao || '',
    url: e.url || '',
    contexto: e.contexto,
    systemCode: e.systemCode,
    dirWebrun: e.dirWebrun || '',
    dirTomcat: e.dirTomcat || '',
    servicoTomcat: e.servicoTomcat || '',
    makerInterna: e.makerInterna || '',
    makerExterna: e.makerExterna || '',
    login: e.login,
    senha: e.senha,
  }
  formOpen.value = true
}

async function save() {
  saving.value = true
  try {
    await saveEnvironment(form.value, editing.value?.id)
    formOpen.value = false
  } finally {
    saving.value = false
  }
}

async function remove(id: number) {
  if (!confirm('Remover ambiente?')) return
  await deleteEnvironment(id)
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="text-sm font-semibold" :class="isDark ? 'text-white' : 'text-zinc-900'">Ambientes</h3>
        <p class="text-xs mt-0.5" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">Ambientes de origem para geração de JAR</p>
      </div>
      <button @click="openNew"
        class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 transition-all active:scale-[.97]">
        <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
          <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
        </svg>
        Novo Ambiente
      </button>
    </div>

    <div v-if="error" class="mb-4 rounded-lg border px-4 py-3 text-xs"
      :class="isDark ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-red-200 bg-red-50 text-red-600'">
      {{ error }}
    </div>

    <div v-if="loading" class="flex justify-center py-16">
      <div class="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    </div>

    <div v-else-if="environments.length === 0" class="flex flex-col items-center py-16 gap-2">
      <p class="text-sm" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">Nenhum ambiente cadastrado.</p>
    </div>

    <!-- Cards -->
    <div v-else class="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div v-for="e in environments" :key="e.id"
        class="rounded-xl border p-4 flex flex-col gap-2"
        :class="isDark ? 'border-white/[.06] bg-zinc-800/50' : 'border-zinc-200 bg-white'">
        <div class="flex items-start justify-between">
          <div>
            <span class="text-sm font-semibold" :class="isDark ? 'text-white' : 'text-zinc-900'">{{ e.sistemaNome }}</span>
            <span class="ml-2 rounded-full px-2 py-0.5 text-[.6rem] font-semibold uppercase"
              :class="e.tipo === 'Prod'
                ? isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'
                : e.tipo === 'Homolog'
                  ? isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'
                  : isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'">
              {{ e.tipo }}
            </span>
          </div>
          <div class="flex gap-2">
            <button @click="openEdit(e)" class="text-xs text-blue-500 hover:text-blue-400">Editar</button>
            <button @click="remove(e.id)" class="text-xs text-red-500 hover:text-red-400">Excluir</button>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
          <span>Servidor: <b :class="isDark ? 'text-zinc-300' : 'text-zinc-700'">{{ e.serverIp }}</b></span>
          <span>Contexto: <b :class="isDark ? 'text-zinc-300' : 'text-zinc-700'">{{ e.contexto }}</b></span>
          <span>System Code: <b :class="isDark ? 'text-zinc-300' : 'text-zinc-700'">{{ e.systemCode }}</b></span>
          <span>Login: <b :class="isDark ? 'text-zinc-300' : 'text-zinc-700'">{{ e.login }}</b></span>
        </div>
      </div>
    </div>

    <!-- Form Modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="formOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
          @click.self="formOpen = false">
          <div class="w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            :class="isDark ? 'bg-zinc-900 border border-white/[.06]' : 'bg-white border border-zinc-200'">
            <div class="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
              :class="isDark ? 'border-white/[.06]' : 'border-zinc-200'">
              <h3 class="text-sm font-semibold" :class="isDark ? 'text-white' : 'text-zinc-900'">
                {{ editing ? 'Editar Ambiente' : 'Novo Ambiente' }}
              </h3>
              <button @click="formOpen = false"
                class="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
                :class="isDark ? 'text-zinc-500 hover:bg-white/[.06]' : 'text-zinc-400 hover:bg-zinc-100'">
                <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
                </svg>
              </button>
            </div>
            <form @submit.prevent="save" class="p-5 flex flex-col gap-3 overflow-y-auto">
              <!-- Identificação -->
              <p class="text-xs font-semibold uppercase tracking-wider" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">Identificação</p>
              <div class="grid grid-cols-3 gap-3">
                <label class="flex flex-col gap-1 col-span-1">
                  <span class="text-xs font-medium" :class="isDark ? 'text-zinc-400' : 'text-zinc-600'">Sistema *</span>
                  <input v-model="form.sistemaNome" required class="rounded-lg border px-3 py-2 text-xs outline-none"
                    :class="isDark ? 'border-white/[.08] bg-zinc-800 text-white focus:border-blue-500' : 'border-zinc-200 bg-white text-zinc-900 focus:border-blue-500'" />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="text-xs font-medium" :class="isDark ? 'text-zinc-400' : 'text-zinc-600'">Tipo *</span>
                  <select v-model="form.tipo" class="rounded-lg border px-3 py-2 text-xs outline-none"
                    :class="isDark ? 'border-white/[.08] bg-zinc-800 text-white' : 'border-zinc-200 bg-white text-zinc-900'">
                    <option v-for="t in tipoOptions" :key="t" :value="t">{{ t }}</option>
                  </select>
                </label>
                <label class="flex flex-col gap-1">
                  <span class="text-xs font-medium" :class="isDark ? 'text-zinc-400' : 'text-zinc-600'">Servidor *</span>
                  <select v-model.number="form.codServidor" required class="rounded-lg border px-3 py-2 text-xs outline-none"
                    :class="isDark ? 'border-white/[.08] bg-zinc-800 text-white' : 'border-zinc-200 bg-white text-zinc-900'">
                    <option v-for="srv in servers" :key="srv.id" :value="srv.id">{{ srv.nome }} ({{ srv.ip }})</option>
                  </select>
                </label>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1">
                  <span class="text-xs font-medium" :class="isDark ? 'text-zinc-400' : 'text-zinc-600'">Descrição</span>
                  <input v-model="form.descricao" class="rounded-lg border px-3 py-2 text-xs outline-none"
                    :class="isDark ? 'border-white/[.08] bg-zinc-800 text-white focus:border-blue-500' : 'border-zinc-200 bg-white text-zinc-900 focus:border-blue-500'" />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="text-xs font-medium" :class="isDark ? 'text-zinc-400' : 'text-zinc-600'">System Code *</span>
                  <input v-model="form.systemCode" required placeholder="EDU" class="rounded-lg border px-3 py-2 text-xs outline-none"
                    :class="isDark ? 'border-white/[.08] bg-zinc-800 text-white focus:border-blue-500' : 'border-zinc-200 bg-white text-zinc-900 focus:border-blue-500'" />
                </label>
              </div>

              <!-- Acesso -->
              <p class="text-xs font-semibold uppercase tracking-wider mt-2" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">Acesso</p>
              <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1">
                  <span class="text-xs font-medium" :class="isDark ? 'text-zinc-400' : 'text-zinc-600'">URL</span>
                  <input v-model="form.url" placeholder="https://..." class="rounded-lg border px-3 py-2 text-xs outline-none"
                    :class="isDark ? 'border-white/[.08] bg-zinc-800 text-white focus:border-blue-500' : 'border-zinc-200 bg-white text-zinc-900 focus:border-blue-500'" />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="text-xs font-medium" :class="isDark ? 'text-zinc-400' : 'text-zinc-600'">Contexto *</span>
                  <input v-model="form.contexto" required placeholder="EDU_LIVE" class="rounded-lg border px-3 py-2 text-xs outline-none"
                    :class="isDark ? 'border-white/[.08] bg-zinc-800 text-white focus:border-blue-500' : 'border-zinc-200 bg-white text-zinc-900 focus:border-blue-500'" />
                </label>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1">
                  <span class="text-xs font-medium" :class="isDark ? 'text-zinc-400' : 'text-zinc-600'">Login Webrun *</span>
                  <input v-model="form.login" required class="rounded-lg border px-3 py-2 text-xs outline-none"
                    :class="isDark ? 'border-white/[.08] bg-zinc-800 text-white focus:border-blue-500' : 'border-zinc-200 bg-white text-zinc-900 focus:border-blue-500'" />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="text-xs font-medium" :class="isDark ? 'text-zinc-400' : 'text-zinc-600'">Senha Webrun *</span>
                  <input v-model="form.senha" required type="password" class="rounded-lg border px-3 py-2 text-xs outline-none"
                    :class="isDark ? 'border-white/[.08] bg-zinc-800 text-white focus:border-blue-500' : 'border-zinc-200 bg-white text-zinc-900 focus:border-blue-500'" />
                </label>
              </div>

              <!-- Configurações -->
              <p class="text-xs font-semibold uppercase tracking-wider mt-2" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">Configurações</p>
              <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1">
                  <span class="text-xs font-medium" :class="isDark ? 'text-zinc-400' : 'text-zinc-600'">Dir. Webrun</span>
                  <input v-model="form.dirWebrun" class="rounded-lg border px-3 py-2 text-xs outline-none font-mono"
                    :class="isDark ? 'border-white/[.08] bg-zinc-800 text-white focus:border-blue-500' : 'border-zinc-200 bg-white text-zinc-900 focus:border-blue-500'" />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="text-xs font-medium" :class="isDark ? 'text-zinc-400' : 'text-zinc-600'">Dir. Tomcat</span>
                  <input v-model="form.dirTomcat" class="rounded-lg border px-3 py-2 text-xs outline-none font-mono"
                    :class="isDark ? 'border-white/[.08] bg-zinc-800 text-white focus:border-blue-500' : 'border-zinc-200 bg-white text-zinc-900 focus:border-blue-500'" />
                </label>
              </div>
              <label class="flex flex-col gap-1">
                <span class="text-xs font-medium" :class="isDark ? 'text-zinc-400' : 'text-zinc-600'">Serviço Tomcat</span>
                <input v-model="form.servicoTomcat" class="rounded-lg border px-3 py-2 text-xs outline-none"
                  :class="isDark ? 'border-white/[.08] bg-zinc-800 text-white focus:border-blue-500' : 'border-zinc-200 bg-white text-zinc-900 focus:border-blue-500'" />
              </label>
              <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1">
                  <span class="text-xs font-medium" :class="isDark ? 'text-zinc-400' : 'text-zinc-600'">Maker.Commons Interna</span>
                  <input v-model="form.makerInterna" class="rounded-lg border px-3 py-2 text-xs outline-none font-mono"
                    :class="isDark ? 'border-white/[.08] bg-zinc-800 text-white focus:border-blue-500' : 'border-zinc-200 bg-white text-zinc-900 focus:border-blue-500'" />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="text-xs font-medium" :class="isDark ? 'text-zinc-400' : 'text-zinc-600'">Maker.Commons Externa</span>
                  <input v-model="form.makerExterna" class="rounded-lg border px-3 py-2 text-xs outline-none font-mono"
                    :class="isDark ? 'border-white/[.08] bg-zinc-800 text-white focus:border-blue-500' : 'border-zinc-200 bg-white text-zinc-900 focus:border-blue-500'" />
                </label>
              </div>

              <div class="flex justify-end gap-2 mt-3">
                <button type="button" @click="formOpen = false"
                  class="rounded-lg border px-4 py-2 text-xs font-medium transition-all"
                  :class="isDark ? 'border-zinc-700 text-zinc-400 hover:text-zinc-200' : 'border-zinc-200 text-zinc-500 hover:text-zinc-700'">
                  Cancelar
                </button>
                <button type="submit" :disabled="saving"
                  class="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition-all">
                  {{ saving ? 'Salvando…' : 'Salvar' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
