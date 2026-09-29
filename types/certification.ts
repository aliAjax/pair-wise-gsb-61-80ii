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

/** 覆盖单元格状态：已接受 / 待补 / 版本过期（基线变化导致历史接受失效） */
export type CoverageState = 'accepted' | 'pending' | 'stale';

export interface RegulationItem {
  id: string;
  code: string;
  title: string;
  category: '安全' | '环保' | '能耗' | '软件' | '部件';
  required: boolean;
}

export interface EvidenceRevision {
  id: string;
  /** 修订序号，从 1 开始；补件生成新修订，不覆盖历史 */
  revision: number;
  name: string;
  type: 'test_report' | 'part_list' | 'software_report' | 'exemption' | 'certificate';
  version: string;
  softwareVersion: string;
  configurations: string[];
  status: EvidenceStatus;
  expiryDate?: string;
  note: string;
  /** 补件来源：true 表示由批量补件生成 */
  generatedBySupplement?: boolean;
  updatedAt: string;
  updatedBy?: string;
}

export interface EvidenceItem {
  id: string;
  projectId: string;
  regulationId: string;
  /** 修订历史，按修订号升序保留，最后一条为当前修订 */
  revisions: EvidenceRevision[];
}

/** 版本记录中受影响的覆盖单元格（配置 × 法规） */
export interface ImpactedCell {
  configuration: string;
  regulationId: string;
}

export interface ProjectVersion {
  id: string;
  label: string;
  author: string;
  createdAt: string;
  summary: string;
  changes: string[];
  impactedConfigurations: string[];
  /** 本次基线变化影响的法规；与受影响配置组合成失效单元格 */
  impactedRegulations: string[];
  /** 基线变化直接失效（accepted -> stale）的单元格，随版本永久留存 */
  invalidatedCells: ImpactedCell[];
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  detail: string;
  createdAt: string;
  /** 覆盖矩阵变化明细：法规、配置、变化前 -> 变化后 */
  coverageChanges?: CoverageChange[];
}

export interface CoverageChange {
  regulationId: string;
  regulationCode?: string;
  configuration: string;
  from: CoverageState;
  to: CoverageState;
  note?: string;
}

/**
 * 覆盖确认台账：每条记录表示某个法规 × 配置单元格曾被某条证据修订接受。
 * 软件基线变化时，仅将命中（受影响配置 × 受影响法规）且仍有效的记录标记失效；
 * 失效记录永久保留，旧报告与文件版本仍可追溯（stale 单元格的依据）。
 */
export interface CoverageAcceptance {
  id: string;
  regulationId: string;
  configuration: string;
  evidenceId: string;
  revisionId: string;
  softwareVersion: string;
  acceptedAt: string;
  acceptedBy: string;
  invalidatedAt?: string;
  invalidatedBy?: string;
  invalidatedReason?: string;
}

export interface CoverageCell {
  regulationId: string;
  configuration: string;
  state: CoverageState;
  /** 该单元格当前依据的证据修订（pending 时可能为空） */
  revision?: EvidenceRevision;
  /** 当前修订所属证据 ID（补件时据此生成新修订） */
  evidenceId?: string;
  /** stale 时指向仍然可追溯的历史接受修订 */
  acceptedRevision?: EvidenceRevision;
  /** 历史接受修订所属证据 ID */
  acceptedEvidenceId?: string;
  /** 该配置当前生效软件基线 */
  baseline: string;
  note?: string;
}

export interface ApprovalProject {
  id: string;
  name: string;
  modelCode: string;
  vehicleType: string;
  /** 同时申报的多个配置 */
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
  /** 覆盖确认台账，随项目持久化 */
  coverage: CoverageAcceptance[];
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

/** 批量补件入参：按证据（法规）选择补件目标单元格 */
export interface SupplementTarget {
  evidenceId: string;
  /** 需要补件覆盖的配置；缺省为该证据全部待补/过期单元格 */
  configurations?: string[];
}

export interface SupplementInput {
  targets: SupplementTarget[];
  fileVersion?: string;
  softwareVersion?: string;
  note: string;
}
