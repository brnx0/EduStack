import { ref } from 'vue'
import { authFetch } from './useAuth'

const API = '/api/jar'

export interface Server {
  id: number
  nome: string
  ip: string
  portaSsh: number
  usuarioSsh: string | null
  senhaSsh: string | null
}

export interface Environment {
  id: number
  codServidor: number
  sistemaNome: string
  tipo: string
  tipoOrigem: string | null
  descricao: string | null
  url: string | null
  contexto: string
  systemCode: string
  dirWebrun: string | null
  dirTomcat: string | null
  servicoTomcat: string | null
  makerInterna: string | null
  makerExterna: string | null
  login: string
  senha: string
  serverNome?: string
  serverIp?: string
}

export interface Sistema {
  id: number
  codServidor: number
  nome: string
  pathRaiz: string
  nomeServico: string
  nomeArquivo: string
  serverNome?: string
  serverIp?: string
}

export interface ReportFile {
  name: string
  size: number
  isDirectory: boolean
  modified: string
}

export interface DeployResult {
  sistemaId?: number
  nome?: string
  sistema?: string
  file?: string
  success: boolean
  error?: string
}

export interface GenerateResult {
  success: boolean
  jarFileName: string
  downloadUrl: string
  deployResults: DeployResult[]
}

async function apiCall<T>(url: string, options?: RequestInit, timeoutMs = 30_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const res = await authFetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    signal: controller.signal,
  }).finally(() => clearTimeout(timer))
  const data = await res.json()
  if (!res.ok) {
    const detail = data.url ? `\nURL: ${data.url}` : ''
    throw new Error((data.error || `Erro ${res.status}`) + detail)
  }
  return data
}

// ── Servers ──

export function useServers() {
  const servers = ref<Server[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchServers() {
    loading.value = true
    error.value = null
    try {
      servers.value = await apiCall<Server[]>(`${API}/servers`)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function saveServer(data: Partial<Server>, id?: number) {
    error.value = null
    try {
      if (id) {
        await apiCall(`${API}/servers/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      } else {
        await apiCall(`${API}/servers`, { method: 'POST', body: JSON.stringify(data) })
      }
      await fetchServers()
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function deleteServer(id: number) {
    error.value = null
    try {
      await apiCall(`${API}/servers/${id}`, { method: 'DELETE' })
      await fetchServers()
    } catch (e: any) {
      error.value = e.message
    }
  }

  return { servers, loading, error, fetchServers, saveServer, deleteServer }
}

// ── Environments ──

export function useEnvironments() {
  const environments = ref<Environment[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchEnvironments() {
    loading.value = true
    error.value = null
    try {
      environments.value = await apiCall<Environment[]>(`${API}/environments`)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function saveEnvironment(data: Partial<Environment>, id?: number) {
    error.value = null
    try {
      if (id) {
        await apiCall(`${API}/environments/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      } else {
        await apiCall(`${API}/environments`, { method: 'POST', body: JSON.stringify(data) })
      }
      await fetchEnvironments()
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function deleteEnvironment(id: number) {
    error.value = null
    try {
      await apiCall(`${API}/environments/${id}`, { method: 'DELETE' })
      await fetchEnvironments()
    } catch (e: any) {
      error.value = e.message
    }
  }

  return { environments, loading, error, fetchEnvironments, saveEnvironment, deleteEnvironment }
}

// ── Systems ──

export function useSystems() {
  const systems = ref<Sistema[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchSystems() {
    loading.value = true
    error.value = null
    try {
      systems.value = await apiCall<Sistema[]>(`${API}/systems`)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function saveSystem(data: Partial<Sistema>, id?: number) {
    error.value = null
    try {
      if (id) {
        await apiCall(`${API}/systems/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      } else {
        await apiCall(`${API}/systems`, { method: 'POST', body: JSON.stringify(data) })
      }
      await fetchSystems()
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function deleteSystem(id: number) {
    error.value = null
    try {
      await apiCall(`${API}/systems/${id}`, { method: 'DELETE' })
      await fetchSystems()
    } catch (e: any) {
      error.value = e.message
    }
  }

  return { systems, loading, error, fetchSystems, saveSystem, deleteSystem }
}

// ── JAR Generation ──

export function useJarGeneration() {
  const generating = ref(false)
  const result = ref<GenerateResult | null>(null)
  const error = ref<string | null>(null)

  async function generateJar(payload: {
    ambienteId: number
    sistemaIds: number[]
    compileClasses: boolean
    generateReports: boolean
    generateAllRules: boolean
  }) {
    generating.value = true
    result.value = null
    error.value = null
    try {
      result.value = await apiCall<GenerateResult>(`${API}/generate`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }, 30 * 60_000)
    } catch (e: any) {
      error.value = e.message
    } finally {
      generating.value = false
    }
  }

  return { generating, result, error, generateJar }
}

// ── Reports ──

export function useReports() {
  const files = ref<ReportFile[]>([])
  const loading = ref(false)
  const deploying = ref(false)
  const error = ref<string | null>(null)
  const deployResults = ref<DeployResult[]>([])

  async function fetchReports(ambienteId: number) {
    loading.value = true
    error.value = null
    try {
      const data = await apiCall<{ files: ReportFile[] }>(`${API}/environments/${ambienteId}/reports`)
      files.value = data.files
    } catch (e: any) {
      error.value = e.message
      files.value = []
    } finally {
      loading.value = false
    }
  }

  async function deployReports(payload: {
    ambienteId: number
    sistemaIds: number[]
    fileNames: string[]
  }) {
    deploying.value = true
    deployResults.value = []
    error.value = null
    try {
      const data = await apiCall<{ results: DeployResult[] }>(`${API}/deploy-reports`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      deployResults.value = data.results
    } catch (e: any) {
      error.value = e.message
    } finally {
      deploying.value = false
    }
  }

  return { files, loading, deploying, error, deployResults, fetchReports, deployReports }
}

// ── Upload Reports ──

export function useUploadReports() {
  const uploading = ref(false)
  const error = ref<string | null>(null)
  const results = ref<DeployResult[]>([])

  async function uploadReportFiles(sistemaIds: number[], files: File[]) {
    uploading.value = true
    results.value = []
    error.value = null
    try {
      const formData = new FormData()
      formData.append('sistemaIds', JSON.stringify(sistemaIds))
      for (const file of files) {
        formData.append('files', file)
      }
      const res = await authFetch(`${API}/upload-reports`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`)
      results.value = data.results
    } catch (e: any) {
      error.value = e.message
    } finally {
      uploading.value = false
    }
  }

  return { uploading, error, results, uploadReportFiles }
}
