import type {
  ApprovalProject,
  CoverageAcceptance,
  EvidenceItem,
  EvidenceRevision,
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

let acceptanceSeq = 0;

function rev(
  evidenceId: string,
  input: Omit<EvidenceRevision, 'id'> & { id?: string }
): EvidenceRevision {
  return { id: input.id ?? `${evidenceId}-r${input.revision}`, ...input } as EvidenceRevision;
}

function evidence(
  id: string,
  projectId: string,
  regulationId: string,
  revisions: EvidenceRevision[]
): EvidenceItem {
  return { id, projectId, regulationId, revisions };
}

function acc(input: Omit<CoverageAcceptance, 'id'>): CoverageAcceptance {
  acceptanceSeq += 1;
  return { id: `ACC-SEED-${String(acceptanceSeq).padStart(3, '0')}`, ...input };
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
    progress: 56,
    applicant: '远航汽车工程部',
    reviewer: '刘珊',
    agency: '华东认证中心',
    submittedAt: '2026-09-18',
    updatedAt: '2026-09-28T10:45:00.000Z',
    certificateExpiry: '2026-12-16',
    regulations: structuredClone(regulationCatalog),
    evidence: [
      evidence('EV-118-01', 'TA-2026-118', 'REG-BRAKE', [
        rev('EV-118-01', {
          revision: 1,
          name: '制动系统型式试验报告',
          type: 'test_report',
          version: 'R1',
          softwareVersion: '8.3.9',
          configurations: ['长续航四驱版', '标准续航后驱版'],
          status: 'accepted',
          note: '首版制动试验报告，基于 SW 8.3.9 基线完成。',
          updatedAt: '2026-09-12T03:00:00.000Z',
          updatedBy: '刘珊'
        }),
        rev('EV-118-01', {
          revision: 2,
          name: '制动系统型式试验报告',
          type: 'test_report',
          version: 'R3',
          softwareVersion: '8.4.1',
          configurations: ['长续航四驱版', '标准续航后驱版'],
          status: 'accepted',
          note: '基线升级后对受影响配置重新完成制动试验，补件修订覆盖全部申报配置。',
          generatedBySupplement: true,
          updatedAt: '2026-09-27T10:00:00.000Z',
          updatedBy: '刘珊'
        })
      ]),
      evidence('EV-118-02', 'TA-2026-118', 'REG-SOFTWARE', [
        rev('EV-118-02', {
          revision: 1,
          name: '软件更新影响评估',
          type: 'software_report',
          version: 'S1',
          softwareVersion: '8.3.9',
          configurations: ['长续航四驱版'],
          status: 'accepted',
          note: '软件更新管理体系评估，基于 SW 8.3.9。',
          updatedAt: '2026-09-12T06:00:00.000Z',
          updatedBy: '刘珊'
        }),
        rev('EV-118-02', {
          revision: 2,
          name: '软件更新影响评估',
          type: 'software_report',
          version: 'S2',
          softwareVersion: '8.3.9',
          configurations: ['长续航四驱版'],
          status: 'rejected',
          note: '补件仍基于 SW 8.3.9，未按 8.4.1 基线重新评估，不能解除版本过期。',
          generatedBySupplement: true,
          updatedAt: '2026-09-25T06:30:00.000Z',
          updatedBy: '刘珊'
        })
      ]),
      evidence('EV-118-03', 'TA-2026-118', 'REG-LIGHT', [
        rev('EV-118-03', {
          revision: 1,
          name: '外部照明装置测试记录',
          type: 'test_report',
          version: 'R1',
          softwareVersion: '8.4.1',
          configurations: ['标准续航后驱版'],
          status: 'resubmit',
          note: '长续航四驱版后雾灯测试缺失，审阅要求补充覆盖后重新抽样。',
          updatedAt: '2026-09-27T04:10:00.000Z',
          updatedBy: '刘珊'
        })
      ]),
      evidence('EV-118-04', 'TA-2026-118', 'REG-BATTERY', [
        rev('EV-118-04', {
          revision: 1,
          name: '动力电池包安全测试报告',
          type: 'test_report',
          version: 'R2',
          softwareVersion: '8.3.9',
          configurations: ['长续航四驱版', '标准续航后驱版'],
          status: 'accepted',
          note: '首版电池包安全试验，基于 SW 8.3.9。',
          updatedAt: '2026-09-12T08:00:00.000Z',
          updatedBy: '刘珊'
        }),
        rev('EV-118-04', {
          revision: 2,
          name: '动力电池包安全测试报告',
          type: 'test_report',
          version: 'R4',
          softwareVersion: '8.4.1',
          configurations: ['长续航四驱版', '标准续航后驱版'],
          status: 'accepted',
          note: '基线升级后重测电池包安全项，补件修订覆盖全部配置。',
          generatedBySupplement: true,
          updatedAt: '2026-09-27T10:00:00.000Z',
          updatedBy: '刘珊'
        })
      ]),
      evidence('EV-118-05', 'TA-2026-118', 'REG-EMC', [
        rev('EV-118-05', {
          revision: 1,
          name: '整车电磁兼容报告',
          type: 'test_report',
          version: 'R2',
          softwareVersion: '8.4.1',
          configurations: ['长续航四驱版', '标准续航后驱版'],
          status: 'accepted',
          note: '基线升级后完成的整车 EMC 试验，覆盖全部申报配置。',
          updatedAt: '2026-09-22T03:00:00.000Z',
          updatedBy: '刘珊'
        })
      ]),
      evidence('EV-118-06', 'TA-2026-118', 'REG-WLTP', [
        rev('EV-118-06', {
          revision: 1,
          name: '轻型车排放与 OBD 试验报告',
          type: 'test_report',
          version: 'R1',
          softwareVersion: '8.4.1',
          configurations: ['长续航四驱版', '标准续航后驱版'],
          status: 'accepted',
          note: '排放限值与 OBD 核对通过，覆盖全部申报配置。',
          updatedAt: '2026-09-22T05:00:00.000Z',
          updatedBy: '刘珊'
        })
      ]),
      evidence('EV-118-07', 'TA-2026-118', 'REG-ENERGY', [
        rev('EV-118-07', {
          revision: 1,
          name: '能耗一致性证明材料',
          type: 'test_report',
          version: 'R1',
          softwareVersion: '8.3.9',
          configurations: ['长续航四驱版'],
          status: 'accepted',
          note: '首版能耗一致性说明，基于 SW 8.3.9。',
          updatedAt: '2026-09-12T09:30:00.000Z',
          updatedBy: '刘珊'
        })
      ]),
      evidence('EV-118-08', 'TA-2026-118', 'REG-COMPONENT', [
        rev('EV-118-08', {
          revision: 1,
          name: '电驱动特定部件安全评估',
          type: 'part_list',
          version: 'R1',
          softwareVersion: '8.4.1',
          configurations: ['标准续航后驱版'],
          status: 'accepted',
          note: '标准续航后驱版部件清单与安全评估通过。',
          updatedAt: '2026-09-23T02:00:00.000Z',
          updatedBy: '刘珊'
        })
      ])
    ],
    coverage: [
      // 制动：8.3.9 首版接受（长续航在基线升级时失效，标准后驱被补件修订替代）
      acc({
        regulationId: 'REG-BRAKE', configuration: '长续航四驱版',
        evidenceId: 'EV-118-01', revisionId: 'EV-118-01-r1', softwareVersion: '8.3.9',
        acceptedAt: '2026-09-12T03:00:00.000Z', acceptedBy: '刘珊',
        invalidatedAt: '2026-09-27T04:10:00.000Z', invalidatedBy: '远航汽车工程部', invalidatedReason: '软件基线变化（VER-118-02）'
      }),
      acc({
        regulationId: 'REG-BRAKE', configuration: '标准续航后驱版',
        evidenceId: 'EV-118-01', revisionId: 'EV-118-01-r1', softwareVersion: '8.3.9',
        acceptedAt: '2026-09-12T03:00:00.000Z', acceptedBy: '刘珊',
        invalidatedAt: '2026-09-27T10:00:00.000Z', invalidatedBy: '刘珊', invalidatedReason: '被修订 R3 替代'
      }),
      acc({
        regulationId: 'REG-BRAKE', configuration: '长续航四驱版',
        evidenceId: 'EV-118-01', revisionId: 'EV-118-01-r2', softwareVersion: '8.4.1',
        acceptedAt: '2026-09-27T10:00:00.000Z', acceptedBy: '刘珊'
      }),
      acc({
        regulationId: 'REG-BRAKE', configuration: '标准续航后驱版',
        evidenceId: 'EV-118-01', revisionId: 'EV-118-01-r2', softwareVersion: '8.4.1',
        acceptedAt: '2026-09-27T10:00:00.000Z', acceptedBy: '刘珊'
      }),
      // 软件：长续航 8.3.9 接受记录在基线升级时失效；S2 被拒，未产生新接受
      acc({
        regulationId: 'REG-SOFTWARE', configuration: '长续航四驱版',
        evidenceId: 'EV-118-02', revisionId: 'EV-118-02-r1', softwareVersion: '8.3.9',
        acceptedAt: '2026-09-12T06:00:00.000Z', acceptedBy: '刘珊',
        invalidatedAt: '2026-09-27T04:10:00.000Z', invalidatedBy: '远航汽车工程部', invalidatedReason: '软件基线变化（VER-118-02）'
      }),
      // 电池：与制动同样的补件闭环
      acc({
        regulationId: 'REG-BATTERY', configuration: '长续航四驱版',
        evidenceId: 'EV-118-04', revisionId: 'EV-118-04-r1', softwareVersion: '8.3.9',
        acceptedAt: '2026-09-12T08:00:00.000Z', acceptedBy: '刘珊',
        invalidatedAt: '2026-09-27T04:10:00.000Z', invalidatedBy: '远航汽车工程部', invalidatedReason: '软件基线变化（VER-118-02）'
      }),
      acc({
        regulationId: 'REG-BATTERY', configuration: '标准续航后驱版',
        evidenceId: 'EV-118-04', revisionId: 'EV-118-04-r1', softwareVersion: '8.3.9',
        acceptedAt: '2026-09-12T08:00:00.000Z', acceptedBy: '刘珊',
        invalidatedAt: '2026-09-27T10:00:00.000Z', invalidatedBy: '刘珊', invalidatedReason: '被修订 R4 替代'
      }),
      acc({
        regulationId: 'REG-BATTERY', configuration: '长续航四驱版',
        evidenceId: 'EV-118-04', revisionId: 'EV-118-04-r2', softwareVersion: '8.4.1',
        acceptedAt: '2026-09-27T10:00:00.000Z', acceptedBy: '刘珊'
      }),
      acc({
        regulationId: 'REG-BATTERY', configuration: '标准续航后驱版',
        evidenceId: 'EV-118-04', revisionId: 'EV-118-04-r2', softwareVersion: '8.4.1',
        acceptedAt: '2026-09-27T10:00:00.000Z', acceptedBy: '刘珊'
      }),
      // EMC / 排放：8.4.1 基线后直接接受，覆盖两个配置
      acc({
        regulationId: 'REG-EMC', configuration: '长续航四驱版',
        evidenceId: 'EV-118-05', revisionId: 'EV-118-05-r1', softwareVersion: '8.4.1',
        acceptedAt: '2026-09-22T03:00:00.000Z', acceptedBy: '刘珊'
      }),
      acc({
        regulationId: 'REG-EMC', configuration: '标准续航后驱版',
        evidenceId: 'EV-118-05', revisionId: 'EV-118-05-r1', softwareVersion: '8.4.1',
        acceptedAt: '2026-09-22T03:00:00.000Z', acceptedBy: '刘珊'
      }),
      acc({
        regulationId: 'REG-WLTP', configuration: '长续航四驱版',
        evidenceId: 'EV-118-06', revisionId: 'EV-118-06-r1', softwareVersion: '8.4.1',
        acceptedAt: '2026-09-22T05:00:00.000Z', acceptedBy: '刘珊'
      }),
      acc({
        regulationId: 'REG-WLTP', configuration: '标准续航后驱版',
        evidenceId: 'EV-118-06', revisionId: 'EV-118-06-r1', softwareVersion: '8.4.1',
        acceptedAt: '2026-09-22T05:00:00.000Z', acceptedBy: '刘珊'
      }),
      // 能耗：长续航 8.3.9 接受已过期，标准后驱从未覆盖
      acc({
        regulationId: 'REG-ENERGY', configuration: '长续航四驱版',
        evidenceId: 'EV-118-07', revisionId: 'EV-118-07-r1', softwareVersion: '8.3.9',
        acceptedAt: '2026-09-12T09:30:00.000Z', acceptedBy: '刘珊',
        invalidatedAt: '2026-09-27T04:10:00.000Z', invalidatedBy: '远航汽车工程部', invalidatedReason: '软件基线变化（VER-118-02）'
      }),
      // 部件：仅标准后驱被接受
      acc({
        regulationId: 'REG-COMPONENT', configuration: '标准续航后驱版',
        evidenceId: 'EV-118-08', revisionId: 'EV-118-08-r1', softwareVersion: '8.4.1',
        acceptedAt: '2026-09-23T02:00:00.000Z', acceptedBy: '刘珊'
      })
    ],
    versions: [
      {
        id: 'VER-118-02',
        label: 'MY27.1 / 8.4.1',
        author: '远航汽车工程部',
        createdAt: '2026-09-27T04:10:00.000Z',
        summary: '升级软件基线至 8.4.1，并声明长续航四驱版照明差异。',
        changes: ['整车软件由 8.3.9 升级至 8.4.1', '新增长续航四驱版后雾灯合规声明'],
        impactedConfigurations: ['长续航四驱版'],
        impactedRegulations: regulationCatalog.map((item) => item.id),
        invalidatedCells: [
          { configuration: '长续航四驱版', regulationId: 'REG-BRAKE' },
          { configuration: '长续航四驱版', regulationId: 'REG-BATTERY' },
          { configuration: '长续航四驱版', regulationId: 'REG-SOFTWARE' },
          { configuration: '长续航四驱版', regulationId: 'REG-ENERGY' }
        ]
      },
      {
        id: 'VER-118-01',
        label: 'MY27.1 / 8.3.9',
        author: '远航汽车工程部',
        createdAt: '2026-09-10T01:20:00.000Z',
        summary: '首次提交型式认证证据包，同时申报两个配置。',
        changes: ['建立法规项目与首版测试报告关联', '申报配置：长续航四驱版、标准续航后驱版'],
        impactedConfigurations: ['长续航四驱版', '标准续航后驱版'],
        impactedRegulations: [],
        invalidatedCells: []
      }
    ],
    audit: [
      {
        id: 'AUD-118-07',
        actor: '刘珊',
        action: '退回补件',
        detail: '覆盖矩阵仍有待补与版本过期单元格，详见批准阻断项。',
        createdAt: '2026-09-28T10:45:00.000Z'
      },
      {
        id: 'AUD-118-06',
        actor: '刘珊',
        action: '接受补件修订',
        detail: '接受制动报告 R3、电池报告 R4，对应配置重新测试后恢复覆盖。',
        createdAt: '2026-09-27T10:00:00.000Z',
        coverageChanges: [
          { regulationId: 'REG-BRAKE', regulationCode: 'GB 21670', configuration: '长续航四驱版', from: 'stale', to: 'accepted' },
          { regulationId: 'REG-BATTERY', regulationCode: 'GB 38031', configuration: '长续航四驱版', from: 'stale', to: 'accepted' }
        ]
      },
      {
        id: 'AUD-118-05',
        actor: '远航汽车工程部',
        action: '批量补件',
        detail: '提交制动 R3、电池 R4 补件修订（SW 8.4.1），等待审阅。',
        createdAt: '2026-09-27T09:00:00.000Z',
        coverageChanges: [
          { regulationId: 'REG-BRAKE', regulationCode: 'GB 21670', configuration: '长续航四驱版', from: 'stale', to: 'pending', note: '补件已提交，等待审阅' },
          { regulationId: 'REG-BATTERY', regulationCode: 'GB 38031', configuration: '长续航四驱版', from: 'stale', to: 'pending', note: '补件已提交，等待审阅' }
        ]
      },
      {
        id: 'AUD-118-04',
        actor: '远航汽车工程部',
        action: '更新版本',
        detail: '软件基线 8.3.9 → 8.4.1，仅失效长续航四驱版受影响法规单元格。',
        createdAt: '2026-09-27T04:10:00.000Z',
        coverageChanges: [
          { regulationId: 'REG-BRAKE', regulationCode: 'GB 21670', configuration: '长续航四驱版', from: 'accepted', to: 'stale' },
          { regulationId: 'REG-BATTERY', regulationCode: 'GB 38031', configuration: '长续航四驱版', from: 'accepted', to: 'stale' },
          { regulationId: 'REG-SOFTWARE', regulationCode: 'R156', configuration: '长续航四驱版', from: 'accepted', to: 'stale' },
          { regulationId: 'REG-ENERGY', regulationCode: 'GB 27999', configuration: '长续航四驱版', from: 'accepted', to: 'stale' }
        ]
      },
      {
        id: 'AUD-118-03',
        actor: '刘珊',
        action: '审阅证据',
        detail: '软件更新影响评估 S2 仍基于 8.3.9，予以拒绝。',
        createdAt: '2026-09-25T06:30:00.000Z'
      },
      {
        id: 'AUD-118-01',
        actor: '远航汽车工程部',
        action: '建立项目',
        detail: '创建型式认证证据包，申报两个配置。',
        createdAt: '2026-09-10T01:20:00.000Z'
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
    progress: 17,
    applicant: '北辰汽车',
    reviewer: '赵驰',
    agency: '华南认证中心',
    submittedAt: '2026-09-05',
    updatedAt: '2026-09-26T02:15:00.000Z',
    certificateExpiry: '2026-11-20',
    regulations: structuredClone(regulationCatalog.slice(0, 6)),
    evidence: [
      evidence('EV-109-01', 'TA-2026-109', 'REG-EMC', [
        rev('EV-109-01', {
          revision: 1,
          name: '整车电磁兼容报告',
          type: 'test_report',
          version: 'R2',
          softwareVersion: '5.7.0',
          configurations: ['七座旗舰版'],
          status: 'accepted',
          note: '基线升级后完成的 EMC 试验，目前仅覆盖七座旗舰版。',
          updatedAt: '2026-09-10T03:00:00.000Z',
          updatedBy: '赵驰'
        })
      ]),
      evidence('EV-109-02', 'TA-2026-109', 'REG-WLTP', [
        rev('EV-109-02', {
          revision: 1,
          name: 'PHEV 排放与能耗试验报告',
          type: 'test_report',
          version: 'R1',
          softwareVersion: '5.7.0',
          configurations: ['七座旗舰版'],
          status: 'accepted',
          note: '仅完成七座旗舰版排放试验。',
          updatedAt: '2026-09-10T05:00:00.000Z',
          updatedBy: '赵驰'
        })
      ]),
      evidence('EV-109-03', 'TA-2026-109', 'REG-BRAKE', [
        rev('EV-109-03', {
          revision: 1,
          name: '制动系统型式试验报告',
          type: 'test_report',
          version: 'R1',
          softwareVersion: '5.6.8',
          configurations: ['七座旗舰版'],
          status: 'accepted',
          note: '首版制动报告，基于 SW 5.6.8。',
          updatedAt: '2026-09-06T03:00:00.000Z',
          updatedBy: '赵驰'
        })
      ]),
      evidence('EV-109-04', 'TA-2026-109', 'REG-SOFTWARE', [
        rev('EV-109-04', {
          revision: 1,
          name: '软件更新影响评估',
          type: 'software_report',
          version: 'S1',
          softwareVersion: '5.6.8',
          configurations: ['七座旗舰版'],
          status: 'resubmit',
          note: '测试软件版本与当前申报基线 5.7.0 不一致，需重新评估后提交。',
          updatedAt: '2026-09-26T02:15:00.000Z',
          updatedBy: '赵驰'
        })
      ])
    ],
    coverage: [
      acc({
        regulationId: 'REG-EMC', configuration: '七座旗舰版',
        evidenceId: 'EV-109-01', revisionId: 'EV-109-01-r1', softwareVersion: '5.7.0',
        acceptedAt: '2026-09-10T03:00:00.000Z', acceptedBy: '赵驰'
      }),
      acc({
        regulationId: 'REG-WLTP', configuration: '七座旗舰版',
        evidenceId: 'EV-109-02', revisionId: 'EV-109-02-r1', softwareVersion: '5.7.0',
        acceptedAt: '2026-09-10T05:00:00.000Z', acceptedBy: '赵驰'
      }),
      acc({
        regulationId: 'REG-BRAKE', configuration: '七座旗舰版',
        evidenceId: 'EV-109-03', revisionId: 'EV-109-03-r1', softwareVersion: '5.6.8',
        acceptedAt: '2026-09-06T03:00:00.000Z', acceptedBy: '赵驰',
        invalidatedAt: '2026-09-08T02:00:00.000Z', invalidatedBy: '北辰汽车', invalidatedReason: '软件基线变化（VER-109-02）'
      })
    ],
    versions: [
      {
        id: 'VER-109-02',
        label: 'MY26.2 / 5.7.0',
        author: '北辰汽车',
        createdAt: '2026-09-08T02:00:00.000Z',
        summary: '软件基线升级至 5.7.0，影响七座旗舰版。',
        changes: ['整车软件由 5.6.8 升级至 5.7.0'],
        impactedConfigurations: ['七座旗舰版'],
        impactedRegulations: regulationCatalog.slice(0, 6).map((item) => item.id),
        invalidatedCells: [{ configuration: '七座旗舰版', regulationId: 'REG-BRAKE' }]
      },
      {
        id: 'VER-109-01',
        label: 'MY26.2 / 5.6.8',
        author: '北辰汽车',
        createdAt: '2026-09-05T08:00:00.000Z',
        summary: '首次提交 PHEV 整车证据包，申报两个配置。',
        changes: ['建立 6 个法规项', '申报配置：七座旗舰版、六座豪华版'],
        impactedConfigurations: ['七座旗舰版', '六座豪华版'],
        impactedRegulations: [],
        invalidatedCells: []
      }
    ],
    audit: [
      {
        id: 'AUD-109-03',
        actor: '赵驰',
        action: '要求补件',
        detail: '七座旗舰版制动单元格版本过期、软件评估需按 5.7.0 重测；六座豪华版全部法规待补。',
        createdAt: '2026-09-26T02:15:00.000Z'
      },
      {
        id: 'AUD-109-02',
        actor: '北辰汽车',
        action: '更新版本',
        detail: '软件基线 5.6.8 → 5.7.0，仅失效七座旗舰版受影响单元格。',
        createdAt: '2026-09-08T02:00:00.000Z',
        coverageChanges: [
          { regulationId: 'REG-BRAKE', regulationCode: 'GB 21670', configuration: '七座旗舰版', from: 'accepted', to: 'stale' }
        ]
      },
      {
        id: 'AUD-109-01',
        actor: '北辰汽车',
        action: '建立项目',
        detail: '创建 PHEV 型式认证证据包。',
        createdAt: '2026-09-05T08:00:00.000Z'
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
    regulations: structuredClone(regulationCatalog.slice(0, 5)),
    evidence: [
      evidence('EV-092-01', 'TA-2026-092', 'REG-BRAKE', [
          rev('EV-092-01', {
            revision: 1, name: '制动系统批准证书', type: 'certificate', version: 'R1',
            softwareVersion: '3.2.4', configurations: ['高顶货运版'], status: 'accepted',
            expiryDate: '2027-08-29', note: '已纳入正式批准版本。',
            updatedAt: '2026-08-30T09:20:00.000Z', updatedBy: '何谦'
          })
        ]),
        evidence('EV-092-02', 'TA-2026-092', 'REG-LIGHT', [
          rev('EV-092-02', {
            revision: 1, name: '外部照明装置批准报告', type: 'test_report', version: 'R1',
            softwareVersion: '3.2.4', configurations: ['高顶货运版'], status: 'accepted',
            note: '正式批准版。', updatedAt: '2026-08-28T03:00:00.000Z', updatedBy: '何谦'
          })
        ]),
        evidence('EV-092-03', 'TA-2026-092', 'REG-EMC', [
          rev('EV-092-03', {
            revision: 1, name: '整车电磁兼容报告', type: 'test_report', version: 'R1',
            softwareVersion: '3.2.4', configurations: ['高顶货运版'], status: 'accepted',
            note: '正式批准版。', updatedAt: '2026-08-28T03:30:00.000Z', updatedBy: '何谦'
          })
        ]),
        evidence('EV-092-04', 'TA-2026-092', 'REG-SOFTWARE', [
          rev('EV-092-04', {
            revision: 1, name: '软件更新管理体系评估', type: 'software_report', version: 'R1',
            softwareVersion: '3.2.4', configurations: ['高顶货运版'], status: 'accepted',
            note: '正式批准版。', updatedAt: '2026-08-28T04:00:00.000Z', updatedBy: '何谦'
          })
        ]),
        evidence('EV-092-05', 'TA-2026-092', 'REG-WLTP', [
          rev('EV-092-05', {
            revision: 1, name: '排放试验报告', type: 'test_report', version: 'R1',
            softwareVersion: '3.2.4', configurations: ['高顶货运版'], status: 'accepted',
            note: '正式批准版。', updatedAt: '2026-08-28T04:30:00.000Z', updatedBy: '何谦'
          })
        ])
    ],
    coverage: [
      acc({ regulationId: 'REG-BRAKE', configuration: '高顶货运版', evidenceId: 'EV-092-01', revisionId: 'EV-092-01-r1', softwareVersion: '3.2.4', acceptedAt: '2026-08-30T09:20:00.000Z', acceptedBy: '何谦' }),
      acc({ regulationId: 'REG-LIGHT', configuration: '高顶货运版', evidenceId: 'EV-092-02', revisionId: 'EV-092-02-r1', softwareVersion: '3.2.4', acceptedAt: '2026-08-28T03:00:00.000Z', acceptedBy: '何谦' }),
      acc({ regulationId: 'REG-EMC', configuration: '高顶货运版', evidenceId: 'EV-092-03', revisionId: 'EV-092-03-r1', softwareVersion: '3.2.4', acceptedAt: '2026-08-28T03:30:00.000Z', acceptedBy: '何谦' }),
      acc({ regulationId: 'REG-SOFTWARE', configuration: '高顶货运版', evidenceId: 'EV-092-04', revisionId: 'EV-092-04-r1', softwareVersion: '3.2.4', acceptedAt: '2026-08-28T04:00:00.000Z', acceptedBy: '何谦' }),
      acc({ regulationId: 'REG-WLTP', configuration: '高顶货运版', evidenceId: 'EV-092-05', revisionId: 'EV-092-05-r1', softwareVersion: '3.2.4', acceptedAt: '2026-08-28T04:30:00.000Z', acceptedBy: '何谦' })
    ],
    versions: [
      {
        id: 'VER-092-02',
        label: '批准版 / 3.2.4',
        author: '何谦',
        createdAt: '2026-08-30T09:20:00.000Z',
        summary: '完成审批并锁定正式提交包。',
        changes: ['全部必选法规 × 配置单元格均为已接受', '锁定软件与维护版本'],
        impactedConfigurations: ['高顶货运版'],
        impactedRegulations: [],
        invalidatedCells: []
      },
      {
        id: 'VER-092-01',
        label: 'MY26.0 / 3.2.4',
        author: '西岭商用车',
        createdAt: '2026-07-12T08:00:00.000Z',
        summary: '首次提交商用车改款证据包。',
        changes: ['建立 5 个法规项'],
        impactedConfigurations: ['高顶货运版'],
        impactedRegulations: [],
        invalidatedCells: []
      }
    ],
    audit: [
      {
        id: 'AUD-092-03',
        actor: '何谦',
        action: '批准',
        detail: '覆盖矩阵 5/5 单元格已接受，提交包版本锁定。',
        createdAt: '2026-08-30T09:20:00.000Z'
      },
      {
        id: 'AUD-092-01',
        actor: '西岭商用车',
        action: '建立项目',
        detail: '创建商用车改款证据包。',
        createdAt: '2026-07-12T08:00:00.000Z'
      }
    ]
  },
  {
    id: 'TA-2026-120',
    name: '城市物流电动货车',
    modelCode: 'EVL-3',
    vehicleType: 'N1',
    configurations: ['标准厢式版', '长续航厢式版'],
    maintenanceVersion: 'MY27.0',
    softwareVersion: '1.9.2',
    status: 'draft',
    progress: 8,
    applicant: '江洲新能源',
    reviewer: '待分派',
    agency: '华东认证中心',
    updatedAt: '2026-09-27T12:30:00.000Z',
    certificateExpiry: '2026-10-24',
    regulations: structuredClone(
      regulationCatalog.filter((item) => ['REG-BRAKE', 'REG-EMC', 'REG-BATTERY'].includes(item.id))
    ),
    evidence: [
      evidence('EV-120-01', 'TA-2026-120', 'REG-BATTERY', [
        rev('EV-120-01', {
          revision: 1,
          name: '电池包部件清单',
          type: 'part_list',
          version: 'D1',
          softwareVersion: '1.9.2',
          configurations: ['标准厢式版'],
          status: 'submitted',
          note: '等待认证机构确认零件号完整性，长续航厢式版尚未覆盖。',
          updatedAt: '2026-09-27T12:30:00.000Z'
        })
      ])
    ],
    coverage: [],
    versions: [
      {
        id: 'VER-120-01',
        label: 'MY27.0 / 1.9.2',
        author: '江洲新能源',
        createdAt: '2026-09-27T12:30:00.000Z',
        summary: '建立认证项目草稿，申报两个配置。',
        changes: ['录入整车基础信息和电池部件清单', '申报配置：标准厢式版、长续航厢式版'],
        impactedConfigurations: ['标准厢式版', '长续航厢式版'],
        impactedRegulations: [],
        invalidatedCells: []
      }
    ],
    audit: [
      {
        id: 'AUD-120-01',
        actor: '江洲新能源',
        action: '建立项目',
        detail: '创建认证证据包草稿。',
        createdAt: '2026-09-27T12:30:00.000Z'
      }
    ]
  }
];
