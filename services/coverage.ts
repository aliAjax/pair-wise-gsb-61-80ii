import type {
  ApprovalProject,
  CoverageAcceptance,
  CoverageCell,
  CoverageState,
  EvidenceItem,
  EvidenceRevision,
  RegulationItem
} from '~/types/certification';

export function latestRevision(evidence: EvidenceItem): EvidenceRevision | undefined {
  return evidence.revisions[evidence.revisions.length - 1];
}

/** 该法规 × 配置单元格当前仍有效的接受记录（台账中最后一条未失效记录） */
export function activeAcceptance(
  project: ApprovalProject,
  regulationId: string,
  configuration: string
): CoverageAcceptance | undefined {
  let active: CoverageAcceptance | undefined;
  for (const entry of project.coverage) {
    if (entry.regulationId !== regulationId || entry.configuration !== configuration) continue;
    if (!entry.invalidatedAt) active = entry;
  }
  return active;
}

/**
 * 计算某个法规 × 配置单元格的覆盖状态。
 *
 * - accepted：台账中存在未失效的接受记录（基线变化只失效命中的单元格）
 * - stale：曾有被接受的报告，但对应接受记录已被基线变化失效，需要重新测试
 * - pending：从未被接受，或当前修订被拒 / 要求重交 / 配置未覆盖
 *
 * 旧报告与文件版本在 stale/pending 状态下仍可通过台账追溯。
 */
export function resolveCell(project: ApprovalProject, regulation: RegulationItem, configuration: string): CoverageCell {
  const entries = project.coverage.filter(
    (entry) => entry.regulationId === regulation.id && entry.configuration === configuration
  );
  const active = entries.find((entry) => !entry.invalidatedAt);
  const last = entries[entries.length - 1];

  const items = project.evidence.filter((item) => item.regulationId === regulation.id);
  let pendingRevision: EvidenceRevision | undefined;
  for (const evidence of items) {
    const current = latestRevision(evidence);
    if (current?.configurations.includes(configuration)) {
      pendingRevision ??= current;
    }
  }

  if (active) {
    const evidence = project.evidence.find((item) => item.id === active.evidenceId);
    const revision = evidence?.revisions.find((item) => item.id === active.revisionId);
    return {
      regulationId: regulation.id,
      configuration,
      state: 'accepted',
      revision,
      evidenceId: active.evidenceId,
      baseline: project.softwareVersion,
      note: `由 ${revision?.version ?? active.revisionId} 于 ${active.acceptedAt.slice(0, 10)} 接受（SW ${active.softwareVersion}）`
    };
  }

  if (last) {
    const evidence = project.evidence.find((item) => item.id === last.evidenceId);
    const revision = evidence?.revisions.find((item) => item.id === last.revisionId);
    return {
      regulationId: regulation.id,
      configuration,
      state: 'stale',
      revision: pendingRevision,
      evidenceId: items.find((item) => latestRevision(item)?.configurations.includes(configuration))?.id,
      acceptedRevision: revision,
      acceptedEvidenceId: last.evidenceId,
      baseline: project.softwareVersion,
      note: last.invalidatedReason
        ? `${last.invalidatedReason}：已接受报告 ${revision?.version ?? ''}（SW ${last.softwareVersion}）软件版本过期，需按当前基线重新测试`
        : `已接受报告基于 SW ${last.softwareVersion}，当前基线 SW ${project.softwareVersion}，需重新测试`
    };
  }

  let note = '该配置尚无被接受的覆盖证据';
  const pendingEvidence = items.find((item) => latestRevision(item)?.configurations.includes(configuration));
  if (pendingRevision) {
    if (pendingRevision.status === 'submitted') note = '补件已提交，等待审阅接受';
    else if (pendingRevision.status === 'rejected') note = '最新修订被拒绝，需重新提交';
    else if (pendingRevision.status === 'resubmit') note = '审阅要求重新抽样测试';
  }

  return {
    regulationId: regulation.id,
    configuration,
    state: 'pending',
    revision: pendingRevision,
    evidenceId: pendingEvidence?.id,
    baseline: project.softwareVersion,
    note
  };
}

export interface CoverageMatrix {
  configurations: string[];
  regulations: RegulationItem[];
  requiredRegulations: RegulationItem[];
  cells: CoverageCell[];
  cell: (regulationId: string, configuration: string) => CoverageCell | undefined;
  /** 仍有待补或版本过期的必选单元格 */
  openCells: CoverageCell[];
  pendingCells: CoverageCell[];
  staleCells: CoverageCell[];
  acceptedRequiredCount: number;
  requiredCount: number;
  coveragePercent: number;
}

export function buildCoverageMatrix(project: ApprovalProject): CoverageMatrix {
  const cells: CoverageCell[] = [];
  for (const regulation of project.regulations) {
    for (const configuration of project.configurations) {
      cells.push(resolveCell(project, regulation, configuration));
    }
  }

  const requiredIds = new Set(project.regulations.filter((item) => item.required).map((item) => item.id));
  const openCells = cells.filter((cell) => cell.state !== 'accepted' && requiredIds.has(cell.regulationId));

  const matrix: CoverageMatrix = {
    configurations: [...project.configurations],
    regulations: project.regulations,
    requiredRegulations: project.regulations.filter((item) => item.required),
    cells,
    cell: (regulationId, configuration) =>
      cells.find((item) => item.regulationId === regulationId && item.configuration === configuration),
    openCells,
    pendingCells: openCells.filter((cell) => cell.state === 'pending'),
    staleCells: openCells.filter((cell) => cell.state === 'stale'),
    acceptedRequiredCount: cells.filter(
      (cell) => cell.state === 'accepted' && requiredIds.has(cell.regulationId)
    ).length,
    requiredCount: project.regulations.filter((item) => item.required).length * project.configurations.length,
    coveragePercent: 0
  };
  matrix.coveragePercent = matrix.requiredCount
    ? Math.round((matrix.acceptedRequiredCount / matrix.requiredCount) * 100)
    : 0;
  return matrix;
}

/** 法规在全部申报配置上的汇总状态 */
export function regulationRowState(
  project: ApprovalProject,
  regulationId: string
): { state: CoverageState | 'na'; accepted: number; total: number } {
  const row = buildCoverageMatrix(project).cells.filter((cell) => cell.regulationId === regulationId);
  if (!row.length) return { state: 'na', accepted: 0, total: 0 };
  const accepted = row.filter((cell) => cell.state === 'accepted').length;
  let state: CoverageState;
  if (accepted === row.length) state = 'accepted';
  else if (row.some((cell) => cell.state === 'stale')) state = 'stale';
  else state = 'pending';
  return { state, accepted, total: row.length };
}

export const coverageStateLabels: Record<CoverageState, string> = {
  accepted: '已接受',
  pending: '待补',
  stale: '版本过期'
};

export const coverageStateColors: Record<CoverageState, 'green' | 'amber' | 'red'> = {
  accepted: 'green',
  pending: 'amber',
  stale: 'red'
};
