import type {
  ApprovalProject,
  CoverageCell,
  CoverageCellStatus,
  CoverageChange,
  EvidenceItem,
  RegulationCoverageRow,
  RegulationItem,
  RegulationStatus
} from '~/types/certification';

export const coverageStatusLabels: Record<CoverageCellStatus, string> = {
  accepted: '已接受',
  pending: '待补',
  outdated: '版本过期',
  missing: '未覆盖'
};

export const coverageStatusColors: Record<CoverageCellStatus, 'green' | 'amber' | 'red' | 'gray'> = {
  accepted: 'green',
  pending: 'amber',
  outdated: 'red',
  missing: 'gray'
};

/** 当前仍参与覆盖计算的证据：未被新修订取代 */
export function activeEvidence(project: ApprovalProject): EvidenceItem[] {
  return project.evidence.filter((item) => !item.supersededBy);
}

function evidenceCellStatus(item: EvidenceItem, baselineSoftware: string): CoverageCellStatus {
  if (item.softwareVersion !== baselineSoftware) {
    // 即使已接受，软件基线落后仍判为版本过期，不能算覆盖
    return 'outdated';
  }
  if (item.status === 'accepted') return 'accepted';
  // submitted / rejected / resubmit / missing 均视为待补闭环
  return 'pending';
}

/**
 * 逐「法规 × 配置」计算覆盖矩阵。
 * 同一单元格可能有多份证据，按状态优先级取最严重的一格状态：
 * missing > outdated > pending > accepted；accepted 单元格保留生效证据与历史修订。
 */
export function buildCoverageMatrix(project: ApprovalProject): RegulationCoverageRow[] {
  const baseline = project.softwareVersion;
  const active = activeEvidence(project);

  return project.regulations.map((regulation) => {
    const linked = active.filter((item) => item.regulationId === regulation.id);
    const cells: CoverageCell[] = project.configurations.map((configuration) => {
      // 覆盖该配置的生效证据
      const covering = linked.filter((item) => item.configurations.includes(configuration));
      const accepted = covering.filter((item) => evidenceCellStatus(item, baseline) === 'accepted');
      const pending = covering.filter((item) => evidenceCellStatus(item, baseline) === 'pending');
      const outdated = covering.filter((item) => evidenceCellStatus(item, baseline) === 'outdated');

      const current = accepted[0] ?? outdated[0] ?? pending[0] ?? covering[0];
      const history = covering.filter((item) => item !== current);

      let status: CoverageCellStatus;
      let detail: string;
      if (accepted.length && !pending.length && !outdated.length) {
        status = 'accepted';
        detail = `已接受 ${accepted[0]!.name}（${accepted[0]!.version} / SW ${accepted[0]!.softwareVersion}）`;
      } else if (outdated.length) {
        status = 'outdated';
        const item = outdated[0]!;
        detail = `${item.name} 基于 SW ${item.softwareVersion}，当前基线 SW ${baseline}，需重新测试`;
      } else if (pending.length) {
        status = 'pending';
        detail = `${pending[0]!.name} 状态为待补闭环，等待审阅接受`;
      } else if (covering.length) {
        status = 'pending';
        detail = '已关联证据但尚未被接受';
      } else {
        status = 'missing';
        detail = '该配置尚未关联任何证据';
      }

      return { regulationId: regulation.id, configuration, status, current, history, detail };
    });

    const counts = {
      accepted: cells.filter((cell) => cell.status === 'accepted').length,
      pending: cells.filter((cell) => cell.status === 'pending').length,
      outdated: cells.filter((cell) => cell.status === 'outdated').length,
      missing: cells.filter((cell) => cell.status === 'missing').length
    };
    const total = cells.length || 1;
    const coverage = Math.round((counts.accepted / total) * 100);

    let status: RegulationStatus;
    if (counts.missing) status = 'missing';
    else if (counts.outdated) status = 'outdated';
    else if (counts.pending) status = 'pending';
    else status = 'complete';

    const issues: string[] = [];
    cells
      .filter((cell) => cell.status !== 'accepted')
      .forEach((cell) => {
        issues.push(`${cell.configuration}：${coverageStatusLabels[cell.status]}（${cell.detail}）`);
      });

    return { regulation, cells, status, coverage, issues };
  });
}

/** 批准前阻断项：仅必选法规，逐配置列出待补 / 过期 / 未覆盖单元格 */
export function blockingCells(project: ApprovalProject): { regulation: RegulationItem; cell: CoverageCell }[] {
  return buildCoverageMatrix(project)
    .filter((row) => row.regulation.required)
    .flatMap((row) => row.cells.filter((cell) => cell.status !== 'accepted').map((cell) => ({ regulation: row.regulation, cell })));
}

export function validateApproval(project: ApprovalProject): string[] {
  return blockingCells(project).map(
    ({ regulation, cell }) => `${regulation.code} × ${cell.configuration}：${coverageStatusLabels[cell.status]} — ${cell.detail}`
  );
}

/** 计算两份单元格状态快照之间的覆盖变化，用于审计 */
export function diffCoverage(
  before: Map<string, CoverageCellStatus>,
  after: RegulationCoverageRow[],
  reason: string
): CoverageChange[] {
  const changes: CoverageChange[] = [];
  const codeById = new Map<string, string>();
  after.forEach((row) => codeById.set(row.regulation.id, row.regulation.code));
  after.forEach((row) =>
    row.cells.forEach((cell) => {
      const key = `${cell.regulationId}::${cell.configuration}`;
      const previous = before.get(key) ?? null;
      if (previous !== cell.status) {
        changes.push({
          regulationId: cell.regulationId,
          regulationCode: codeById.get(cell.regulationId) ?? cell.regulationId,
          configuration: cell.configuration,
          from: previous,
          to: cell.status,
          reason
        });
      }
    })
  );
  return changes;
}

export function coverageSnapshot(project: ApprovalProject): Map<string, CoverageCellStatus> {
  const map = new Map<string, CoverageCellStatus>();
  buildCoverageMatrix(project).forEach((row) =>
    row.cells.forEach((cell) => map.set(`${cell.regulationId}::${cell.configuration}`, cell.status))
  );
  return map;
}

/** 软件基线变化后，真正失效的单元格（已接受但证据基于旧基线） */
export function invalidatedByBaseline(
  project: ApprovalProject,
  previousBaseline: string,
  nextBaseline: string
): CoverageChange[] {
  if (previousBaseline === nextBaseline) return [];
  const changes: CoverageChange[] = [];
  activeEvidence(project).forEach((item) => {
    if (item.status === 'accepted' && item.softwareVersion === previousBaseline) {
      item.configurations.forEach((configuration) => {
        const regulation = project.regulations.find((reg) => reg.id === item.regulationId);
        changes.push({
          regulationId: item.regulationId,
          regulationCode: regulation?.code ?? item.regulationId,
          configuration,
          from: 'accepted',
          to: 'outdated',
          reason: `软件基线 ${previousBaseline} → ${nextBaseline}，${item.name} 需重新测试`
        });
      });
    }
  });
  return changes;
}
