import type { ApprovalProject, ProjectInput } from '~/types/certification';
import { blockingCells } from './coverage-matrix';

export function validateProjectInput(input: ProjectInput) {
  const errors: Partial<Record<keyof ProjectInput, string>> = {};
  const configurations = input.configurations.map((item) => item.trim()).filter(Boolean);

  if (input.name.trim().length < 3) errors.name = '项目名称至少 3 个字符';
  if (!/^[A-Za-z0-9-]{3,}$/.test(input.modelCode.trim())) errors.modelCode = '车型代码只能包含字母、数字和连字符';
  if (!input.vehicleType.trim()) errors.vehicleType = '请选择车辆类别';
  if (configurations.length < 1) errors.configurations = '请至少填写一个申报配置';
  else if (new Set(configurations).size !== configurations.length) errors.configurations = '申报配置不能重复';
  else if (configurations.some((name) => name.length < 2)) errors.configurations = '每个配置名称至少 2 个字符';
  if (!/^MY\d{2}\.\d+$/.test(input.maintenanceVersion.trim())) errors.maintenanceVersion = '维护版本格式应类似 MY27.1';
  if (!/^\d+\.\d+\.\d+$/.test(input.softwareVersion.trim())) errors.softwareVersion = '软件版本格式应类似 8.4.1';
  if (input.applicant.trim().length < 2) errors.applicant = '请填写申请主体';
  if (input.agency.trim().length < 2) errors.agency = '请选择认证机构';
  if (!input.certificateExpiry) errors.certificateExpiry = '请选择证书有效期';

  return errors;
}

/** 批准前阻断项：必选法规逐配置检查待补 / 版本过期 / 未覆盖 */
export function validateSubmission(project: ApprovalProject) {
  const issues: string[] = [];
  const blockers = blockingCells(project);
  const pending = blockers.filter(({ cell }) => cell.status === 'pending');
  const outdated = blockers.filter(({ cell }) => cell.status === 'outdated');
  const missingCells = blockers.filter(({ cell }) => cell.status === 'missing');

  if (pending.length) issues.push(`${pending.length} 个法规×配置单元格待补或待审阅接受`);
  if (outdated.length) issues.push(`${outdated.length} 个单元格证据版本过期，需在当前软件基线上重新测试`);
  if (missingCells.length) issues.push(`${missingCells.length} 个单元格尚未关联任何证据`);
  if (new Date(project.certificateExpiry) <= new Date('2026-12-31')) {
    issues.push('证书有效期不足 90 天，需先确认续证安排');
  }
  return issues;
}

export function validateEvidenceUpgrade(project: ApprovalProject, evidenceIds: string[], note: string) {
  const errors: string[] = [];
  if (!evidenceIds.length) errors.push('至少选择一项待补件证据');
  if (note.trim().length < 6) errors.push('批量补件说明至少 6 个字符');
  const selected = project.evidence.filter(
    (item) => evidenceIds.includes(item.id) && !item.supersededBy
  );
  if (!selected.length) errors.push('所选证据不属于当前项目或已被新修订取代');
  return errors;
}
