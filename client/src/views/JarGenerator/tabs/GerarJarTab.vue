<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import {
  useEnvironments, useSystems, useJarGeneration, useReports, useUploadReports,
  type Environment, type Sistema, type ReportFile
} from '../../../composables/useJarGenerator'

const props = defineProps<{ isDark: boolean }>()

const { environments, fetchEnvironments } = useEnvironments()
const { systems, fetchSystems } = useSystems()
const { generating, result, error: genError, generateJar } = useJarGeneration()
const { files: reportFiles, loading: loadingReports, deploying, error: reportError, deployResults, fetchReports, deployReports } = useReports()
const { uploading, error: uploadError, results: uploadResults, uploadReportFiles } = useUploadReports()

const selectedAmbiente = ref<number | null>(null)
const selectedSistemas = ref<number[]>([])
const compileClasses = ref(true)
const generateReportsFlag = ref(false)
const generateAllRules = ref(true)

const selectedReportFiles = ref<string[]>([])
const showReports = ref(false)

const filesToUpload = ref<File[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)

onMounted(async () => {
  await Promise.all([fetchEnvironments(), fetchSystems()])
})

const selectedAmbienteData = computed(() =>
  environments.value.find(e => e.id === selectedAmbiente.value)
)

function toggleSistema(id: number) {
  const idx = selectedSistemas.value.indexOf(id)
  if (idx >= 0) selectedSistemas.value.splice(idx, 1)
  else selectedSistemas.value.push(id)
}

function toggleReport(name: string) {
  const idx = selectedReportFiles.value.indexOf(name)
  if (idx >= 0) selectedReportFiles.value.splice(idx, 1)
  else selectedReportFiles.value.push(name)
}

function toggleAllReports() {
  if (selectedReportFiles.value.length === reportFiles.value.length) {
    selectedReportFiles.value = []
  } else {
    selectedReportFiles.value = reportFiles.value.map(f => f.name)
  }
}

async function handleGenerate() {
  if (!selectedAmbiente.value) return
  await generateJar({
    ambienteId: selectedAmbiente.value,
    sistemaIds: selectedSistemas.value,
    compileClasses: compileClasses.value,
    generateReports: generateReportsFlag.value,
    generateAllRules: generateAllRules.value,
  })
}

async function handleLoadReports() {
  if (!selectedAmbiente.value) return
  showReports.value = true
  selectedReportFiles.value = []
  await fetchReports(selectedAmbiente.value)
}

async function handleDeployReports() {
  if (!selectedAmbiente.value || !selectedSistemas.value.length || !selectedReportFiles.value.length) return
  await deployReports({
    ambienteId: selectedAmbiente.value,
    sistemaIds: selectedSistemas.value,
    fileNames: selectedReportFiles.value,
  })
}

function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files) return
  const allowed = ['.jasper', '.jrxml']
  const newFiles = Array.from(input.files).filter(f =>
    allowed.some(ext => f.name.toLowerCase().endsWith(ext))
  )
  for (const f of newFiles) {
    if (!filesToUpload.value.some(e => e.name === f.name)) {
      filesToUpload.value.push(f)
    }
  }
  input.value = ''
}

function removeFile(index: number) {
  filesToUpload.value.splice(index, 1)
}

async function handleUploadReports() {
  if (!selectedSistemas.value.length || !filesToUpload.value.length) return
  await uploadReportFiles(selectedSistemas.value, filesToUpload.value)
  filesToUpload.value = []
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}
</script>

<template>
  <div class="flex flex-col gap-6">

    <!-- Selecionar Ambiente -->
    <div class="rounded-xl border p-5" :class="isDark ? 'border-white/[.06] bg-zinc-800/30' : 'border-zinc-200 bg-white'">
      <p class="text-xs font-semibold uppercase tracking-wider mb-3" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
        1. Ambiente de Origem
      </p>
      <select v-model.number="selectedAmbiente"
        class="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors"
        :class="isDark ? 'border-white/[.08] bg-zinc-800 text-white focus:border-blue-500' : 'border-zinc-200 bg-white text-zinc-900 focus:border-blue-500'">
        <option :value="null" disabled>Selecione um ambiente…</option>
        <option v-for="env in environments" :key="env.id" :value="env.id">
          {{ env.sistemaNome }} — {{ env.tipo }} ({{ env.serverIp }}/{{ env.contexto }})
        </option>
      </select>
      <div v-if="selectedAmbienteData" class="mt-3 flex flex-col gap-2">
        <div class="grid grid-cols-3 gap-3 text-xs" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
          <span>System Code: <b :class="isDark ? 'text-zinc-300' : 'text-zinc-700'">{{ selectedAmbienteData.systemCode }}</b></span>
          <span>Login: <b :class="isDark ? 'text-zinc-300' : 'text-zinc-700'">{{ selectedAmbienteData.login }}</b></span>
          <span>Contexto: <b :class="isDark ? 'text-zinc-300' : 'text-zinc-700'">{{ selectedAmbienteData.contexto }}</b></span>
        </div>
        <div class="rounded-lg px-3 py-2 font-mono text-[11px] break-all"
          :class="isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-600'">
          POST → {{ selectedAmbienteData.url || `http://${selectedAmbienteData.serverIp}` }}/{{ selectedAmbienteData.contexto }}/services/WFRAdminWebService
        </div>
      </div>
    </div>

    <!-- Opções de compilação -->
    <div class="rounded-xl border p-5" :class="isDark ? 'border-white/[.06] bg-zinc-800/30' : 'border-zinc-200 bg-white'">
      <p class="text-xs font-semibold uppercase tracking-wider mb-3" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
        2. Opções de Compilação
      </p>
      <div class="flex flex-wrap gap-4">
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" v-model="compileClasses" class="accent-blue-500 w-4 h-4" />
          <span class="text-xs font-medium" :class="isDark ? 'text-zinc-300' : 'text-zinc-700'">Compile Classes</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" v-model="generateReportsFlag" class="accent-blue-500 w-4 h-4" />
          <span class="text-xs font-medium" :class="isDark ? 'text-zinc-300' : 'text-zinc-700'">Generate Reports</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" v-model="generateAllRules" class="accent-blue-500 w-4 h-4" />
          <span class="text-xs font-medium" :class="isDark ? 'text-zinc-300' : 'text-zinc-700'">Generate All Rules</span>
        </label>
      </div>
    </div>

    <!-- Selecionar Sistemas Destino -->
    <div class="rounded-xl border p-5" :class="isDark ? 'border-white/[.06] bg-zinc-800/30' : 'border-zinc-200 bg-white'">
      <p class="text-xs font-semibold uppercase tracking-wider mb-3" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
        3. Sistemas Destino (opcional)
      </p>
      <div v-if="systems.length === 0" class="text-xs" :class="isDark ? 'text-zinc-600' : 'text-zinc-400'">
        Nenhum sistema cadastrado. Cadastre na aba "Sistema".
      </div>
      <div v-else class="flex flex-col gap-2">
        <label v-for="sys in systems" :key="sys.id"
          class="flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all"
          :class="[
            selectedSistemas.includes(sys.id)
              ? isDark ? 'border-blue-500/40 bg-blue-500/5' : 'border-blue-300 bg-blue-50'
              : isDark ? 'border-white/[.06] hover:border-white/[.1]' : 'border-zinc-200 hover:border-zinc-300'
          ]">
          <input type="checkbox" :checked="selectedSistemas.includes(sys.id)" @change="toggleSistema(sys.id)"
            class="accent-blue-500 w-4 h-4" />
          <div class="flex-1">
            <span class="text-xs font-semibold" :class="isDark ? 'text-white' : 'text-zinc-900'">{{ sys.nome }}</span>
            <span class="ml-2 text-[10px]" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
              {{ sys.serverNome }} · {{ sys.pathRaiz }}
            </span>
          </div>
        </label>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-3">
      <button @click="handleGenerate"
        :disabled="!selectedAmbiente || generating"
        class="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50 active:scale-[.97]"
        :class="generating ? 'bg-amber-600' : 'bg-blue-600 hover:bg-blue-500'">
        <div v-if="generating" class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        <svg v-else class="w-4 h-4" viewBox="0 0 16 16" fill="none">
          <path d="M2 5l6-3 6 3v6l-6 3-6-3V5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
          <path d="M2 5l6 3 6-3M8 8v6.5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
        </svg>
        {{ generating ? 'Gerando JAR…' : 'Gerar JAR' }}
      </button>

      <button v-if="selectedAmbienteData?.makerInterna" @click="handleLoadReports"
        :disabled="!selectedAmbiente || loadingReports"
        class="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all"
        :class="isDark ? 'border-zinc-700 text-zinc-300 hover:border-zinc-600' : 'border-zinc-300 text-zinc-700 hover:border-zinc-400'">
        <div v-if="loadingReports" class="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        Listar Relatórios
      </button>
    </div>

    <!-- Generation Result -->
    <div v-if="genError" class="rounded-xl border px-4 py-3 text-xs"
      :class="isDark ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-red-200 bg-red-50 text-red-600'">
      {{ genError }}
    </div>

    <div v-if="result" class="rounded-xl border p-5"
      :class="isDark ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50'">
      <p class="text-sm font-semibold mb-2" :class="isDark ? 'text-emerald-400' : 'text-emerald-700'">
        JAR gerado com sucesso!
      </p>
      <p class="text-xs mb-3" :class="isDark ? 'text-zinc-400' : 'text-zinc-600'">
        Arquivo: <b>{{ result.jarFileName }}</b>
      </p>
      <div v-if="result.deployResults.length > 0" class="flex flex-col gap-1">
        <div v-for="(d, i) in result.deployResults" :key="i" class="flex items-center gap-2 text-xs">
          <span v-if="d.success" class="text-emerald-500">&#10003;</span>
          <span v-else class="text-red-500">&#10007;</span>
          <span :class="isDark ? 'text-zinc-300' : 'text-zinc-700'">{{ d.nome }}</span>
          <span v-if="d.error" class="text-red-400">— {{ d.error }}</span>
        </div>
      </div>
    </div>

    <!-- Reports Section -->
    <div v-if="showReports" class="rounded-xl border p-5"
      :class="isDark ? 'border-white/[.06] bg-zinc-800/30' : 'border-zinc-200 bg-white'">
      <div class="flex items-center justify-between mb-3">
        <p class="text-xs font-semibold uppercase tracking-wider" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
          Relatórios
        </p>
        <div class="flex gap-2">
          <button @click="toggleAllReports" class="text-xs text-blue-500 hover:text-blue-400">
            {{ selectedReportFiles.length === reportFiles.length ? 'Desmarcar todos' : 'Selecionar todos' }}
          </button>
        </div>
      </div>

      <div v-if="reportError" class="mb-3 rounded-lg border px-3 py-2 text-xs"
        :class="isDark ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-red-200 bg-red-50 text-red-600'">
        {{ reportError }}
      </div>

      <div v-if="loadingReports" class="flex justify-center py-8">
        <div class="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>

      <div v-else-if="reportFiles.length === 0" class="text-xs py-4 text-center" :class="isDark ? 'text-zinc-600' : 'text-zinc-400'">
        Nenhum relatório encontrado.
      </div>

      <div v-else class="max-h-64 overflow-y-auto flex flex-col gap-1">
        <label v-for="file in reportFiles" :key="file.name"
          class="flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-all text-xs"
          :class="[
            selectedReportFiles.includes(file.name)
              ? isDark ? 'bg-blue-500/10' : 'bg-blue-50'
              : isDark ? 'hover:bg-white/[.02]' : 'hover:bg-zinc-50'
          ]">
          <input type="checkbox" :checked="selectedReportFiles.includes(file.name)" @change="toggleReport(file.name)"
            class="accent-blue-500 w-3.5 h-3.5" />
          <span class="flex-1 font-mono text-[11px]" :class="isDark ? 'text-zinc-300' : 'text-zinc-700'">{{ file.name }}</span>
          <span :class="isDark ? 'text-zinc-600' : 'text-zinc-400'">{{ formatBytes(file.size) }}</span>
        </label>
      </div>

      <button v-if="reportFiles.length > 0 && selectedReportFiles.length > 0"
        @click="handleDeployReports"
        :disabled="!selectedSistemas.length || deploying"
        class="mt-3 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-all">
        <div v-if="deploying" class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
        {{ deploying ? 'Enviando…' : `Enviar ${selectedReportFiles.length} relatório(s)` }}
      </button>

      <!-- Deploy results -->
      <div v-if="deployResults.length > 0" class="mt-3 flex flex-col gap-1">
        <div v-for="(d, i) in deployResults" :key="i" class="flex items-center gap-2 text-xs">
          <span v-if="d.success" class="text-emerald-500">&#10003;</span>
          <span v-else class="text-red-500">&#10007;</span>
          <span :class="isDark ? 'text-zinc-300' : 'text-zinc-700'">{{ d.sistema }} — {{ d.file }}</span>
          <span v-if="d.error" class="text-red-400">{{ d.error }}</span>
        </div>
      </div>
    </div>

    <!-- Upload Relatórios -->
    <div class="rounded-xl border p-5" :class="isDark ? 'border-white/[.06] bg-zinc-800/30' : 'border-zinc-200 bg-white'">
      <p class="text-xs font-semibold uppercase tracking-wider mb-3" :class="isDark ? 'text-zinc-500' : 'text-zinc-400'">
        Upload de Relatórios (.jasper / .jrxml)
      </p>

      <div class="flex flex-col gap-3">
        <div @click="fileInputRef?.click()"
          @dragover.prevent
          @drop.prevent="(e: DragEvent) => { if (e.dataTransfer?.files) { const input = { target: { files: e.dataTransfer.files } } as unknown as Event; onFilesSelected(input) } }"
          class="flex items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 cursor-pointer transition-colors"
          :class="isDark ? 'border-zinc-700 hover:border-zinc-500 text-zinc-500' : 'border-zinc-300 hover:border-zinc-400 text-zinc-400'">
          <div class="text-center">
            <svg class="w-6 h-6 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" />
            </svg>
            <span class="text-xs">Clique ou arraste arquivos .jasper / .jrxml</span>
          </div>
        </div>
        <input ref="fileInputRef" type="file" multiple accept=".jasper,.jrxml" class="hidden" @change="onFilesSelected" />

        <div v-if="filesToUpload.length > 0" class="flex flex-col gap-1 max-h-40 overflow-y-auto">
          <div v-for="(file, i) in filesToUpload" :key="file.name"
            class="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
            :class="isDark ? 'bg-zinc-800' : 'bg-zinc-50'">
            <span class="flex-1 font-mono text-[11px] truncate" :class="isDark ? 'text-zinc-300' : 'text-zinc-700'">{{ file.name }}</span>
            <span :class="isDark ? 'text-zinc-600' : 'text-zinc-400'">{{ formatBytes(file.size) }}</span>
            <button @click="removeFile(i)" class="text-red-400 hover:text-red-300 ml-1">&times;</button>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button @click="handleUploadReports"
            :disabled="!selectedSistemas.length || !filesToUpload.length || uploading"
            class="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-all">
            <div v-if="uploading" class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            {{ uploading ? 'Enviando…' : `Enviar ${filesToUpload.length} arquivo(s)` }}
          </button>
          <span v-if="!selectedSistemas.length && filesToUpload.length > 0" class="text-[10px]"
            :class="isDark ? 'text-amber-400' : 'text-amber-600'">
            Selecione ao menos um sistema destino acima
          </span>
        </div>

        <div v-if="uploadError" class="rounded-lg border px-3 py-2 text-xs"
          :class="isDark ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-red-200 bg-red-50 text-red-600'">
          {{ uploadError }}
        </div>

        <div v-if="uploadResults.length > 0" class="flex flex-col gap-1">
          <div v-for="(r, i) in uploadResults" :key="i" class="flex items-center gap-2 text-xs">
            <span v-if="r.success" class="text-emerald-500">&#10003;</span>
            <span v-else class="text-red-500">&#10007;</span>
            <span :class="isDark ? 'text-zinc-300' : 'text-zinc-700'">{{ r.sistema }} — {{ r.file }}</span>
            <span v-if="r.error" class="text-red-400">{{ r.error }}</span>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>
