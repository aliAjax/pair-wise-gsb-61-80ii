import { ofetch } from 'ofetch';
import type { ApprovalProject, ProjectFilters } from '~/types/certification';
import { buildCoverageMatrix } from './coverage-matrix';
import { mockFetch } from './mock-fetch';

const client = ofetch.create({
  baseURL: '/api',
  retry: 0
}, {
  fetch: mockFetch as typeof fetch
});

function matches(project: ApprovalProject, filters: ProjectFilters) {
  const query = filters.query.trim().toLowerCase();
  const matchesQuery =
    !query ||
    [project.id, project.name, project.modelCode, project.configurations.join(' '), project.softwareVersion]
      .join(' ')
      .toLowerCase()
      .includes(query);
  const matchesStatus = filters.status === 'all' || project.status === filters.status;
  const matchesAgency = filters.agency === 'all' || project.agency === filters.agency;

  const matrix = buildCoverageMatrix(project).filter((row) => row.regulation.required);
  const hasOutdated = matrix.some((row) => row.cells.some((cell) => cell.status === 'outdated'));
  const hasGap = matrix.some((row) => row.status !== 'complete');
  const matchesRisk =
    filters.risk === 'all' ||
    (filters.risk === 'expiring' && new Date(project.certificateExpiry) <= new Date('2026-12-31')) ||
    (filters.risk === 'missing' && hasGap) ||
    (filters.risk === 'version_conflict' && hasOutdated);

  return matchesQuery && matchesStatus && matchesAgency && matchesRisk;
}

export const certificationApi = {
  async listProjects(filters: ProjectFilters) {
    const projects = await client<ApprovalProject[]>('/projects');
    return projects.filter((project) => matches(project, filters));
  },

  async getProject(id: string) {
    return client<ApprovalProject>(`/projects/${encodeURIComponent(id)}`);
  }
};
