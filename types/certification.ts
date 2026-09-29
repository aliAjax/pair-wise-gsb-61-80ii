export const projectStatuses = [
  'draft',
  'submitted',
  'under_review',
  'supplement_required',
  'approved',
  'rejected'
] as const;

export const evidenceStatuses = ['missing', 'submitted', 'accepted', 'rejected', 'resubmit'] as const;

export type ProjectStatus = (typeof projectStatuses)[number];
export type EvidenceStatus = (typeof evidenceStatuses)[number];

/** 覆盖矩阵单元格状态：已接受 / 待补 / 版本过期 / 未覆盖 */
export const coverageCellStatuses = ['accepted', 'pending', 'outdated', 'missing'] as const;
export type CoverageCellStatus = (typeof coverageCellStatuses)[number];

/** 法规行汇总状态 */
export const regulationStatuses = ['complete', 'pending', 'outdated', 'missing'] as const;
export type RegulationStatus = (typeof regulationStatuses)[number];

export interface RegulationItem {
  id: string;
  code: string;
  title: string;
  category: '安全' | '环保' | '能耗' | '软件' | '部件';
  required: boolean;
}

/** 单次覆盖变化，写入审计 */
export interface CoverageChange {
  regulationId: string;
  regulationCode: string;
  configuration: string;
  from: CoverageCellStatus | null;
  to: CoverageCellStatus;
  reason: string;
}

/** 覆盖矩阵单元格：法规 × 配置 */
export interface CoverageCell {
  regulationId: string;
  configuration: string;
  status: CoverageCellStatus;
  /** 当前生效修订（未被取代） */
  current?: EvidenceItem;
  /** 同单元格下已被新修订取代、仍可追溯的历史证据 */
  history: EvidenceItem[];
  /** 单元格状态说明 */
  detail: string;
}

export interface RegulationCoverageRow {
  regulation: RegulationItem;
  cells: CoverageCell[];
  status: RegulationStatus;
  coverage: number;
  issues: string[];
}

export interface EvidenceRevision {
  /** 修订序号，首版为 1，补件逐次递增 */
  revision: number;
  /** 修订时的文件版本 */
  version: string;
  /** 修订时的软件基线 */
  softwareVersion: string;
  status: EvidenceStatus;
  note: string;
  actor: string;
  createdAt: string;
}

export interface EvidenceItem {
  id: string;
  projectId: string;
  regulationId: string;
  name: string;
  type: 'test_report' | 'part_list' | 'software_report' | 'exemption' | 'certificate';
  /** 当前文件版本 */
  version: string;
  softwareVersion: string;
  configurations: string[];
  status: EvidenceStatus;
  expiryDate?: string;
  note: string;
  updatedAt: string;
  /** 修订链标识：同一原始证据的各次修订共享 */
  revisionGroupId: string;
  /** 修订序号 */
  revision: number;
  /** 已被更新的补件修订取代；留档可追溯，不再参与覆盖计算 */
  supersededBy?: string;
  /** 首版证据 id；首版自身等于 id */
  supersedes?: string;
  /** 修订历史（含当前） */
  revisions: EvidenceRevision[];
}

export interface ProjectVersion {
  id: string;
  label: string;
  author: string;
  createdAt: string;
  summary: string;
  changes: string[];
  impactedConfigurations: string[];
  /** 该版本由批量补件产生时，关联的证据 id 与修订号 */
  supplementEvidence?: { id: string; revision: number }[];
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  detail: string;
  createdAt: string;
  /** 覆盖变化明细（基线变更、补件、审阅接受/退回时填写） */
  coverageChanges?: CoverageChange[];
  kind?: 'status' | 'version' | 'evidence' | 'supplement' | 'project' | 'coverage';
}

export interface ApprovalProject {
  id: string;
  name: string;
  modelCode: string;
  vehicleType: string;
  /** 申报配置列表（支持一次申报多个配置） */
  configurations: string[];
  maintenanceVersion: string;
  softwareVersion: string;
  status: ProjectStatus;
  progress: number;
  applicant: string;
  reviewer: string;
  agency: string;
  submittedAt?: string;
  updatedAt: string;
  certificateExpiry: string;
  regulations: RegulationItem[];
  evidence: EvidenceItem[];
  versions: ProjectVersion[];
  audit: AuditEntry[];
}

export interface ProjectInput {
  name: string;
  modelCode: string;
  vehicleType: string;
  configurations: string[];
  maintenanceVersion: string;
  softwareVersion: string;
  applicant: string;
  agency: string;
  certificateExpiry: string;
}

export interface ProjectFilters {
  query: string;
  status: ProjectStatus | 'all';
  agency: string | 'all';
  risk: 'all' | 'expiring' | 'missing' | 'version_conflict';
}
