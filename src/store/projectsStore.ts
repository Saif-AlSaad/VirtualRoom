import { create } from 'zustand';
import type { Project } from '@/types';
import {
  deleteProject as removeProject,
  listProjects,
  loadProject,
  saveProject,
  setLastOpenProject,
  type ProjectSummary,
  type StorageResult,
} from '@/utils/storage';
import { createProjectId } from '@/utils/id';

/**
 * The project library — the dashboard's model.
 *
 * Kept separate from the editor store: the dashboard needs cheap summaries of
 * every project, while the editor needs the full document of exactly one. Mixing
 * them would mean deserialising every saved room to render a list.
 */

interface ProjectsState {
  projects: ProjectSummary[];
  refresh: () => void;
  save: (project: Project) => StorageResult<void>;
  open: (id: string) => Project | null;
  remove: (id: string) => void;
  duplicate: (id: string) => Project | null;
  rename: (id: string, name: string) => void;
}

export const useProjects = create<ProjectsState>((set, get) => ({
  projects: typeof window === 'undefined' ? [] : listProjects(),

  refresh: () => set({ projects: listProjects() }),

  save: (project) => {
    const result = saveProject(project);
    if (result.ok) set({ projects: listProjects() });
    return result;
  },

  open: (id) => {
    const project = loadProject(id);
    if (project) setLastOpenProject(id);
    return project;
  },

  remove: (id) => {
    removeProject(id);
    set({ projects: listProjects() });
  },

  duplicate: (id) => {
    const source = loadProject(id);
    if (!source) return null;
    const now = Date.now();
    const copy: Project = {
      ...source,
      id: createProjectId(),
      name: nextCopyName(source.name, get().projects),
      createdAt: now,
      updatedAt: now,
    };
    const result = saveProject(copy);
    if (!result.ok) return null;
    set({ projects: listProjects() });
    return copy;
  },

  rename: (id, name) => {
    const project = loadProject(id);
    if (!project) return;
    project.name = name.slice(0, 80).trim() || 'Untitled room';
    project.updatedAt = Date.now();
    saveProject(project);
    set({ projects: listProjects() });
  },
}));

/** "Bedroom" → "Bedroom copy" → "Bedroom copy 2" … */
function nextCopyName(base: string, existing: ProjectSummary[]): string {
  const stripped = base.replace(/ copy(?: \d+)?$/i, '');
  const names = new Set(existing.map((p) => p.name));
  let candidate = `${stripped} copy`;
  let n = 2;
  while (names.has(candidate)) {
    candidate = `${stripped} copy ${n}`;
    n += 1;
  }
  return candidate.slice(0, 80);
}
