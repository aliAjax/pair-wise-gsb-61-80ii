import type { ApprovalProject, EvidenceItem, EvidenceRevision } from '~/types/certification';

/** 迁移 v1 单配置、无修订链的本地数据到 v2 覆盖矩阵模型 */
export function migrateLegacyProjects(raw: string): ApprovalProject[] {
  const legacyProjects = JSON.parse(raw) as Array<
    ApprovalProject & { configuration?: string }
  >;
  return legacyProjects.map((legacy) => {
    const configurations =
      legacy.configurations ?? (legacy.configuration ? [legacy.configuration] : []);
    const regulations = (legacy.regulations ?? []).map((reg) => ({
      id: reg.id,
      code: reg.code,
      title: reg.title,
      category: reg.category,
      required: reg.required
    }));
    const evidence: EvidenceItem[] = (legacy.evidence ?? []).map((item) => {
      const firstRevision: EvidenceRevision = {
        revision: 1,
        version: item.version,
        softwareVersion: item.softwareVersion,
        status: item.status,
        note: item.note,
        actor: legacy.applicant,
        createdAt: item.updatedAt
      };
      return { ...item, revisionGroupId: item.id, revision: 1, revisions: [firstRevision] };
    });
    const { configuration: _omit, ...rest } = legacy;
    return { ...rest, configurations, regulations, evidence };
  });
}
