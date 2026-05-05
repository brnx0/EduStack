import { ref } from 'vue';
import { authFetch } from './useAuth';

const API_BASE = '/api';

export type Project = {
  COD_PROJETO: number;
  PRO_NOME: string;
  PRO_DESCRICAO: string;
};

export type Sprint = {
  COD_VERSAO: number;
  VER_NOME: string;
  VER_LIBERA: string;
  VER_DATA: string;
  VER_PREV_DATA: string;
};

export function useProjects() {
  const projects = ref<Project[]>([]);
  const sprints = ref<Sprint[]>([]);
  const loadingProjects = ref(false);
  const loadingSprints = ref(false);
  const generatingDocx = ref<number | null>(null);
  const error = ref<string | null>(null);

  async function fetchProjects() {
    loadingProjects.value = true;
    error.value = null;
    try {
      const res = await authFetch(`${API_BASE}/projects`);
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      projects.value = await res.json();
    } catch (e: any) {
      error.value = e.message;
    } finally {
      loadingProjects.value = false;
    }
  }

  async function fetchSprints(projectId: number) {
    loadingSprints.value = true;
    sprints.value = [];
    error.value = null;
    try {
      const res = await authFetch(`${API_BASE}/projects/${projectId}/sprints`);
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      sprints.value = await res.json();
    } catch (e: any) {
      error.value = e.message;
    } finally {
      loadingSprints.value = false;
    }
  }

  async function downloadDocx(sprintId: number, sprintName: string) {
    generatingDocx.value = sprintId;
    error.value = null;
    try {
      const res = await authFetch(`${API_BASE}/sprints/${sprintId}/docx`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Atesto_${sprintName.replace(/\s+/g, '_')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      error.value = e.message;
    } finally {
      generatingDocx.value = null;
    }
  }

  return {
    projects,
    sprints,
    loadingProjects,
    loadingSprints,
    generatingDocx,
    error,
    fetchProjects,
    fetchSprints,
    downloadDocx,
  };
}
