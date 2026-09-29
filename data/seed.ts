import type {
  ApprovalProject,
  EvidenceItem,
  EvidenceRevision,
  EvidenceStatus,
  RegulationItem
} from '~/types/certification';

export const regulationCatalog: RegulationItem[] = [
  { id: 'REG-BRAKE', code: 'GB 21670', title: '乘用车制动系统技术要求', category: '安全', required: true },
  { id: 'REG-LIGHT', code: 'GB 4785', title: '汽车及挂车外部照明和光信号装置', category: '安全', required: true },
  { id: 'REG-EMC', code: 'GB 34660', title: '道路车辆电磁兼容性要求', category: '环保', required: true },
  { id: 'REG-SOFTWARE', code: 'R156', title: '软件更新管理体系', category: '软件', required: true },
  { id: 'REG-WLTP', code: 'GB 18352.6', title: '轻型汽车污染物排放限值', category: '环保', required: true },
  { id: 'REG-BATTERY', code: 'GB 38031', title: '电动汽车用动力蓄电池安全要求', category: '安全', required: true },
  { id: 'REG-ENERGY', code: 'GB 27999', title: '乘用车燃料消耗量评价方法及指标', category: '能耗', required: true },
  { id: 'REG-COMPONENT', code: 'R100.2', title: '电动车辆特定部件安全要求', category: '部件', required: true }
];

export function regulationsFor(ids: string[]): RegulationItem[] {
  return ids
    .map((id) => regulationCatalog.find((item) => item.id === id))
    .filter((item): item is RegulationItem => Boolean(item))
    .map((item) => ({ ...item }));
}

interface EvidenceSeed {
  id: string;
  regulationId: string;
  name: string;
  type: EvidenceItem['type'];
  version: string;
  softwareVersion: string;
  configurations: string[];
  status: EvidenceStatus;
  note: string;
  updatedAt: string;
  expiryDate?: string;
  actor: string;
  revision?: number;
  revisionGroupId?: string;
  supersededBy?: string;
  supersedes?: string;
  revisions?: EvidenceRevision[];
}

function evidence(projectId: string, seed: EvidenceSeed): EvidenceItem {
  const revision = seed.revision ?? 1;
  const ownRevision: EvidenceRevision = {
    revision,
    version: seed.version,
    softwareVersion: seed.softwareVersion,
    status: seed.status,
    note: seed.note,
    actor: seed.actor,
    createdAt: seed.updatedAt
  };
  return {
    id: seed.id,
    projectId,
    regulationId: seed.regulationId,
    name: seed.name,
    type: seed.type,
    version: seed.version,
    softwareVersion: seed.softwareVersion,
    configurations: [...seed.configurations],
    status: seed.status,
    expiryDate: seed.expiryDate,
    note: seed.note,
    updatedAt: seed.updatedAt,
    revisionGroupId: seed.revisionGroupId ?? seed.id,
    revision,
    supersededBy: seed.supersededBy,
    supersedes: seed.supersedes,
    revisions: seed.revisions ?? [ownRevision]
  };
}

export const seedProjects: ApprovalProject[] = [
  {
    id: 'TA-2026-118',
    name: '纯电运动轿车 2027 款',
    modelCode: 'EVS-27',
    vehicleType: 'M1',
    configurations: ['长续航四驱版', '标准续航后驱版'],
    maintenanceVersion: 'MY27.1',
    softwareVersion: '8.4.1',
    status: 'under_review',
    progress: 62,
    applicant: '远航汽车工程部',
    reviewer: '刘珊',
    agency: '华东认证中心',
    submittedAt: '2026-09-18',
    updatedAt: '2026-09-28T10:45:00.000Z',
    certificateExpiry: '2026-12-16',
    regulations: regulationsFor([
      'REG-BRAKE',
      'REG-LIGHT',
      'REG-EMC',
      'REG-SOFTWARE',
      'REG-WLTP',
      'REG-BATTERY',
      'REG-ENERGY',
      'REG-COMPONENT'
    ]),
    evidence: [
      // 制动报告：R2 已被 R3 补件取代，留档可追溯
      evidence('TA-2026-118', {
        id: 'EV-118-06',
        regulationId: 'REG-BRAKE',
        name: '制动系统型式试验报告',
        type: 'test_report',
        version: 'R2',
        softwareVersion: '8.3.9',
        configurations: ['长续航四驱版'],
        status: 'accepted',
        note: '初版报告，仅覆盖长续航四驱配置，基于旧软件基线。',
        updatedAt: '2026-09-12T03:00:00.000Z',
        actor: '刘珊',
        revision: 1,
        revisionGroupId: 'GRP-118-BRAKE',
        supersededBy: 'EV-118-01'
      }),
      evidence('TA-2026-118', {
        id: 'EV-118-01',
        regulationId: 'REG-BRAKE',
        name: '制动系统型式试验报告',
        type: 'test_report',
        version: 'R3',
        softwareVersion: '8.4.1',
        configurations: ['长续航四驱版', '标准续航后驱版'],
        status: 'accepted',
        note: '补件修订 R3：在新基线上重新完成试验，扩展到标准续航配置。',
        updatedAt: '2026-09-20T03:00:00.000Z',
        actor: '刘珊',
        revision: 2,
        revisionGroupId: 'GRP-118-BRAKE',
        supersedes: 'EV-118-06',
        revisions: [
          {
            revision: 1,
            version: 'R2',
            softwareVersion: '8.3.9',
            status: 'accepted',
            note: '初版报告，仅覆盖长续航四驱配置。',
            actor: '刘珊',
            createdAt: '2026-09-12T03:00:00.000Z'
          },
          {
            revision: 2,
            version: 'R3',
            softwareVersion: '8.4.1',
            status: 'accepted',
            note: '补件修订 R3：新基线复测并扩展配置覆盖。',
            actor: '刘珊',
            createdAt: '2026-09-20T03:00:00.000Z'
          }
        ]
      }),
      evidence('TA-2026-118', {
        id: 'EV-118-02',
        regulationId: 'REG-SOFTWARE',
        name: '软件更新影响评估',
        type: 'software_report',
        version: 'S2',
        softwareVersion: '8.4.1',
        configurations: ['长续航四驱版'],
        status: 'rejected',
        note: '已按 8.4.1 重新编制，但影响分析结论被审阅人退回，需补充后重交。',
        updatedAt: '2026-09-25T06:30:00.000Z',
        actor: '刘珊'
      }),
      evidence('TA-2026-118', {
        id: 'EV-118-03',
        regulationId: 'REG-LIGHT',
        name: '外部照明装置测试记录',
        type: 'test_report',
        version: 'R1',
        softwareVersion: '8.4.1',
        configurations: ['标准续航后驱版'],
        status: 'resubmit',
        note: '需补充长续航四驱配置后雾灯测试。',
        updatedAt: '2026-09-27T04:10:00.000Z',
        actor: '刘珊'
      }),
      // EMC 报告在 8.3.9 基线下已接受；基线升级后单元格被判为版本过期，需重新测试
      evidence('TA-2026-118', {
        id: 'EV-118-05',
        regulationId: 'REG-EMC',
        name: '整车电磁兼容报告',
        type: 'test_report',
        version: 'R2',
        softwareVersion: '8.3.9',
        configurations: ['长续航四驱版', '标准续航后驱版'],
        status: 'accepted',
        note: '旧基线 8.3.9 下通过；整车软件升级到 8.4.1 后需重新测试。',
        updatedAt: '2026-09-15T07:20:00.000Z',
        actor: '刘珊'
      }),
      evidence('TA-2026-118', {
        id: 'EV-118-04',
        regulationId: 'REG-BATTERY',
        name: '动力电池包安全测试报告',
        type: 'test_report',
        version: 'R4',
        softwareVersion: '8.4.1',
        configurations: ['长续航四驱版', '标准续航后驱版'],
        status: 'accepted',
        note: '覆盖全部量产电池配置。',
        updatedAt: '2026-09-19T08:00:00.000Z',
        actor: '刘珊'
      })
    ],
    versions: [
      {
        id: 'VER-118-02',
        label: 'MY27.1 / 8.4.1',
        author: '远航汽车工程部',
        createdAt: '2026-09-27T04:10:00.000Z',
        summary: '更新软件基线并补充照明配置覆盖。',
        changes: ['整车软件由 8.3.9 升级至 8.4.1', '新增长续航四驱配置照明声明'],
        impactedConfigurations: ['长续航四驱版']
      },
      {
        id: 'VER-118-01',
        label: 'MY27.1 / 8.3.9',
        author: '远航汽车工程部',
        createdAt: '2026-09-18T01:20:00.000Z',
        summary: '首次提交型式认证证据包。',
        changes: ['建立法规项目与首版测试报告关联'],
        impactedConfigurations: ['长续航四驱版', '标准续航后驱版']
      }
    ],
    audit: [
      {
        id: 'AUD-118-04',
        actor: '刘珊',
        action: '退回补件',
        detail: '软件影响评估版本错配，照明证据缺少长续航配置覆盖。',
        createdAt: '2026-09-28T10:45:00.000Z',
        kind: 'status'
      },
      {
        id: 'AUD-118-03',
        actor: '远航汽车工程部',
        action: '更新版本',
        detail: '软件基线更新为 8.4.1，EMC 等 2 个配置单元格由已接受失效为版本过期，需重新确认。',
        createdAt: '2026-09-27T04:10:00.000Z',
        kind: 'version',
        coverageChanges: [
          {
            regulationId: 'REG-EMC',
            regulationCode: 'GB 34660',
            configuration: '长续航四驱版',
            from: 'accepted',
            to: 'outdated',
            reason: '软件基线 8.3.9 → 8.4.1，整车电磁兼容报告需重新测试'
          },
          {
            regulationId: 'REG-EMC',
            regulationCode: 'GB 34660',
            configuration: '标准续航后驱版',
            from: 'accepted',
            to: 'outdated',
            reason: '软件基线 8.3.9 → 8.4.1，整车电磁兼容报告需重新测试'
          }
        ]
      }
    ]
  },
  {
    id: 'TA-2026-109',
    name: '插电式混合动力多用途车',
    modelCode: 'PHV-M9',
    vehicleType: 'M1',
    configurations: ['七座旗舰版', '六座豪华版'],
    maintenanceVersion: 'MY26.2',
    softwareVersion: '5.7.0',
    status: 'supplement_required',
    progress: 41,
    applicant: '北辰汽车',
    reviewer: '赵驰',
    agency: '华南认证中心',
    submittedAt: '2026-09-05',
    updatedAt: '2026-09-26T02:15:00.000Z',
    certificateExpiry: '2026-11-20',
    regulations: regulationsFor(['REG-BRAKE', 'REG-LIGHT', 'REG-EMC', 'REG-SOFTWARE', 'REG-WLTP', 'REG-BATTERY', 'REG-ENERGY']),
    evidence: [
      evidence('TA-2026-109', {
        id: 'EV-109-01',
        regulationId: 'REG-EMC',
        name: '整车电磁兼容报告',
        type: 'test_report',
        version: 'R2',
        softwareVersion: '5.7.0',
        configurations: ['七座旗舰版'],
        status: 'accepted',
        note: '实验室报告与七座旗舰申报配置一致；六座豪华版尚未送样。',
        updatedAt: '2026-09-10T03:00:00.000Z',
        actor: '赵驰'
      }),
      evidence('TA-2026-109', {
        id: 'EV-109-02',
        regulationId: 'REG-ENERGY',
        name: '能耗一致性证明材料',
        type: 'test_report',
        version: 'R1',
        softwareVersion: '5.6.8',
        configurations: ['七座旗舰版'],
        status: 'resubmit',
        note: '测试软件版本与当前申报版本不一致，需在 5.7.0 上重新抽样。',
        updatedAt: '2026-09-26T02:15:00.000Z',
        actor: '赵驰'
      })
    ],
    versions: [
      {
        id: 'VER-109-01',
        label: 'MY26.2 / 5.7.0',
        author: '北辰汽车',
        createdAt: '2026-09-05T08:00:00.000Z',
        summary: '首次提交 PHEV 整车证据包。',
        changes: ['建立 7 个法规项'],
        impactedConfigurations: ['七座旗舰版', '六座豪华版']
      }
    ],
    audit: [
      {
        id: 'AUD-109-02',
        actor: '赵驰',
        action: '要求补件',
        detail: '能耗证据软件版本需更新后重新抽样；六座豪华版多数必选法规尚未覆盖。',
        createdAt: '2026-09-26T02:15:00.000Z',
        kind: 'status'
      }
    ]
  },
  {
    id: 'TA-2026-092',
    name: '轻型商用车改款',
    modelCode: 'LCV-4',
    vehicleType: 'N1',
    configurations: ['高顶货运版'],
    maintenanceVersion: 'MY26.0',
    softwareVersion: '3.2.4',
    status: 'approved',
    progress: 100,
    applicant: '西岭商用车',
    reviewer: '何谦',
    agency: '华北认证中心',
    submittedAt: '2026-07-12',
    updatedAt: '2026-08-30T09:20:00.000Z',
    certificateExpiry: '2027-08-29',
    regulations: regulationsFor(['REG-BRAKE', 'REG-EMC', 'REG-BATTERY']),
    evidence: [
      evidence('TA-2026-092', {
        id: 'EV-092-01',
        regulationId: 'REG-BRAKE',
        name: '制动系统批准报告',
        type: 'certificate',
        version: 'R1',
        softwareVersion: '3.2.4',
        configurations: ['高顶货运版'],
        status: 'accepted',
        expiryDate: '2027-08-29',
        note: '已纳入正式批准版本。',
        updatedAt: '2026-08-30T09:20:00.000Z',
        actor: '何谦'
      }),
      evidence('TA-2026-092', {
        id: 'EV-092-02',
        regulationId: 'REG-EMC',
        name: '整车电磁兼容报告',
        type: 'test_report',
        version: 'R1',
        softwareVersion: '3.2.4',
        configurations: ['高顶货运版'],
        status: 'accepted',
        note: '批准基线 3.2.4 下通过。',
        updatedAt: '2026-08-20T06:00:00.000Z',
        actor: '何谦'
      }),
      evidence('TA-2026-092', {
        id: 'EV-092-03',
        regulationId: 'REG-BATTERY',
        name: '动力电池包安全测试报告',
        type: 'test_report',
        version: 'R1',
        softwareVersion: '3.2.4',
        configurations: ['高顶货运版'],
        status: 'accepted',
        note: '批准基线 3.2.4 下通过。',
        updatedAt: '2026-08-21T06:00:00.000Z',
        actor: '何谦'
      })
    ],
    versions: [
      {
        id: 'VER-092-02',
        label: '批准版 / 3.2.4',
        author: '何谦',
        createdAt: '2026-08-30T09:20:00.000Z',
        summary: '完成审批并锁定正式提交包。',
        changes: ['批准全部法规项', '锁定软件与维护版本'],
        impactedConfigurations: ['高顶货运版']
      }
    ],
    audit: [
      {
        id: 'AUD-092-03',
        actor: '何谦',
        action: '批准',
        detail: '全部适用范围证据通过审阅，提交包版本锁定。',
        createdAt: '2026-08-30T09:20:00.000Z',
        kind: 'status'
      }
    ]
  },
  {
    id: 'TA-2026-120',
    name: '城市物流电动货车',
    modelCode: 'EVL-3',
    vehicleType: 'N1',
    configurations: ['标准厢式版', '长轴距厢式版'],
    maintenanceVersion: 'MY27.0',
    softwareVersion: '1.9.2',
    status: 'draft',
    progress: 18,
    applicant: '江洲新能源',
    reviewer: '待分派',
    agency: '华东认证中心',
    updatedAt: '2026-09-27T12:30:00.000Z',
    certificateExpiry: '2026-10-24',
    regulations: regulationsFor(['REG-BRAKE', 'REG-EMC', 'REG-BATTERY']),
    evidence: [
      evidence('TA-2026-120', {
        id: 'EV-120-01',
        regulationId: 'REG-BATTERY',
        name: '电池包部件清单',
        type: 'part_list',
        version: 'D1',
        softwareVersion: '1.9.2',
        configurations: ['标准厢式版'],
        status: 'submitted',
        note: '等待认证机构确认零件号完整性；长轴距配置清单未提交。',
        updatedAt: '2026-09-27T12:30:00.000Z',
        actor: '江洲新能源'
      })
    ],
    versions: [
      {
        id: 'VER-120-01',
        label: 'MY27.0 / 1.9.2',
        author: '江洲新能源',
        createdAt: '2026-09-27T12:30:00.000Z',
        summary: '建立认证项目草稿。',
        changes: ['录入整车基础信息和电池部件清单'],
        impactedConfigurations: ['标准厢式版', '长轴距厢式版']
      }
    ],
    audit: [
      {
        id: 'AUD-120-01',
        actor: '江洲新能源',
        action: '建立项目',
        detail: '创建认证证据包草稿。',
        createdAt: '2026-09-27T12:30:00.000Z',
        kind: 'project'
      }
    ]
  }
];
