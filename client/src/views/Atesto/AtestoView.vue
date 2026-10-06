<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useProjects, type Project, type Sprint } from '../../composables/useProjects'

defineProps<{ isDark: boolean }>()

const {
  projects,
  sprints,
  loadingProjects,
  loadingSprints,
  generatingDocx,
  error,
  fetchProjects,
  fetchSprints,
  downloadDocx,
} = useProjects()

const selectedProject = ref<Project | null>(null)
const modalOpen = ref(false)

type SprintStatusFilter = 'all' | 'released' | 'in-progress'

const projectSearch = ref('')
const sprintSearch = ref('')
const sprintStatusFilter = ref<SprintStatusFilter>('all')

const sprintStatusOptions: { value: SprintStatusFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'released', label: 'Liberadas' },
  { value: 'in-progress', label: 'Em andamento' },
]

function normalize(text: unknown) {
  // A API pode devolver campos não textuais (ex.: PRO_DESCRICAO vem como número).
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

const filteredProjects = computed(() => {
  const term = normalize(projectSearch.value)
  if (!term) return projects.value
  return projects.value.filter(p =>
    normalize(p.PRO_NOME).includes(term) ||
    (typeof p.PRO_DESCRICAO === 'string' && normalize(p.PRO_DESCRICAO).includes(term)) ||
    String(p.COD_PROJETO).includes(term),
  )
})

const filteredSprints = computed(() => {
  const term = normalize(sprintSearch.value)
  return sprints.value.filter(s => {
    if (sprintStatusFilter.value === 'released' && !sprintStatus(s)) return false
    if (sprintStatusFilter.value === 'in-progress' && sprintStatus(s)) return false
    return !term || normalize(s.VER_NOME).includes(term)
  })
})

onMounted(fetchProjects)

async function openSprints(project: Project) {
  selectedProject.value = project
  sprintSearch.value = ''
  sprintStatusFilter.value = 'all'
  modalOpen.value = true
  await fetchSprints(project.COD_PROJETO)
}

function closeModal() {
  modalOpen.value = false
  selectedProject.value = null
}

// ── Formulário do atesto ─────────────────────────────────────────────────────
const ATESTO_PREFS_KEY = 'edustack:atesto-prefs'
const DEFAULT_CLIENT_LINES = [
  'SMED – SECRETARIA MUNICIPAL DE EDUCAÇÃO',
  'GEJAF - GERENTE DO ENSINO FUNDAMENTAL ANOS FINAIS E EJA',
  'PMS – PREFEITURA MUNICIPAL DE SALVADOR – ESTADO DA BAHIA',
].join('\n')
const DEFAULT_REQUESTER = 'GEJAF - Gerente do Ensino Fundamental Anos Finais e EJA'

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function loadAtestoPrefs(): { clientLines: string; requester: string } {
  try {
    const saved = JSON.parse(localStorage.getItem(ATESTO_PREFS_KEY) ?? 'null')
    if (saved && typeof saved.clientLines === 'string' && typeof saved.requester === 'string') return saved
  } catch { /* usa padrões */ }
  return { clientLines: DEFAULT_CLIENT_LINES, requester: DEFAULT_REQUESTER }
}

const atestoSprint = ref<Sprint | null>(null)
const atestoForm = ref({ clientLines: '', requester: '', date: '' })

const atestoFormValid = computed(() =>
  atestoForm.value.clientLines.trim() !== '' &&
  atestoForm.value.requester.trim() !== '' &&
  atestoForm.value.date !== '',
)

function openAtestoForm(sprint: Sprint) {
  const prefs = loadAtestoPrefs()
  atestoForm.value = { ...prefs, date: todayISO() }
  error.value = null
  atestoSprint.value = sprint
}

function closeAtestoForm() {
  atestoSprint.value = null
}

async function submitAtesto() {
  const sprint = atestoSprint.value
  if (!sprint || !atestoFormValid.value) return

  const { clientLines, requester, date } = atestoForm.value
  try {
    localStorage.setItem(ATESTO_PREFS_KEY, JSON.stringify({ clientLines, requester }))
  } catch { /* preferências são opcionais */ }

  await downloadDocx(sprint.COD_VERSAO, sprint.VER_NOME, {
    clientLines: clientLines.split('\n').map(l => l.trim()).filter(Boolean),
    requester: requester.trim(),
    date,
  })
  if (!error.value) closeAtestoForm()
}

function sprintStatus(sprint: Sprint) {
  return sprint.VER_LIBERA === 'S'
}

function formatDate(raw: string | null) {
  if (!raw) return '—'
  return new Date(raw).toLocaleDateString('pt-BR')
}
</script>

<template>
  <div class="h-full overflow-y-auto p-6" :class="isDark ? 'text-zinc-100' : 'text-zinc-800'">

    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-lg font-semibold" :class="isDark ? 'text-white' : 'text-zinc-900'">
        Projetos
      </h2>
      <p class="text-xs mt-0.5" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
        Selecione um projeto para ver as sprints e gerar o atesto.
      </p>
    </div>

    <!-- Search projects -->
    <div v-if="!loadingProjects && projects.length > 0" class="mb-4 flex items-center gap-3">
      <div class="relative w-full max-w-sm">
        <svg
          class="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
          :class="isDark ? 'text-zinc-500' : 'text-zinc-400'"
          viewBox="0 0 16 16"
          fill="none"
        >
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.4"/>
          <path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
        <input
          v-model="projectSearch"
          type="text"
          placeholder="Buscar por nome, descrição ou código…"
          class="w-full rounded-lg border py-2 pl-9 pr-8 text-sm outline-none transition-colors"
          :class="isDark
            ? 'border-white/[.06] bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500/50'
            : 'border-zinc-200 bg-white text-zinc-800 placeholder:text-zinc-400 focus:border-blue-400'"
        />
        <button
          v-if="projectSearch"
          @click="projectSearch = ''"
          class="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded"
          :class="isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-700'"
          title="Limpar busca"
        >
          <svg class="h-3 w-3" viewBox="0 0 16 16" fill="none">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <span class="text-xs whitespace-nowrap" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
        {{ filteredProjects.length }} de {{ projects.length }}
      </span>
    </div>

    <!-- Error -->
    <div
      v-if="error"
      class="mb-4 rounded-lg border px-4 py-3 text-sm"
      :class="isDark
        ? 'border-red-500/30 bg-red-500/10 text-red-400'
        : 'border-red-200 bg-red-50 text-red-600'"
    >
      {{ error }}
    </div>

    <!-- Loading projects -->
    <div v-if="loadingProjects" class="flex items-center justify-center py-24">
      <div class="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!loadingProjects && projects.length === 0 && !error"
      class="flex flex-col items-center justify-center py-24 gap-3"
    >
      <div
        class="flex h-12 w-12 items-center justify-center rounded-xl border"
        :class="isDark ? 'border-white/[.06] bg-zinc-800' : 'border-zinc-200 bg-zinc-100'"
      >
        <svg class="w-5 h-5" :class="isDark ? 'text-zinc-600' : 'text-zinc-400'" viewBox="0 0 20 20" fill="none">
          <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.4"/>
          <path d="M7 7h6M7 10h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
      </div>
      <p class="text-sm" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
        Nenhum projeto encontrado.
      </p>
    </div>

    <!-- No search results -->
    <div
      v-else-if="filteredProjects.length === 0"
      class="flex flex-col items-center justify-center py-24 gap-2"
    >
      <p class="text-sm" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
        Nenhum projeto corresponde à busca.
      </p>
    </div>

    <!-- Projects grid -->
    <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <button
        v-for="project in filteredProjects"
        :key="project.COD_PROJETO"
        @click="openSprints(project)"
        class="group flex flex-col gap-2 rounded-xl border p-4 text-left transition-all duration-150"
        :class="isDark
          ? 'border-white/[.06] bg-zinc-800/50 hover:border-blue-500/40 hover:bg-zinc-800'
          : 'border-zinc-200 bg-white hover:border-blue-300 hover:shadow-sm'"
      >
        <div class="flex items-start justify-between gap-2">
          <span
            class="text-sm font-semibold leading-snug"
            :class="isDark ? 'text-white' : 'text-zinc-900'"
          >
            {{ project.PRO_NOME }}
          </span>
          <span
            class="flex-shrink-0 rounded-full px-2 py-0.5 text-[.6rem] font-semibold uppercase tracking-wide border"
            :class="isDark
              ? 'border-blue-500/20 bg-blue-500/10 text-blue-400'
              : 'border-blue-200 bg-blue-50 text-blue-600'"
          >
            #{{ project.COD_PROJETO }}
          </span>
        </div>
        <p
          v-if="project.PRO_DESCRICAO"
          class="text-xs leading-relaxed line-clamp-2"
          :class="isDark ? 'text-zinc-500' : 'text-zinc-400'"
        >
          {{ project.PRO_DESCRICAO }}
        </p>
        <div
          class="mt-1 flex items-center gap-1 text-xs font-medium"
          :class="isDark
            ? 'text-zinc-600 group-hover:text-blue-400'
            : 'text-zinc-400 group-hover:text-blue-600'"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Ver sprints
        </div>
      </button>
    </div>

  </div>

  <!-- Modal de Sprints -->
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="modalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
        @click.self="closeModal"
      >
        <div
          class="flex flex-col w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden"
          :class="isDark ? 'bg-zinc-900 border border-white/[.06]' : 'bg-white border border-zinc-200'"
        >
          <!-- Modal Header -->
          <div
            class="flex flex-shrink-0 items-center justify-between px-5 py-4 border-b"
            :class="isDark ? 'border-white/[.06]' : 'border-zinc-200'"
          >
            <div>
              <h3
                class="text-sm font-semibold"
                :class="isDark ? 'text-white' : 'text-zinc-900'"
              >
                {{ selectedProject?.PRO_NOME }}
              </h3>
              <p class="text-xs mt-0.5" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
                Sprints do projeto
              </p>
            </div>
            <button
              @click="closeModal"
              class="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
              :class="isDark
                ? 'text-zinc-500 hover:bg-white/[.06] hover:text-zinc-300'
                : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700'"
            >
              <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <!-- Sprint filters -->
          <div
            v-if="!loadingSprints && sprints.length > 0"
            class="flex flex-shrink-0 flex-wrap items-center gap-2 px-5 py-3 border-b"
            :class="isDark ? 'border-white/[.06]' : 'border-zinc-200'"
          >
            <div class="relative min-w-[12rem] flex-1">
              <svg
                class="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                :class="isDark ? 'text-zinc-500' : 'text-zinc-400'"
                viewBox="0 0 16 16"
                fill="none"
              >
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.4"/>
                <path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
              <input
                v-model="sprintSearch"
                type="text"
                placeholder="Buscar sprint…"
                class="w-full rounded-lg border py-1.5 pl-9 pr-3 text-xs outline-none transition-colors"
                :class="isDark
                  ? 'border-white/[.06] bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500/50'
                  : 'border-zinc-200 bg-white text-zinc-800 placeholder:text-zinc-400 focus:border-blue-400'"
              />
            </div>
            <div
              class="flex rounded-lg border p-0.5"
              :class="isDark ? 'border-white/[.06] bg-zinc-800/50' : 'border-zinc-200 bg-zinc-50'"
            >
              <button
                v-for="opt in sprintStatusOptions"
                :key="opt.value"
                @click="sprintStatusFilter = opt.value"
                class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                :class="sprintStatusFilter === opt.value
                  ? 'bg-blue-600 text-white'
                  : isDark
                    ? 'text-zinc-400 hover:text-zinc-200'
                    : 'text-zinc-500 hover:text-zinc-800'"
              >
                {{ opt.label }}
              </button>
            </div>
            <span class="text-xs whitespace-nowrap" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
              {{ filteredSprints.length }} de {{ sprints.length }}
            </span>
          </div>

          <!-- Modal Body -->
          <div class="flex-1 overflow-y-auto p-5">

            <!-- Loading sprints -->
            <div v-if="loadingSprints" class="flex items-center justify-center py-16">
              <div class="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </div>

            <!-- Empty -->
            <div
              v-else-if="sprints.length === 0"
              class="flex flex-col items-center justify-center py-16 gap-2"
            >
              <p class="text-sm" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
                Nenhuma sprint encontrada.
              </p>
            </div>

            <!-- No filter results -->
            <div
              v-else-if="filteredSprints.length === 0"
              class="flex flex-col items-center justify-center py-16 gap-2"
            >
              <p class="text-sm" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
                Nenhuma sprint corresponde aos filtros.
              </p>
            </div>

            <!-- Sprint cards -->
            <div v-else class="flex flex-col gap-3">
              <div
                v-for="sprint in filteredSprints"
                :key="sprint.COD_VERSAO"
                class="flex items-center justify-between gap-3 rounded-xl border p-4"
                :class="isDark
                  ? 'border-white/[.06] bg-zinc-800/50'
                  : 'border-zinc-200 bg-zinc-50'"
              >
                <div class="flex flex-col gap-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span
                      class="text-sm font-semibold truncate"
                      :class="isDark ? 'text-white' : 'text-zinc-900'"
                    >
                      {{ sprint.VER_NOME }}
                    </span>
                    <span
                      class="flex-shrink-0 rounded-full px-2 py-0.5 text-[.6rem] font-semibold uppercase tracking-wide"
                      :class="sprintStatus(sprint)
                        ? isDark
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-emerald-50 text-emerald-600'
                        : isDark
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-amber-50 text-amber-600'"
                    >
                      {{ sprintStatus(sprint) ? 'Liberada' : 'Em andamento' }}
                    </span>
                  </div>
                  <div class="flex gap-4 text-xs" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
                    <span>Início: {{ formatDate(sprint.VER_DATA) }}</span>
                    <span>Previsão: {{ formatDate(sprint.VER_PREV_DATA) }}</span>
                  </div>
                </div>

                <button
                  @click="openAtestoForm(sprint)"
                  :disabled="generatingDocx === sprint.COD_VERSAO"
                  class="flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all disabled:opacity-60"
                  :class="isDark
                    ? 'bg-blue-600 text-white hover:bg-blue-500 active:scale-[.97]'
                    : 'bg-blue-600 text-white hover:bg-blue-500 active:scale-[.97]'"
                >
                  <svg
                    v-if="generatingDocx !== sprint.COD_VERSAO"
                    class="w-3.5 h-3.5"
                    viewBox="0 0 16 16"
                    fill="none"
                  >
                    <path d="M8 2v9M4 7l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M2 13h12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                  </svg>
                  <div
                    v-else
                    class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"
                  />
                  {{ generatingDocx === sprint.COD_VERSAO ? 'Gerando…' : 'Gerar Atesto' }}
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </Transition>

    <!-- Modal do formulário do atesto -->
    <Transition name="fade">
      <div
        v-if="atestoSprint"
        class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
        @click.self="closeAtestoForm"
      >
        <form
          @submit.prevent="submitAtesto"
          class="flex flex-col w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
          :class="isDark ? 'bg-zinc-900 border border-white/[.06]' : 'bg-white border border-zinc-200'"
        >
          <div
            class="flex items-center justify-between px-5 py-4 border-b"
            :class="isDark ? 'border-white/[.06]' : 'border-zinc-200'"
          >
            <div>
              <h3 class="text-sm font-semibold" :class="isDark ? 'text-white' : 'text-zinc-900'">
                Gerar atesto
              </h3>
              <p class="text-xs mt-0.5" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
                {{ selectedProject?.PRO_NOME }} · {{ atestoSprint.VER_NOME }}
              </p>
            </div>
            <button
              type="button"
              @click="closeAtestoForm"
              class="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
              :class="isDark
                ? 'text-zinc-500 hover:bg-white/[.06] hover:text-zinc-300'
                : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700'"
            >
              <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="flex flex-col gap-4 p-5">
            <label class="flex flex-col gap-1.5">
              <span class="text-xs font-medium" :class="isDark ? 'text-zinc-300' : 'text-zinc-700'">Cliente</span>
              <textarea
                v-model="atestoForm.clientLines"
                rows="3"
                class="w-full resize-y rounded-lg border px-3 py-2 text-xs outline-none transition-colors"
                :class="isDark
                  ? 'border-white/[.06] bg-zinc-800/50 text-zinc-100 focus:border-blue-500/50'
                  : 'border-zinc-200 bg-white text-zinc-800 focus:border-blue-400'"
              />
              <span class="text-[.7rem]" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
                Uma linha por item. Aparece na capa, abaixo de "Cliente".
              </span>
            </label>

            <label class="flex flex-col gap-1.5">
              <span class="text-xs font-medium" :class="isDark ? 'text-zinc-300' : 'text-zinc-700'">Área solicitante</span>
              <input
                v-model="atestoForm.requester"
                type="text"
                class="w-full rounded-lg border px-3 py-2 text-xs outline-none transition-colors"
                :class="isDark
                  ? 'border-white/[.06] bg-zinc-800/50 text-zinc-100 focus:border-blue-500/50'
                  : 'border-zinc-200 bg-white text-zinc-800 focus:border-blue-400'"
              />
              <span class="text-[.7rem]" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
                Citada na introdução e abaixo da assinatura.
              </span>
            </label>

            <label class="flex flex-col gap-1.5">
              <span class="text-xs font-medium" :class="isDark ? 'text-zinc-300' : 'text-zinc-700'">Data do atesto</span>
              <input
                v-model="atestoForm.date"
                type="date"
                class="w-44 rounded-lg border px-3 py-2 text-xs outline-none transition-colors"
                :class="isDark
                  ? 'border-white/[.06] bg-zinc-800/50 text-zinc-100 focus:border-blue-500/50 [color-scheme:dark]'
                  : 'border-zinc-200 bg-white text-zinc-800 focus:border-blue-400'"
              />
            </label>

            <p class="text-[.7rem]" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
              O número da entrega sai como <span class="font-semibold">[00]ª entrega</span>, destacado em amarelo, para ser preenchido no Word.
            </p>

            <div
              v-if="error"
              class="rounded-lg border px-3 py-2 text-xs"
              :class="isDark
                ? 'border-red-500/30 bg-red-500/10 text-red-400'
                : 'border-red-200 bg-red-50 text-red-600'"
            >
              {{ error }}
            </div>
          </div>

          <div
            class="flex justify-end gap-2 px-5 py-3 border-t"
            :class="isDark ? 'border-white/[.06]' : 'border-zinc-200'"
          >
            <button
              type="button"
              @click="closeAtestoForm"
              class="rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
              :class="isDark ? 'text-zinc-400 hover:bg-white/[.06]' : 'text-zinc-600 hover:bg-zinc-100'"
            >
              Cancelar
            </button>
            <button
              type="submit"
              :disabled="!atestoFormValid || generatingDocx !== null"
              class="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-blue-500 active:scale-[.97] disabled:opacity-60"
            >
              <div
                v-if="generatingDocx !== null"
                class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"
              />
              {{ generatingDocx !== null ? 'Gerando…' : 'Gerar documento' }}
            </button>
          </div>
        </form>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
