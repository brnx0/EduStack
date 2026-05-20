<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSystems, useServers, type Sistema } from '../../../composables/useJarGenerator'

const props = defineProps<{ isDark: boolean }>()

const { systems, loading, error, fetchSystems, saveSystem, deleteSystem } = useSystems()
const { servers, fetchServers } = useServers()

const formOpen = ref(false)
const editing = ref<Sistema | null>(null)
const form = ref({ codServidor: 0, nome: '', pathRaiz: '', nomeServico: '', nomeArquivo: '' })
const saving = ref(false)

onMounted(async () => {
  await Promise.all([fetchSystems(), fetchServers()])
})

function openNew() {
  editing.value = null
  form.value = { codServidor: servers.value[0]?.id || 0, nome: '', pathRaiz: '', nomeServico: '', nomeArquivo: '' }
  formOpen.value = true
}

function openEdit(s: Sistema) {
  editing.value = s
  form.value = { codServidor: s.codServidor, nome: s.nome, pathRaiz: s.pathRaiz, nomeServico: s.nomeServico, nomeArquivo: s.nomeArquivo || '' }
  formOpen.value = true
}

async function save() {
  saving.value = true
  try {
    await saveSystem(form.value, editing.value?.id)
    formOpen.value = false
  } finally {
    saving.value = false
  }
}

async function remove(id: number) {
  if (!confirm('Remover sistema?')) return
  await deleteSystem(id)
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="text-sm font-semibold" :class="isDark ? 'text-white' : 'text-zinc-900'">Sistemas</h3>
        <p class="text-xs mt-0.5" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">Sistemas destino no servidor Linux</p>
      </div>
      <button @click="openNew"
        class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 transition-all active:scale-[.97]">
        <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
          <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
        </svg>
        Novo Sistema
      </button>
    </div>

    <div v-if="error" class="mb-4 rounded-lg border px-4 py-3 text-xs"
      :class="isDark ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-red-200 bg-red-50 text-red-600'">
      {{ error }}
    </div>

    <div v-if="loading" class="flex justify-center py-16">
      <div class="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    </div>

    <div v-else-if="systems.length === 0" class="flex flex-col items-center py-16 gap-2">
      <p class="text-sm" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">Nenhum sistema cadastrado.</p>
    </div>

    <div v-else class="rounded-xl border overflow-x-auto"
      :class="isDark ? 'border-white/[.06]' : 'border-zinc-200'">
      <table class="w-full text-xs whitespace-nowrap">
        <thead>
          <tr :class="isDark ? 'bg-zinc-800/60 text-zinc-400' : 'bg-zinc-50 text-zinc-500'">
            <th class="text-left font-medium px-4 py-2.5">Nome</th>
            <th class="text-left font-medium px-4 py-2.5">Servidor</th>
            <th class="text-left font-medium px-4 py-2.5">Path Raiz</th>
            <th class="text-left font-medium px-4 py-2.5">Serviço</th>
            <th class="text-left font-medium px-4 py-2.5">Nome Arquivo</th>
            <th class="text-right font-medium px-4 py-2.5">Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in systems" :key="s.id"
            class="border-t transition-colors"
            :class="isDark ? 'border-white/[.04] hover:bg-white/[.02]' : 'border-zinc-100 hover:bg-zinc-50'">
            <td class="px-4 py-3 font-medium" :class="isDark ? 'text-white' : 'text-zinc-900'">{{ s.nome }}</td>
            <td class="px-4 py-3" :class="isDark ? 'text-zinc-400' : 'text-zinc-600'">{{ s.serverNome || '—' }}</td>
            <td class="px-4 py-3 font-mono text-[10px]" :class="isDark ? 'text-zinc-500' : 'text-zinc-500'">{{ s.pathRaiz }}</td>
            <td class="px-4 py-3" :class="isDark ? 'text-zinc-400' : 'text-zinc-600'">{{ s.nomeServico }}</td>
            <td class="px-4 py-3 font-mono text-[10px]" :class="isDark ? 'text-zinc-500' : 'text-zinc-500'">{{ s.nomeArquivo || '—' }}</td>
            <td class="px-4 py-3 text-right">
              <button @click="openEdit(s)" class="mr-2 text-blue-500 hover:text-blue-400">Editar</button>
              <button @click="remove(s.id)" class="text-red-500 hover:text-red-400">Excluir</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Form Modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="formOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
          @click.self="formOpen = false">
          <div class="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
            :class="isDark ? 'bg-zinc-900 border border-white/[.06]' : 'bg-white border border-zinc-200'">
            <div class="flex items-center justify-between px-5 py-4 border-b"
              :class="isDark ? 'border-white/[.06]' : 'border-zinc-200'">
              <h3 class="text-sm font-semibold" :class="isDark ? 'text-white' : 'text-zinc-900'">
                {{ editing ? 'Editar Sistema' : 'Novo Sistema' }}
              </h3>
              <button @click="formOpen = false"
                class="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
                :class="isDark ? 'text-zinc-500 hover:bg-white/[.06]' : 'text-zinc-400 hover:bg-zinc-100'">
                <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
                </svg>
              </button>
            </div>
            <form @submit.prevent="save" class="p-5 flex flex-col gap-3">
              <label class="flex flex-col gap-1">
                <span class="text-xs font-medium" :class="isDark ? 'text-zinc-400' : 'text-zinc-600'">Servidor *</span>
                <select v-model.number="form.codServidor" required
                  class="rounded-lg border px-3 py-2 text-xs outline-none transition-colors"
                  :class="isDark ? 'border-white/[.08] bg-zinc-800 text-white focus:border-blue-500' : 'border-zinc-200 bg-white text-zinc-900 focus:border-blue-500'">
                  <option v-for="srv in servers" :key="srv.id" :value="srv.id">{{ srv.nome }} ({{ srv.ip }})</option>
                </select>
              </label>
              <div class="grid grid-cols-2 gap-3">
                <label class="flex flex-col gap-1">
                  <span class="text-xs font-medium" :class="isDark ? 'text-zinc-400' : 'text-zinc-600'">Nome *</span>
                  <input v-model="form.nome" required
                    class="rounded-lg border px-3 py-2 text-xs outline-none transition-colors"
                    :class="isDark ? 'border-white/[.08] bg-zinc-800 text-white focus:border-blue-500' : 'border-zinc-200 bg-white text-zinc-900 focus:border-blue-500'" />
                </label>
                <label class="flex flex-col gap-1">
                  <span class="text-xs font-medium" :class="isDark ? 'text-zinc-400' : 'text-zinc-600'">Nome do Serviço *</span>
                  <input v-model="form.nomeServico" required placeholder="ex: tomcat-sgv"
                    class="rounded-lg border px-3 py-2 text-xs outline-none transition-colors"
                    :class="isDark ? 'border-white/[.08] bg-zinc-800 text-white focus:border-blue-500' : 'border-zinc-200 bg-white text-zinc-900 focus:border-blue-500'" />
                </label>
              </div>
              <label class="flex flex-col gap-1">
                <span class="text-xs font-medium" :class="isDark ? 'text-zinc-400' : 'text-zinc-600'">Path Raiz *</span>
                <input v-model="form.pathRaiz" required placeholder="/opt/webrun/systems/SGV"
                  class="rounded-lg border px-3 py-2 text-xs outline-none transition-colors font-mono"
                  :class="isDark ? 'border-white/[.08] bg-zinc-800 text-white focus:border-blue-500' : 'border-zinc-200 bg-white text-zinc-900 focus:border-blue-500'" />
              </label>
              <label class="flex flex-col gap-1">
                <span class="text-xs font-medium" :class="isDark ? 'text-zinc-400' : 'text-zinc-600'">Nome do Arquivo (sem extensão)</span>
                <input v-model="form.nomeArquivo" placeholder="ex: MeuSistema"
                  class="rounded-lg border px-3 py-2 text-xs outline-none transition-colors font-mono"
                  :class="isDark ? 'border-white/[.08] bg-zinc-800 text-white focus:border-blue-500' : 'border-zinc-200 bg-white text-zinc-900 focus:border-blue-500'" />
                <span class="text-[10px]" :class="isDark ? 'text-zinc-600' : 'text-zinc-400'">Renomeia o JAR ao enviar. Extensão original mantida.</span>
              </label>
              <div class="flex justify-end gap-2 mt-2">
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
