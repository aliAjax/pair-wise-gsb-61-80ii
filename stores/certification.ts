import { defineStore } from 'pinia';
import { seedProjects } from '~/data/seed';
import {
  activeEvidence,
  buildCoverageMatrix,
  coverageSnapshot,
  diffCoverage
} from '~/services/coverage-matrix';
import { migrateLegacyProjects } from '~/services/migrate-legacy';
import type {
  ApprovalProject,
  AuditEntry,
  CoverageChange,
  EvidenceItem,
  EvidenceRevision,
  ProjectInput,
  ProjectStatus,
  ProjectVersion
} from '~/types/certification';

const STORAGE_KEY = 'vehicle-type-approval-projects-v2';
const LEGACY_STORAGE_KEY = 'vehicle-type-approval-projects-v1';

function cloneSeed() {
  return structuredClone(seedProjects);
}

function makeId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`;
}

function audit(
  actor: string,
  action: string,
  detail: string,
  kind: AuditEntry['kind'] = 'project',
  coverageChanges?: CoverageChange[]
): AuditEntry {
  return {
    id: makeId('AUD'),
    actor,
    action,
    detail,
    createdAt: new Date().toISOString(),
    kind,
    coverageChanges
  };
}

/** 补件修订号：R3 → R4、S2 → S3、D1 → D2，无数字尾缀时追加 .1 */
function bumpVersion(version: string) {
  const match = version.match(/^(.*?)(\d+)$/);
  if (!match) return `${version}.1`;
  return `${match[1]}${Number(match[2]) + 1}`;
}

/** 进度只按必选法规的已接受单元格计算，避免“表面通过” */
function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function recomputeProgress(project: ApprovalProject) {
  if (project.status === 'approved') {
    project.progress = 100;
    return;
  }
  const rows = buildCoverageMatrix(project).filter((row) => row.regulation.required);
  const total = rows.reduce((sum, row) => sum + row.cells.length, 0);
  const accepted = rows.reduce(
    (sum, row) => sum + row.cells.filter((cell) => cell.status === 'accepted').length,
    0
  );
  project.progress = total ? Math.round((accepted / total) * 100) : 0;
}

/** 迁移逻辑见 services/migrate-legacy.ts */

export const useCertificationStore = defineStore('certification', {
  state: () => ({
    projects: cloneSeed(),
    hydrated: false
  }),

  getters: {
    projectById: (state) => (id: string) => state.projects.find((project) => project.id === id),
    agencies: (state) => Array.from(new Set(state.projects.map((project) => project.agency))).sort(),
    expiringEvidence: (state) =>
      state.projects.flatMap((project) =>
        activeEvidence(project)
          .filter((item) => item.expiryDate)
          .map((item) => ({ project, evidence: item }))
          .filter(({ evidence }) => new Date(evidence.expiryDate!) <= new Date('2027-01-31'))
      )
  },

  actions: {
    hydrate() {
      if (this.hydrated || typeof localStorage === 'undefined') return;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          this.projects = JSON.parse(raw) as ApprovalProject[];
        } else {
          const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
          if (legacy) {
            this.projects = migrateLegacyProjects(legacy);
            this.persist();
          }
        }
      } catch {
        this.projects = cloneSeed();
      }
      this.projects.forEach((project) => recomputeProgress(project));
      this.hydrated = true;
    },

    persist() {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.projects));
      }
    },

    createProject(input: ProjectInput) {
      const createdAt = new Date().toISOString();
      const project: ApprovalProject = {
        id: `TA-${new Date().getFullYear()}-${String(this.projects.length + 121).padStart(3, '0')}`,
        ...input,
        status: 'draft',
        progress: 0,
        reviewer: '待分派',
        updatedAt: createdAt,
        regulations: [
          {
            id: 'REG-BRAKE',
            code: 'GB 21670',
            title: '乘用车制动系统技术要求',
            category: '安全',
            required: true
          },
          {
            id: 'REG-EMC',
            code: 'GB 34660',
            title: '道路车辆电磁兼容性要求',
            category: '环保',
            required: true
          }
        ],
        evidence: [],
        versions: [
          {
            id: makeId('VER'),
            label: `${input.maintenanceVersion} / ${input.softwareVersion}`,
            author: input.applicant,
            createdAt,
            summary: '创建认证证据包草稿。',
            changes: ['录入车型、申报配置和维护版本', '建立基础法规项'],
            impactedConfigurations: [...input.configurations]
          }
        ],
        audit: [audit(input.applicant, '建立项目', '创建型式认证证据包草稿。')]
      };
      this.projects.unshift(project);
      this.persist();
      return project.id;
    },

    updateProject(id: string, input: ProjectInput, reason: string) {
      const project = this.projects.find((item) => item.id === id);
      if (!project) return false;

      const before = coverageSnapshot(project);
      const previous = {
        maintenanceVersion: project.maintenanceVersion,
        softwareVersion: project.softwareVersion,
        configurations: [...project.configurations]
      };

      Object.assign(project, input, { updatedAt: new Date().toISOString() });

      const changed: string[] = [];
      if (previous.maintenanceVersion !== input.maintenanceVersion) changed.push('维护版本');
      if (previous.softwareVersion !== input.softwareVersion) changed.push('软件版本');
      const addedConfigs = input.configurations.filter((name) => !previous.configurations.includes(name));
      const removedConfigs = previous.configurations.filter((name) => !input.configurations.includes(name));
      if (addedConfigs.length || removedConfigs.length) changed.push('配置范围');

      // 基线变化时，只统计真正受影响的配置（在旧基线下已接受的单元格）
      const impactedConfigurations = Array.from(
        new Set(
          activeEvidence(project)
            .filter(
              (item) =>
                previous.softwareVersion !== input.softwareVersion &&
                item.status === 'accepted' &&
                item.softwareVersion === previous.softwareVersion
            )
            .flatMap((item) => item.configurations)
        )
      );

      let entry: AuditEntry;
      if (changed.length) {
        const changeSummary: string[] = [];
        if (addedConfigs.length) changeSummary.push(`新增配置：${addedConfigs.join('、')}`);
        if (removedConfigs.length) changeSummary.push(`移除配置：${removedConfigs.join('、')}`);

        const version: ProjectVersion = {
          id: makeId('VER'),
          label: `${input.maintenanceVersion} / ${input.softwareVersion}`,
          author: project.applicant,
          createdAt: new Date().toISOString(),
          summary: `更新${changed.join('、')}：${reason}`,
          changes: [...changed, ...changeSummary],
          impactedConfigurations: impactedConfigurations.length
            ? impactedConfigurations
            : addedConfigs.length
              ? addedConfigs
              : input.configurations
        };
        project.versions.unshift(version);

        const coverageChanges = diffCoverage(before, buildCoverageMatrix(project), reason);
        entry = audit(
          project.applicant,
          '更新项目版本',
          `${changed.join('、')}；受影响配置：${version.impactedConfigurations.join('、') || '无'}；${reason}`,
          'version',
          coverageChanges
        );
      } else {
        entry = audit(project.applicant, '更新项目资料', reason);
      }
      project.audit.unshift(entry);
      recomputeProgress(project);
      this.persist();
      return true;
    },

    transition(id: string, status: ProjectStatus, actor: string, reason: string) {
      const project = this.projects.find((item) => item.id === id);
      if (!project) return false;
      if (status === 'approved') {
        const blockers = buildCoverageMatrix(project)
          .filter((row) => row.regulation.required)
          .flatMap((row) => row.cells.filter((cell) => cell.status !== 'accepted'));
        if (blockers.length) return false;
      }
      const before = coverageSnapshot(project);
      project.status = status;
      if (status === 'submitted') project.submittedAt = new Date().toISOString().slice(0, 10);
      project.updatedAt = new Date().toISOString();
      const coverageChanges = diffCoverage(before, buildCoverageMatrix(project), reason);
      project.audit.unshift(audit(actor, '审批状态流转', `${status}；${reason}`, 'status', coverageChanges));
      recomputeProgress(project);
      this.persist();
      return true;
    },

    updateEvidence(projectId: string, evidenceId: string, status: EvidenceItem['status'], note: string) {
      const project = this.projects.find((item) => item.id === projectId);
      const evidence = project?.evidence.find((item) => item.id === evidenceId);
      if (!project || !evidence || evidence.supersededBy) return false;
      const before = coverageSnapshot(project);
      evidence.status = status;
      if (note) evidence.note = note;
      evidence.updatedAt = new Date().toISOString();
      project.updatedAt = evidence.updatedAt;
      const coverageChanges = diffCoverage(
        before,
        buildCoverageMatrix(project),
        `审阅证据 ${evidence.name}`
      );
      project.audit.unshift(
        audit(
          project.reviewer === '待分派' ? '认证机构审阅人' : project.reviewer,
          '更新证据状态',
          `${evidence.name}（${evidence.version} / SW ${evidence.softwareVersion}）：${status}`,
          'evidence',
          coverageChanges
        )
      );
      recomputeProgress(project);
      this.persist();
      return true;
    },

    /**
     * 批量补件：为每份证据生成新修订（新版本号 + 当前软件基线），
     * 旧修订标记 supersededBy 并原样留档；新修订状态为 submitted，必须重新审阅接受。
     */
    bulkSupplement(projectId: string, evidenceIds: string[], note: string, actor?: string) {
      const project = this.projects.find((item) => item.id === projectId);
      if (!project) return { count: 0 };
      const before = coverageSnapshot(project);
      const now = new Date().toISOString();
      const supplementedConfigs: string[] = [];
      let count = 0;

      evidenceIds.forEach((evidenceId) => {
        const previous = project.evidence.find((item) => item.id === evidenceId);
        if (!previous || previous.supersededBy) return;

        supplementedConfigs.push(...previous.configurations);
        const newRevisionNo = previous.revision + 1;
        const newId = makeId('EV');
        const newVersion = bumpVersion(previous.version);
        const revisionEntry: EvidenceRevision = {
          revision: newRevisionNo,
          version: newVersion,
          softwareVersion: project.softwareVersion,
          status: 'submitted',
          note,
          actor: actor ?? project.applicant,
          createdAt: now
        };

        // 旧报告留档：只记录被哪一版取代，状态、版本、软件基线保持原样可追溯
        previous.supersededBy = newId;

        const next: EvidenceItem = {
          ...deepClone(previous),
          id: newId,
          version: newVersion,
          softwareVersion: project.softwareVersion,
          status: 'submitted',
          note,
          updatedAt: now,
          revision: newRevisionNo,
          revisionGroupId: previous.revisionGroupId,
          supersedes: previous.id,
          supersededBy: undefined,
          expiryDate: previous.expiryDate,
          revisions: [...previous.revisions, revisionEntry]
        };
        project.evidence.push(next);
        count += 1;
      });

      if (count) {
        project.updatedAt = now;
        const coverageChanges = diffCoverage(before, buildCoverageMatrix(project), '批量补件生成新修订');
        const scope = Array.from(new Set(supplementedConfigs));
        project.audit.unshift(
          audit(
            actor ?? project.applicant,
            '批量补件',
            `${count} 项证据生成新修订并重新提交至 SW ${project.softwareVersion}，旧报告留档待审阅；影响配置：${scope.join('、') || '无'}。${note}`,
            'supplement',
            coverageChanges
          )
        );
        recomputeProgress(project);
        this.persist();
      }
      return { count };
    },

    reset() {
      this.projects = cloneSeed();
      this.persist();
    }
  }
});
