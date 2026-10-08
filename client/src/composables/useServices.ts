import { ref } from 'vue';
import { authFetch } from './useAuth';

const API_BASE = '/api';

export type ServiceServer = { id: number; nome: string; ip: string };

export type ServiceInfo = {
  name: string;
  description: string;
  activeState: string;
  subState: string;
  mainPid: number | null;
  since: string | null;
  workingDirectory: string | null;
  execPath: string | null;
};

export type ServiceAction = 'start' | 'stop' | 'restart';

export type ServiceActionRecord = {
  id: number;
  criadoEm: string;
  userLogin: string;
  serverName: string;
  service: string;
  action: string;
  success: boolean;
  message: string;
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error || `Erro ${res.status}`);
  return body as T;
}

export function useServices() {
  const servers = ref<ServiceServer[]>([]);
  const services = ref<ServiceInfo[]>([]);
  const actions = ref<ServiceActionRecord[]>([]);
  const loadingServices = ref(false);
  const busyService = ref<string | null>(null);
  const error = ref<string | null>(null);
  let servicesRequest = 0;

  async function fetchServers() {
    try {
      servers.value = await request<ServiceServer[]>(`${API_BASE}/service-servers`);
    } catch (e: any) {
      error.value = e.message;
    }
  }

  async function fetchServices(serverId: number) {
    const current = ++servicesRequest;
    loadingServices.value = true;
    error.value = null;
    services.value = [];
    try {
      const result = await request<ServiceInfo[]>(`${API_BASE}/servers/${serverId}/services`);
      if (current === servicesRequest) services.value = result;
    } catch (e: any) {
      if (current === servicesRequest) error.value = e.message;
    } finally {
      if (current === servicesRequest) loadingServices.value = false;
    }
  }

  async function fetchActions() {
    actions.value = await request<ServiceActionRecord[]>(`${API_BASE}/service-actions?limit=20`);
  }

  async function runAction(serverId: number, name: string, action: ServiceAction) {
    // Se a lista for recarregada (ex.: troca de servidor) durante a ação, o resultado é descartado.
    const listVersion = servicesRequest;
    const stillCurrent = () => listVersion === servicesRequest;
    busyService.value = name;
    error.value = null;
    try {
      const updated = await request<ServiceInfo>(
        `${API_BASE}/servers/${serverId}/services/${encodeURIComponent(name)}/${action}`,
        { method: 'POST' },
      );
      if (stillCurrent()) services.value = services.value.map((s) => (s.name === name ? updated : s));
    } catch (e: any) {
      if (stillCurrent()) {
        error.value = e.message;
        // A ação pode ter falhado no meio (ex.: restart que deixou o serviço "failed"): busca o estado real.
        try {
          const fresh = await request<ServiceInfo[]>(`${API_BASE}/servers/${serverId}/services`);
          if (stillCurrent()) services.value = fresh;
        } catch { /* mantém a mensagem original da ação */ }
      }
    } finally {
      busyService.value = null;
      fetchActions().catch(() => {});
    }
  }

  async function fetchLogs(serverId: number, name: string, lines: number): Promise<string> {
    const result = await request<{ log: string }>(
      `${API_BASE}/servers/${serverId}/services/${encodeURIComponent(name)}/logs?lines=${lines}`,
    );
    return result.log;
  }

  return {
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
  };
}
