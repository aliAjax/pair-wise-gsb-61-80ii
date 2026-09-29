import { defineStore } from 'pinia';
import { seedProjects } from '~/data/seed';
import { buildCoverageMatrix } from '~/services/coverage';
import type {
  ApprovalProject,
  AuditEntry,
  CoverageAcceptance,
  CoverageChange,
  CoverageState,
  EvidenceItem,
  EvidenceRevision,
  ImpactedCell,
  ProjectInput,
  ProjectStatus,
  ProjectVersion,
  RegulationItem,
  SupplementInput
} from '~/types/certification';

const STORAGE_KEY = 'vehicle-type-approval-projects-v2';

function cloneSeed() {
  return structuredClone(seedProjects);
}

function makeId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`;
}

function audit(actor: string, action: string, detail: string, coverageChanges?: CoverageChange[]): AuditEntry {
  return {
    id: makeId('AUD'),
    actor,
    action,
    detail,
    createdAt: new Date().toISOString(),
    coverageChanges
  };
}

function bumpVersion(version: string) {
  const match = version.match(/^([A-Za-z]*)(\d+)$/);
  if (match) return `${match[1]}${Number(match[2]) + 1}`;
  return `${version}.1`;
}

function regulationCode(project: ApprovalProject, regulationId: string) {
  return project.regulations.find((item) => item.id === regulationId)?.code;
}

type CellSnapshot = Map<string, CoverageState>;

function snapshot(project: ApprovalProject): CellSnapshot {
  const map: CellSnapshot = new Map();
  for (const cell of buildCoverageMatrix(project).cells) {
    map.set(`${cell.regulationId}@@${cell.configuration}`, cell.state);
  }
  return map;
}

function diff(project: ApprovalProject, before: CellSnapshot): CoverageChange[] {
  const changes: CoverageChange[] = [];
  for (const cell of buildCoverageMatrix(project).cells) {
    const key = `${cell.regulationId}@@${cell.configuration}`;
    const previous = before.get(key);
    if (previous && previous !== cell.state) {
      changes.push({
        regulationId: cell.regulationId,
        regulationCode: regulationCode(project, cell.regulationId),
        configuration: cell.configuration,
        from: previous,
        to: cell.state,
        note: cell.state === 'pending' ? cell.note : undefined
      });
    }
  }
  return changes;
}

const starterRegulations = (): RegulationItem[] => [
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
];

export interface BaselineChangeOptions {
  reason: string;
  /** 本次基线变化影响的配置；仅这些配置下的单元格会失效 */
  impactedConfigurations: string[];
  /** 本次基线变化影响的法规；缺省为全部必选法规 */
  impactedRegulations?: string[];
}

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
        project.evidence
          .flatMap((item) => item.revisions)
          .filter((revision) => revision.expiryDate)
          .map((revision) => ({ project, evidence: revision }))
          .filter(({ evidence }) => new Date(evidence.expiryDate!) <= new Date('2027-01-31'))
      )
  },

  actions: {
    hydrate() {
      if (this.hydrated || typeof localStorage === 'undefined') return;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) this.projects = JSON.parse(raw) as ApprovalProject[];
      } catch {
        this.projects = cloneSeed();
      }
      this.hydrated = true;
    },

    persist() {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.projects));
      }
    },

    recomputeProgress(project: ApprovalProject) {
      project.progress = buildCoverageMatrix(project).coveragePercent;
    },

    createProject(input: ProjectInput) {
      const createdAt = new Date().toISOString();
      const project: ApprovalProject = {
        id: `TA-${new Date().getFullYear()}-${String(this.projects.length + 121).padStart(3, '0')}`,
        ...input,
        configurations: [...input.configurations],
        status: 'draft',
        progress: 0,
        reviewer: '待分派',
        updatedAt: createdAt,
        regulations: starterRegulations(),
        evidence: [],
        coverage: [],
        versions: [
          {
            id: makeId('VER'),
            label: `${input.maintenanceVersion} / ${input.softwareVersion}`,
            author: input.applicant,
            createdAt,
            summary: '创建认证证据包草稿。',
            changes: ['录入车型、申报配置和维护版本', '建立基础法规项'],
            impactedConfigurations: [...input.configurations],
            impactedRegulations: [],
            invalidatedCells: []
          }
        ],
        audit: [audit(input.applicant, '建立项目', `创建型式认证证据包草稿，申报配置：${input.configurations.join('、')}。`)]
      };
      this.projects.unshift(project);
      this.persist();
      return project.id;
    },

    updateProject(id: string, input: ProjectInput, options: BaselineChangeOptions) {
      const project = this.projects.find((item) => item.id === id);
      if (!project) return false;

      const before = snapshot(project);
      const previous = {
        maintenanceVersion: project.maintenanceVersion,
        softwareVersion: project.softwareVersion,
        configurations: [...project.configurations]
      };

      const baselineChanged =
        previous.maintenanceVersion !== input.maintenanceVersion ||
        previous.softwareVersion !== input.softwareVersion;
      const addedConfigurations = input.configurations.filter((name) => !previous.configurations.includes(name));
      const removedConfigurations = previous.configurations.filter((name) => !input.configurations.includes(name));

      Object.assign(project, {
        name: input.name,
        modelCode: input.modelCode,
        vehicleType: input.vehicleType,
        configurations: [...input.configurations],
        maintenanceVersion: input.maintenanceVersion,
        softwareVersion: input.softwareVersion,
        applicant: input.applicant,
        agency: input.agency,
        certificateExpiry: input.certificateExpiry
      }, { updatedAt: new Date().toISOString() });

      const changedLabels: string[] = [];
      if (previous.maintenanceVersion !== input.maintenanceVersion) changedLabels.push('维护版本');
      if (previous.softwareVersion !== input.softwareVersion) changedLabels.push('软件版本');
      if (addedConfigurations.length || removedConfigurations.length) changedLabels.push('配置范围');

      let invalidatedCells: ImpactedCell[] = [];
      const impactedConfigurations = options.impactedConfigurations.filter((name) =>
        input.configurations.includes(name)
      );
      const impactedRegulations = options.impactedRegulations?.length
        ? options.impactedRegulations
        : project.regulations.filter((item) => item.required).map((item) => item.id);

      if (baselineChanged) {
        // 基线变化：仅让受影响配置 × 受影响法规的有效接受单元格失效
        const now = new Date().toISOString();
        const configSet = new Set(impactedConfigurations);
        const regSet = new Set(impactedRegulations);
        for (const entry of project.coverage) {
          if (
            entry.invalidatedAt ||
            !configSet.has(entry.configuration) ||
            !regSet.has(entry.regulationId)
          ) {
            continue;
          }
          entry.invalidatedAt = now;
          entry.invalidatedBy = project.applicant;
          entry.invalidatedReason = '软件基线变化';
          invalidatedCells.push({ configuration: entry.configuration, regulationId: entry.regulationId });
        }
      }

      const changes: string[] = [];
      if (previous.softwareVersion !== input.softwareVersion) {
        changes.push(`软件版本 ${previous.softwareVersion} → ${input.softwareVersion}`);
      }
      if (previous.maintenanceVersion !== input.maintenanceVersion) {
        changes.push(`维护版本 ${previous.maintenanceVersion} → ${input.maintenanceVersion}`);
      }
      if (addedConfigurations.length) changes.push(`新增申报配置：${addedConfigurations.join('、')}`);
      if (removedConfigurations.length) changes.push(`移除申报配置：${removedConfigurations.join('、')}`);

      if (changedLabels.length) {
        const summary = `更新${changedLabels.join('、')}：${options.reason}`;
        const version: ProjectVersion = {
          id: makeId('VER'),
          label: `${input.maintenanceVersion} / ${input.softwareVersion}`,
          author: project.applicant,
          createdAt: new Date().toISOString(),
          summary,
          changes,
          impactedConfigurations,
          impactedRegulations: baselineChanged ? impactedRegulations : [],
          invalidatedCells
        };
        project.versions.unshift(version);

        const detailParts = [
          ...changes,
          baselineChanged
            ? `受影响配置：${impactedConfigurations.join('、') || '无'}；失效 ${invalidatedCells.length} 个覆盖单元格，旧报告保留可追溯`
            : ''
        ].filter(Boolean);
        project.audit.unshift(audit(project.applicant, '更新版本', `${summary}。${detailParts.join('；')}`, diff(project, before)));
      } else {
        project.audit.unshift(audit(project.applicant, '更新项目资料', options.reason));
      }

      this.recomputeProgress(project);
      this.persist();
      return true;
    },

    transition(id: string, status: ProjectStatus, actor: string, reason: string) {
      const project = this.projects.find((item) => item.id === id);
      if (!project) return false;
      if (status === 'approved') {
        const open = buildCoverageMatrix(project).openCells;
        if (open.length) return false;
      }
      project.status = status;
      if (status === 'submitted' && !project.submittedAt) project.submittedAt = new Date().toISOString().slice(0, 10);
      if (status === 'approved') project.progress = 100;
      project.updatedAt = new Date().toISOString();
      project.audit.unshift(audit(actor, '审批状态流转', `状态变更为 ${status}。${reason}`));
      this.persist();
      return true;
    },

    /**
     * 审阅证据最新修订：接受则按修订覆盖的配置写入覆盖确认台账；
     * 拒绝 / 重交 / 缺失则失效该证据支撑的有效接受记录。覆盖变化写入审计。
     */
    updateEvidence(projectId: string, evidenceId: string, status: EvidenceRevision['status'], note: string, actor?: string) {
      const project = this.projects.find((item) => item.id === projectId);
      const evidence = project?.evidence.find((item) => item.id === evidenceId);
      if (!project || !evidence) return false;

      const before = snapshot(project);
      const revision = evidence.revisions[evidence.revisions.length - 1];
      const now = new Date().toISOString();
      const reviewer = actor || project.reviewer || '认证机构审阅人';

      revision.status = status;
      revision.note = note || revision.note;
      revision.updatedAt = now;
      revision.updatedBy = reviewer;

      if (status === 'accepted') {
        for (const configuration of revision.configurations) {
          const active = project.coverage.find(
            (entry) =>
              entry.regulationId === evidence.regulationId &&
              entry.configuration === configuration &&
              !entry.invalidatedAt
          );
          if (active) {
            if (active.evidenceId === evidence.id && active.revisionId === revision.id) continue;
            // 同一证据的新修订被接受：旧接受记录标记为被替代，但仍保留可追溯
            active.invalidatedAt = now;
            active.invalidatedBy = reviewer;
            active.invalidatedReason = `被修订 ${revision.version} 替代`;
          }
          const entry: CoverageAcceptance = {
            id: makeId('ACC'),
            regulationId: evidence.regulationId,
            configuration,
            evidenceId: evidence.id,
            revisionId: revision.id,
            softwareVersion: revision.softwareVersion,
            acceptedAt: now,
            acceptedBy: reviewer
          };
          project.coverage.push(entry);
        }
      } else if (status === 'rejected' || status === 'resubmit' || status === 'missing') {
        for (const entry of project.coverage) {
          if (entry.evidenceId !== evidence.id || entry.invalidatedAt) continue;
          entry.invalidatedAt = now;
          entry.invalidatedBy = reviewer;
          entry.invalidatedReason = status === 'rejected' ? '最新修订被拒绝' : '审阅要求重新抽样测试';
        }
      }

      project.updatedAt = now;
      this.recomputeProgress(project);
      const changes = diff(project, before);
      project.audit.unshift(
        audit(
          reviewer,
          '审阅证据',
          `${revision.name} 修订 ${revision.version} 标记为${status}。${revision.note}`,
          changes
        )
      );
      this.persist();
      return true;
    },

    /**
     * 批量补件：为每个目标证据追加一条新修订（状态 submitted），不覆盖历史修订；
     * 旧接受记录保留在台账中。版本过期单元格随补件提交转为待审阅（pending）。
     */
    supplement(projectId: string, input: SupplementInput) {
      const project = this.projects.find((item) => item.id === projectId);
      if (!project) return { count: 0, revisionIds: [] as string[] };

      const before = snapshot(project);
      const now = new Date().toISOString();
      let count = 0;
      const revisionIds: string[] = [];

      for (const target of input.targets) {
        const evidence = project.evidence.find((item) => item.id === target.evidenceId);
        if (!evidence) continue;
        const previous = evidence.revisions[evidence.revisions.length - 1];
        const configurations = target.configurations?.length ? [...target.configurations] : [...previous.configurations];
        if (!configurations.length) continue;

        const revision: EvidenceRevision = {
          id: makeId('REV'),
          revision: previous.revision + 1,
          name: previous.name,
          type: previous.type,
          version: input.fileVersion?.trim() || bumpVersion(previous.version),
          softwareVersion: input.softwareVersion?.trim() || project.softwareVersion,
          configurations,
          status: 'submitted',
          expiryDate: previous.expiryDate,
          note: input.note,
          generatedBySupplement: true,
          updatedAt: now,
          updatedBy: project.applicant
        };
        evidence.revisions.push(revision);
        revisionIds.push(revision.id);
        count += 1;
      }

      if (count) {
        project.updatedAt = now;
        this.recomputeProgress(project);
        const changes = diff(project, before);
        project.audit.unshift(
          audit(
            project.applicant,
            '批量补件',
            `生成 ${count} 条新修订（${revisionIds.length} 个证据文件），历史报告与旧版本保留可追溯；软件基线 SW ${project.softwareVersion}。${input.note}`,
            changes
          )
        );
        this.persist();
      }
      return { count, revisionIds };
    },

    addEvidence(
      projectId: string,
      input: {
        regulationId: string;
        name: string;
        type: EvidenceRevision['type'];
        version: string;
        configurations: string[];
        note: string;
      }
    ) {
      const project = this.projects.find((item) => item.id === projectId);
      if (!project || !input.configurations.length) return false;
      const now = new Date().toISOString();
      const evidence: EvidenceItem = {
        id: makeId('EV'),
        projectId,
        regulationId: input.regulationId,
        revisions: [
          {
            id: makeId('REV'),
            revision: 1,
            name: input.name,
            type: input.type,
            version: input.version,
            softwareVersion: project.softwareVersion,
            configurations: [...input.configurations],
            status: 'submitted',
            note: input.note,
            updatedAt: now,
            updatedBy: project.applicant
          }
        ]
      };
      project.evidence.push(evidence);
      project.updatedAt = now;
      project.audit.unshift(
        audit(project.applicant, '关联证据', `新增证据《${input.name}》版本 ${input.version}，覆盖 ${input.configurations.join('、')}，等待审阅。`)
      );
      this.persist();
      return true;
    },

    reset() {
      this.projects = cloneSeed();
      this.persist();
    }
  }
});
