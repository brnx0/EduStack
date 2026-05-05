<script setup lang="ts">
import { ref } from 'vue'
import { authFetch } from '../../composables/useAuth'

defineProps<{ isDark: boolean }>()

interface TaskEntry {
  sprint: string
  tarefa: string
  inicio: string
  fim: string | null
  durationMinutes: number
}

interface CollaboratorActivity {
  nome: string
  totalMinutes: number
  taskCount: number
  tasks: TaskEntry[]
}

const today = new Date().toISOString().slice(0, 10)
const selectedDate = ref(today)
const collaborators = ref<CollaboratorActivity[]>([])
const loading = ref(false)
const error = ref('')
const searched = ref(false)
const expandedNames = ref<Set<string>>(new Set())

function toggleExpand(nome: string) {
  if (expandedNames.value.has(nome)) {
    expandedNames.value.delete(nome)
  } else {
    expandedNames.value.add(nome)
  }
}

async function fetchActivity() {
  if (!selectedDate.value) return
  loading.value = true
  error.value = ''
  collaborators.value = []
  searched.value = false
  expandedNames.value.clear()

  try {
    const res = await authFetch(`/api/monitor/daily?date=${selectedDate.value}`)
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? 'Erro ao buscar dados')
    }
    collaborators.value = await res.json()
    searched.value = true
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDateDisplay(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return `${d}/${m}/${y}`
}

function getInitials(nome: string): string {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase()
}

function avatarColor(nome: string): string {
  const colors = [
    'from-blue-500 to-indigo-600',
    'from-emerald-500 to-teal-600',
    'from-violet-500 to-purple-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-cyan-500 to-sky-600',
  ]
  let hash = 0
  for (let i = 0; i < nome.length; i++) hash = (hash + nome.charCodeAt(i)) % colors.length
  return colors[hash] ?? ''
}

function timeBarWidth(minutes: number, max: number): string {
  if (max === 0) return '0%'
  return `${Math.min(100, (minutes / max) * 100)}%`
}
</script>

<template>
  <div class="h-full overflow-y-auto p-6" :class="isDark ? 'text-zinc-100' : 'text-zinc-800'">

    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-lg font-semibold" :class="isDark ? 'text-white' : 'text-zinc-900'">
        Monitor de Atividades
      </h2>
      <p class="text-xs mt-0.5" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
        Acompanhe o tempo registrado pelos colaboradores em um dia específico.
      </p>
    </div>

    <!-- Filter bar -->
    <div class="mb-6 flex flex-wrap items-end gap-3 rounded-xl border p-4"
      :class="isDark ? 'border-white/[.06] bg-zinc-800/50' : 'border-zinc-200 bg-white'">
      <div class="flex flex-col gap-1">
        <label class="text-[.65rem] font-semibold uppercase tracking-wider"
          :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
          Data
        </label>
        <input v-model="selectedDate" type="date"
          class="rounded-lg border px-3 py-1.5 text-sm outline-none transition-all" :class="isDark
            ? 'border-white/[.08] bg-zinc-900 text-white focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30'
            : 'border-zinc-200 bg-white text-zinc-900 focus:border-blue-400 focus:ring-1 focus:ring-blue-200'"
          @keydown.enter="fetchActivity" />
      </div>

      <button @click="fetchActivity" :disabled="loading || !selectedDate"
        class="flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold transition-all disabled:opacity-60"
        :class="isDark
          ? 'bg-blue-600 text-white hover:bg-blue-500 active:scale-[.97]'
          : 'bg-blue-600 text-white hover:bg-blue-500 active:scale-[.97]'">
        <div v-if="loading" class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
        <svg v-else class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.4" />
          <path d="M10.5 10.5l3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
        </svg>
        {{ loading ? 'Buscando…' : 'Buscar' }}
      </button>
    </div>

    <!-- Error -->
    <div v-if="error" class="mb-4 rounded-lg border px-4 py-3 text-sm" :class="isDark
      ? 'border-red-500/30 bg-red-500/10 text-red-400'
      : 'border-red-200 bg-red-50 text-red-600'">
      {{ error }}
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-24">
      <div class="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    </div>

    <!-- Empty -->
    <div v-else-if="searched && collaborators.length === 0"
      class="flex flex-col items-center justify-center py-24 gap-3">
      <div class="flex h-12 w-12 items-center justify-center rounded-xl border"
        :class="isDark ? 'border-white/[.06] bg-zinc-800' : 'border-zinc-200 bg-zinc-100'">
        <svg class="w-5 h-5" :class="isDark ? 'text-zinc-600' : 'text-zinc-400'" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.4" />
          <path d="M10 7v3.5M10 13h.01" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
        </svg>
      </div>
      <p class="text-sm" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
        Nenhuma atividade encontrada para {{ formatDateDisplay(selectedDate) }}.
      </p>
    </div>

    <!-- Accordion list -->
    <div v-else-if="collaborators.length > 0" class="flex flex-col gap-2">

      <!-- Summary bar -->
      <div class="mb-2 flex flex-wrap gap-4 rounded-xl border px-4 py-3"
        :class="isDark ? 'border-white/[.06] bg-zinc-800/40' : 'border-zinc-200 bg-zinc-50'">
        <div class="flex flex-col">
          <span class="text-[.6rem] font-semibold uppercase tracking-wider"
            :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
            Colaboradores
          </span>
          <span class="text-lg font-bold" :class="isDark ? 'text-white' : 'text-zinc-900'">
            {{ collaborators.length }}
          </span>
        </div>
        <div class="w-px self-stretch" :class="isDark ? 'bg-white/[.06]' : 'bg-zinc-200'" />
        <div class="flex flex-col">
          <span class="text-[.6rem] font-semibold uppercase tracking-wider"
            :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
            Total de tarefas
          </span>
          <span class="text-lg font-bold" :class="isDark ? 'text-white' : 'text-zinc-900'">
            {{collaborators.reduce((s, c) => s + c.taskCount, 0)}}
          </span>
        </div>
        <div class="w-px self-stretch" :class="isDark ? 'bg-white/[.06]' : 'bg-zinc-200'" />
        <div class="flex flex-col">
          <span class="text-[.6rem] font-semibold uppercase tracking-wider"
            :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
            Tempo total registrado
          </span>
          <span class="text-lg font-bold" :class="isDark ? 'text-white' : 'text-zinc-900'">
            {{formatTime(collaborators.reduce((s, c) => s + c.totalMinutes, 0))}}
          </span>
        </div>
      </div>

      <!-- Each collaborator accordion -->
      <div v-for="collab in collaborators" :key="collab.nome" class="rounded-xl border overflow-hidden transition-all"
        :class="isDark ? 'border-white/[.06]' : 'border-zinc-200'">
        <!-- Accordion header -->
        <button @click="toggleExpand(collab.nome)"
          class="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors" :class="isDark
            ? 'bg-zinc-800/50 hover:bg-zinc-800'
            : 'bg-white hover:bg-zinc-50'">
          <!-- Avatar -->
          <div
            class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[.6rem] font-bold text-white"
            :class="avatarColor(collab.nome)">
            {{ getInitials(collab.nome) }}
          </div>

          <!-- Name + time bar -->
          <div class="flex flex-1 flex-col gap-1.5 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-semibold truncate" :class="isDark ? 'text-white' : 'text-zinc-900'">
                {{ collab.nome }}
              </span>
              <div class="flex flex-shrink-0 items-center gap-3">
                <span class="text-[.65rem] font-medium" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
                  {{ collab.taskCount }} tarefa{{ collab.taskCount !== 1 ? 's' : '' }}
                </span>
                <span class="rounded-full px-2.5 py-0.5 text-xs font-bold" :class="isDark
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'bg-blue-50 text-blue-600'">
                  {{ formatTime(collab.totalMinutes) }}
                </span>
              </div>
            </div>

            <!-- Time progress bar -->
            <div class="h-1 rounded-full overflow-hidden" :class="isDark ? 'bg-zinc-700' : 'bg-zinc-200'">
              <div class="h-full rounded-full bg-blue-500 transition-all duration-500"
                :style="{ width: timeBarWidth(collab.totalMinutes, Math.max(...collaborators.map(c => c.totalMinutes))) }" />
            </div>
          </div>

          <!-- Chevron -->
          <svg class="w-4 h-4 flex-shrink-0 transition-transform duration-200" :class="[
            expandedNames.has(collab.nome) ? 'rotate-180' : '',
            isDark ? 'text-zinc-600' : 'text-zinc-400'
          ]" viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"
              stroke-linejoin="round" />
          </svg>
        </button>

        <!-- Accordion body -->
        <Transition name="accordion">
          <div v-if="expandedNames.has(collab.nome)" class="border-t"
            :class="isDark ? 'border-white/[.06] bg-zinc-900/50' : 'border-zinc-100 bg-zinc-50/80'">
            <!-- Indicators row -->
            <div class="flex flex-wrap gap-4 px-4 py-3 border-b"
              :class="isDark ? 'border-white/[.04]' : 'border-zinc-100'">
              <div class="flex flex-col gap-0.5">
                <span class="text-[.6rem] font-semibold uppercase tracking-wider"
                  :class="isDark ? 'text-zinc-600' : 'text-zinc-400'">
                  Tempo total
                </span>
                <span class="text-sm font-bold" :class="isDark ? 'text-white' : 'text-zinc-900'">
                  {{ formatTime(collab.totalMinutes) }}
                </span>
              </div>
              <div class="w-px self-stretch" :class="isDark ? 'bg-white/[.04]' : 'bg-zinc-200'" />
              <div class="flex flex-col gap-0.5">
                <span class="text-[.6rem] font-semibold uppercase tracking-wider"
                  :class="isDark ? 'text-zinc-600' : 'text-zinc-400'">
                  Nº de tarefas
                </span>
                <span class="text-sm font-bold" :class="isDark ? 'text-white' : 'text-zinc-900'">
                  {{ collab.taskCount }}
                </span>
              </div>
              <div class="w-px self-stretch" :class="isDark ? 'bg-white/[.04]' : 'bg-zinc-200'" />
              <div class="flex flex-col gap-0.5">
                <span class="text-[.6rem] font-semibold uppercase tracking-wider"
                  :class="isDark ? 'text-zinc-600' : 'text-zinc-400'">
                  Média por tarefa
                </span>
                <span class="text-sm font-bold" :class="isDark ? 'text-white' : 'text-zinc-900'">
                  {{ formatTime(collab.taskCount > 0 ? collab.totalMinutes / collab.taskCount : 0) }}
                </span>
              </div>
              <div class="w-px self-stretch" :class="isDark ? 'bg-white/[.04]' : 'bg-zinc-200'" />
              <div class="flex flex-col gap-0.5">
                <span class="text-[.6rem] font-semibold uppercase tracking-wider"
                  :class="isDark ? 'text-zinc-600' : 'text-zinc-400'">
                  Maior tarefa
                </span>
                <span class="text-sm font-bold" :class="isDark ? 'text-white' : 'text-zinc-900'">
                  {{formatTime(Math.max(...collab.tasks.map(t => t.durationMinutes)))}}
                </span>
              </div>
            </div>

            <!-- Tasks table -->
            <div class="overflow-x-auto">
              <table class="w-full text-xs">
                <thead>
                  <tr :class="isDark ? 'text-zinc-600 border-white/[.04]' : 'text-zinc-400 border-zinc-100'">
                    <th class="border-b px-4 py-2 text-left font-semibold uppercase tracking-wider"
                      :class="isDark ? 'border-white/[.04]' : 'border-zinc-100'">Sprint</th>
                    <th class="border-b px-4 py-2 text-left font-semibold uppercase tracking-wider"
                      :class="isDark ? 'border-white/[.04]' : 'border-zinc-100'">Início</th>
                    <th class="border-b px-4 py-2 text-left font-semibold uppercase tracking-wider"
                      :class="isDark ? 'border-white/[.04]' : 'border-zinc-100'">Fim</th>
                    <th class="border-b px-4 py-2 text-right font-semibold uppercase tracking-wider"
                      :class="isDark ? 'border-white/[.04]' : 'border-zinc-100'">Duração</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(task, i) in collab.tasks" :key="i" :class="isDark
                    ? 'border-white/[.03] hover:bg-white/[.02]'
                    : 'border-zinc-100 hover:bg-white'">
                    <td class="border-b px-4 py-2.5"
                      :class="isDark ? 'border-white/[.03] text-zinc-300' : 'border-zinc-100 text-zinc-700'">
                      <span class="rounded px-1.5 py-0.5 font-medium"
                        :class="isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-100 text-zinc-600'">
                        {{ task.sprint + ' - ' + task.tarefa }} {{ console.log(task) }}
                      </span>
                    </td>
                    <td class="border-b px-4 py-2.5 font-mono"
                      :class="isDark ? 'border-white/[.03] text-zinc-400' : 'border-zinc-100 text-zinc-500'">
                      {{ formatDateTime(task.inicio) }}
                    </td>
                    <td class="border-b px-4 py-2.5 font-mono"
                      :class="isDark ? 'border-white/[.03] text-zinc-400' : 'border-zinc-100 text-zinc-500'">
                      {{ task.fim ? formatDateTime(task.fim) : '—' }}
                    </td>
                    <td class="border-b px-4 py-2.5 text-right"
                      :class="isDark ? 'border-white/[.03]' : 'border-zinc-100'">
                      <span class="rounded-full px-2 py-0.5 font-semibold" :class="task.durationMinutes >= 60
                        ? isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
                        : isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-100 text-zinc-500'">
                        {{ formatTime(task.durationMinutes) }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </Transition>
      </div>
    </div>

  </div>
</template>

<style scoped>
.accordion-enter-active,
.accordion-leave-active {
  transition: grid-template-rows 0.22s ease, opacity 0.22s ease;
  display: grid;
  grid-template-rows: 1fr;
  opacity: 1;
}

.accordion-enter-from,
.accordion-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}

.accordion-enter-from>*,
.accordion-leave-to>* {
  overflow: hidden;
}
</style>
