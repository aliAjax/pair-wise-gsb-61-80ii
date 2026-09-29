import { buildCoverageMatrix } from './coverage';
import type { ApprovalProject, ProjectInput, SupplementInput } from '~/types/certification';

export function validateProjectInput(input: ProjectInput) {
  const errors: Partial<Record<keyof ProjectInput, string>> = {};

  if (input.name.trim().length < 3) errors.name = '项目名称至少 3 个字符';
  if (!/^[A-Za-z0-9-]{3,}$/.test(input.modelCode.trim())) errors.modelCode = '车型代码只能包含字母、数字和连字符';
  if (!input.vehicleType.trim()) errors.vehicleType = '请选择车辆类别';
  const configurations = input.configurations.map((item) => item.trim()).filter(Boolean);
  if (!configurations.length) errors.configurations = '至少填写一个申报配置';
  else if (new Set(configurations).size !== configurations.length) errors.configurations = '申报配置不能重复';
  else if (configurations.some((item) => item.length < 2)) errors.configurations = '配置名称至少 2 个字符';
  if (!/^MY\d{2}\.\d+$/.test(input.maintenanceVersion.trim())) errors.maintenanceVersion = '维护版本格式应类似 MY27.1';
  if (!/^\d+\.\d+\.\d+$/.test(input.softwareVersion.trim())) errors.softwareVersion = '软件版本格式应类似 8.4.1';
  if (input.applicant.trim().length < 2) errors.applicant = '请填写申请主体';
  if (input.agency.trim().length < 2) errors.agency = '请选择认证机构';
  if (!input.certificateExpiry) errors.certificateExpiry = '请选择证书有效期';

  return errors;
}

/** 批准入口检查：逐配置列出待补 / 版本过期的必选法规单元格 */
export function validateSubmission(project: ApprovalProject) {
  const issues: string[] = [];
  const matrix = buildCoverageMatrix(project);

  if (matrix.staleCells.length) {
    const detail = matrix.staleCells
      .map((cell) => {
        const code = project.regulations.find((item) => item.id === cell.regulationId)?.code ?? cell.regulationId;
        return `${code} × ${cell.configuration}`;
      })
      .join('、');
    issues.push(`${matrix.staleCells.length} 个单元格版本过期（基线变化后未重测）：${detail}`);
  }

  if (matrix.pendingCells.length) {
    const detail = matrix.pendingCells
      .map((cell) => {
        const code = project.regulations.find((item) => item.id === cell.regulationId)?.code ?? cell.regulationId;
        return `${code} × ${cell.configuration}`;
      })
      .join('、');
    issues.push(`${matrix.pendingCells.length} 个单元格待补：${detail}`);
  }

  if (new Date(project.certificateExpiry) <= new Date('2026-12-31')) {
    issues.push('证书有效期不足 90 天，需先确认续证安排');
  }

  return issues;
}

export function validateEvidenceUpgrade(project: ApprovalProject, input: SupplementInput) {
  const errors: string[] = [];
  if (!input.targets.length) errors.push('至少选择一项待补件证据');
  if (input.note.trim().length < 6) errors.push('批量补件说明至少 6 个字符');

  for (const target of input.targets) {
    const evidence = project.evidence.find((item) => item.id === target.evidenceId);
    if (!evidence) {
      errors.push('所选证据不属于当前项目');
      continue;
    }
    const configs = target.configurations ?? evidence.revisions[evidence.revisions.length - 1]?.configurations ?? [];
    if (!configs.length) errors.push(`${evidence.id} 未指定补件配置`);
    for (const configuration of configs) {
      if (!project.configurations.includes(configuration)) {
        errors.push(`${evidence.id} 的配置 ${configuration} 不在申报范围内`);
      }
    }
  }

  return Array.from(new Set(errors));
}
