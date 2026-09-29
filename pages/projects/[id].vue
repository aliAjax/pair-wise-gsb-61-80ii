<script setup lang="ts">
import type { EvidenceStatus, ProjectInput, ProjectStatus, SupplementInput } from '~/types/certification';
import { validateEvidenceUpgrade, validateProjectInput, validateSubmission } from '~/services/validators';
import { buildCoverageMatrix, coverageStateColors, coverageStateLabels, latestRevision } from '~/services/coverage';
import { useCertificationStore } from '~/stores/certification';

const route = useRoute();
const store = useCertificationStore();
const id = String(route.params.id);
const project = computed(() => store.projectById(id));
const matrix = computed(() => (project.value ? buildCoverageMatrix(project.value) : undefined));

const activeTab = ref(0);
const message = ref('');
const error = ref('');

const editor = reactive<ProjectInput>({
  name: '',
  modelCode: '',
  vehicleType: '',
  configurations: [],
  maintenanceVersion: '',
  softwareVersion: '',
  applicant: '',
  agency: '',
  certificateExpiry: ''
});
const editReason = ref('');
const impactConfigSelection = ref<string[]>([]);
const impactRegSelection = ref<string[]>([]);

watch(
  project,
  (value) => {
    if (!value) return;
    Object.assign(editor, {
      name: value.name,
      modelCode: value.modelCode,
      vehicleType: value.vehicleType,
      configurations: [...value.configurations],
      maintenanceVersion: value.maintenanceVersion,
      softwareVersion: value.softwareVersion,
      applicant: value.applicant,
      agency: value.agency,
      certificateExpiry: value.certificateExpiry
    });
    impactConfigSelection.value = [...value.configurations];
    impactRegSelection.value = value.regulations.filter((item) => item.required).map((item) => item.id);
  },
  { immediate: true }
);

const baselineChanging = computed(
  () =>
    !!project.value &&
    (editor.softwareVersion !== project.value.softwareVersion ||
      editor.maintenanceVersion !== project.value.maintenanceVersion)
);

const regulationMap = computed(() => {
  const map = new Map<string, { code: string; title: string }>();
  project.value?.regulations.forEach((item) => map.set(item.id, { code: item.code, title: item.title }));
  return map;
});

function regulationLabel(regulationId: string) {
  const item = regulationMap.value.get(regulationId);
  return item ? `${item.code} ${item.title}` : regulationId;
}

function regulationCode(regulationId: string) {
  return regulationMap.value.get(regulationId)?.code ?? regulationId;
}

const transitionStatus = ref<ProjectStatus>('under_review');
const transitionReason = ref('');

const tabs = [
  { label: '覆盖矩阵', icon: 'i-heroicons-table-cells' },
  { label: '证据与修订', icon: 'i-heroicons-document-text' },
  { label: '版本与影响', icon: 'i-heroicons-arrows-right-left' },
  { label: '审计记录', icon: 'i-heroicons-clock' }
];

const transitionOptions = computed(() => {
  const current = project.value?.status;
  if (current === 'draft') return [{ label: '提交认证机构', value: 'submitted' }];
  if (current === 'submitted') return [{ label: '开始审阅', value: 'under_review' }];
  if (current === 'under_review') {
    return [
      { label: '要求补件', value: 'supplement_required' },
      { label: '批准', value: 'approved' },
      { label: '拒绝', value: 'rejected' }
    ];
  }
  if (current === 'supplement_required') return [{ label: '重新提交补件', value: 'submitted' }];
  return [{ label: '重新打开审阅', value: 'under_review' }];
});

const blockingIssues = computed(() => (project.value ? validateSubmission(project.value) : []));

function saveEditor() {
  message.value = '';
  error.value = '';
  const errors = validateProjectInput(editor);
  if (Object.keys(errors).length) {
    error.value = Object.values(errors)[0] ?? '项目资料校验失败';
    return;
  }
  if (!editReason.value.trim()) {
    error.value = '请填写本次变更原因';
    return;
  }
  if (baselineChanging.value && !impactConfigSelection.value.length) {
    error.value = '基线变化时请至少选择一个受影响配置（只有这些配置的覆盖单元格会失效）';
    return;
  }
  store.updateProject(id, { ...editor, configurations: [...editor.configurations] }, {
    reason: editReason.value,
    impactedConfigurations: impactConfigSelection.value,
    impactedRegulations: impactRegSelection.value
  });
  editReason.value = '';
  message.value = '项目资料已保存，覆盖变化已写入版本与审计。';
}

function transition() {
  if (!project.value) return;
  message.value = '';
  error.value = '';
  if (!transitionReason.value.trim()) {
    error.value = '请填写审批流转依据';
    return;
  }
  if (transitionStatus.value === 'approved' && blockingIssues.value.length) {
    error.value = `存在阻断项，不能批准：${blockingIssues.value.join('；')}`;
    return;
  }
  const ok = store.transition(
    id,
    transitionStatus.value,
    project.value.reviewer === '待分派' ? '认证机构审阅人' : project.value.reviewer,
    transitionReason.value
  );
  if (!ok) {
    error.value = '覆盖矩阵仍存在待补或版本过期单元格，无法批准。';
    return;
  }
  transitionReason.value = '';
  message.value = '审批状态已更新。';
}

function updateEvidence(evidenceId: string, status: EvidenceStatus) {
  if (!project.value) return;
  store.updateEvidence(id, evidenceId, status, `审阅人将修订标记为${status}`);
  message.value = `证据修订已${status === 'accepted' ? '接受，覆盖单元格已更新' : '处理'}。`;
}

// ---- 单元格级批量补件 ----
const selectedCells = ref<string[]>([]);
const supplementNote = ref('');
const supplementFileVersion = ref('');

function toggleCell(key: string) {
  selectedCells.value = selectedCells.value.includes(key)
    ? selectedCells.value.filter((item) => item !== key)
    : [...selectedCells.value, key];
}

/** 单元格是否存在可补件的证据（同一法规下任意证据，补件修订可扩展配置覆盖） */
function cellSupplementTarget(key: string): { evidenceId: string; configuration: string } | undefined {
  const [regulationId, configuration] = key.split('@@');
  const cell = matrix.value?.cell(regulationId, configuration);
  if (!cell || cell.state === 'accepted') return undefined;
  const evidenceId = cell.evidenceId
    ?? project.value?.evidence.find((item) => item.regulationId === regulationId)?.id;
  if (!evidenceId) return undefined;
  return { evidenceId, configuration };
}

const selectedCellTargets = computed(() =>
  selectedCells.value
    .map((key) => cellSupplementTarget(key))
    .filter((item): item is { evidenceId: string; configuration: string } => !!item)
);

const cellsWithoutEvidence = computed(() =>
  selectedCells.value
    .map((key) => {
      const [regulationId, configuration] = key.split('@@');
      const hasEvidence = project.value?.evidence.some((item) => item.regulationId === regulationId);
      return hasEvidence ? null : { key, regulationId, configuration };
    })
    .filter((item): item is { key: string; regulationId: string; configuration: string } => !!item)
);

function bulkSupplement() {
  if (!project.value) return;
  message.value = '';
  error.value = '';

  if (cellsWithoutEvidence.value.length) {
    error.value = `部分单元格尚无证据文件，请先在“证据与修订”页新增证据：${cellsWithoutEvidence.value
      .map((item) => `${regulationCode(item.regulationId)} × ${item.configuration}`)
      .join('、')}`;
    return;
  }

  const targets = new Map<string, string[]>();
  for (const target of selectedCellTargets.value) {
    const configs = targets.get(target.evidenceId) ?? [];
    if (!configs.includes(target.configuration)) configs.push(target.configuration);
    targets.set(target.evidenceId, configs);
  }

  // 补件修订的配置覆盖 = 原覆盖 ∪ 本次勾选配置，避免缩小覆盖范围
  const input: SupplementInput = {
    targets: Array.from(targets.entries()).map(([evidenceId, configurations]) => {
      const evidence = project.value!.evidence.find((item) => item.id === evidenceId)!;
      const previous = latestRevision(evidence)?.configurations ?? [];
      return {
        evidenceId,
        configurations: Array.from(new Set([...previous, ...configurations]))
      };
    }),
    fileVersion: supplementFileVersion.value,
    note: supplementNote.value
  };

  const errors = validateEvidenceUpgrade(project.value, input);
  if (errors.length) {
    error.value = errors.join('；');
    return;
  }
  const result = store.supplement(id, input);
  selectedCells.value = [];
  supplementNote.value = '';
  supplementFileVersion.value = '';
  message.value = `已为 ${result.count} 项证据生成新修订（不覆盖历史），对应单元格转为待审阅，接受后恢复覆盖。`;
}

// ---- 新增证据 ----
const newEvidence = reactive({
  regulationId: '',
  name: '',
  type: 'test_report' as 'test_report' | 'part_list' | 'software_report' | 'exemption' | 'certificate',
  version: '',
  configurations: [] as string[],
  note: ''
});
const evidenceTypeOptions = [
  { label: '测试报告', value: 'test_report' },
  { label: '部件清单', value: 'part_list' },
  { label: '软件报告', value: 'software_report' },
  { label: '豁免材料', value: 'exemption' },
  { label: '证书', value: 'certificate' }
];

function addEvidence() {
  if (!project.value) return;
  message.value = '';
  error.value = '';
  if (!newEvidence.regulationId || newEvidence.name.trim().length < 2 || !newEvidence.version.trim() || !newEvidence.configurations.length) {
    error.value = '请完整填写法规、证据名称、文件版本，并至少选择一个配置。';
    return;
  }
  store.addEvidence(id, { ...newEvidence });
  Object.assign(newEvidence, { regulationId: '', name: '', version: '', configurations: [], note: '' });
  message.value = '证据已关联并提交审阅，对应单元格当前为待补。';
}

function formatDateTime(value: string) {
  return value.slice(0, 16).replace('T', ' ');
}
</script>

<template>
  <div v-if="!project || !matrix" class="border border-red-200 bg-red-50 p-6 text-red-900">
    未找到认证项目 {{ id }}。
  </div>

  <template v-else>
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <NuxtLink to="/" class="text-sm text-teal-700 hover:underline">返回认证项目</NuxtLink>
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <h1 class="text-2xl font-semibold">{{ project.id }}</h1>
          <StatusBadge :status="project.status" />
        </div>
        <p class="mt-2 text-lg font-medium">{{ project.name }}</p>
        <p class="mt-1 text-sm text-slate-500">
          {{ project.modelCode }} · {{ project.vehicleType }} · {{ project.configurations.join('、') }}
        </p>
        <p class="mt-1 text-sm text-slate-500">
          {{ project.maintenanceVersion }} / SW {{ project.softwareVersion }} · 申报 {{ project.configurations.length }} 个配置
        </p>
      </div>
      <div class="min-w-[260px] border border-slate-200 bg-white p-4">
        <div class="flex items-center justify-between text-sm">
          <span class="text-slate-500">必选单元格覆盖率</span>
          <span class="metric-value font-semibold">{{ matrix.coveragePercent }}%</span>
        </div>
        <UProgress class="mt-2" :value="matrix.coveragePercent" size="sm" />
        <p class="mt-2 text-xs text-slate-500">
          {{ matrix.acceptedRequiredCount }}/{{ matrix.requiredCount }} 已接受 ·
          <span class="text-amber-700">{{ matrix.pendingCells.length }} 待补</span> ·
          <span class="text-red-700">{{ matrix.staleCells.length }} 版本过期</span>
        </p>
        <p class="mt-1 text-xs text-slate-500">证书到期：{{ project.certificateExpiry }}</p>
      </div>
    </div>

    <div v-if="message" class="mb-4 border border-green-200 bg-green-50 p-3 text-sm text-green-900">{{ message }}</div>
    <div v-if="error" class="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-900">{{ error }}</div>

    <!-- 批准入口：逐法规 × 配置列出待补 / 版本过期单元格 -->
    <div v-if="matrix.openCells.length" class="mb-5 border border-amber-200 bg-amber-50 p-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm font-semibold text-amber-950">批准前阻断项（{{ matrix.openCells.length }} 个必选单元格未接受）</p>
        <UButton size="xs" color="amber" variant="solid" @click="activeTab = 0">前往覆盖矩阵补件</UButton>
      </div>
      <ul class="mt-3 grid gap-2 text-sm text-amber-900 md:grid-cols-2">
        <li
          v-for="cell in matrix.openCells"
          :key="`${cell.regulationId}-${cell.configuration}`"
          class="flex items-center justify-between gap-2 border border-amber-200 bg-white/70 px-3 py-2"
        >
          <span>
            <span class="font-mono text-xs">{{ regulationCode(cell.regulationId) }}</span>
            <span class="mx-1">×</span>{{ cell.configuration }}
          </span>
          <UBadge :color="coverageStateColors[cell.state]" variant="soft">{{ coverageStateLabels[cell.state] }}</UBadge>
        </li>
      </ul>
    </div>

    <section class="mb-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
      <div class="border border-slate-200 bg-white p-5">
        <div class="mb-4">
          <h2 class="font-semibold">项目与版本基线</h2>
          <p class="mt-1 text-xs text-slate-500">
            软件基线变化时需选择受影响配置与法规；仅命中的已接受单元格会变为版本过期，其它配置不受影响。
          </p>
        </div>
        <form class="grid gap-4 md:grid-cols-2 xl:grid-cols-3" @submit.prevent="saveEditor">
          <UFormGroup label="项目名称"><UInput v-model="editor.name" /></UFormGroup>
          <UFormGroup label="车型代码"><UInput v-model="editor.modelCode" /></UFormGroup>
          <UFormGroup label="车辆类别"><UInput v-model="editor.vehicleType" /></UFormGroup>

          <div class="md:col-span-2 xl:col-span-2">
            <UFormGroup label="申报配置">
              <div class="space-y-2">
                <div v-for="(_, index) in editor.configurations" :key="index" class="flex gap-2">
                  <UInput v-model="editor.configurations[index]" />
                  <UButton
                    color="red"
                    variant="ghost"
                    icon="i-heroicons-trash"
                    :disabled="editor.configurations.length === 1"
                    @click="editor.configurations.splice(index, 1)"
                  />
                </div>
              </div>
            </UFormGroup>
          </div>
          <div class="flex items-end">
            <UButton size="xs" color="gray" variant="soft" icon="i-heroicons-plus" @click="editor.configurations.push('')">
              增加配置
            </UButton>
          </div>

          <UFormGroup label="维护版本"><UInput v-model="editor.maintenanceVersion" /></UFormGroup>
          <UFormGroup label="软件版本"><UInput v-model="editor.softwareVersion" /></UFormGroup>
          <UFormGroup label="证书有效期"><UInput v-model="editor.certificateExpiry" type="date" /></UFormGroup>
          <UFormGroup label="申请主体"><UInput v-model="editor.applicant" /></UFormGroup>
          <UFormGroup label="认证机构"><UInput v-model="editor.agency" /></UFormGroup>
          <UFormGroup label="变更原因"><UInput v-model="editReason" placeholder="说明变更和影响范围" /></UFormGroup>

          <div v-if="baselineChanging" class="md:col-span-2 xl:col-span-3 border border-amber-200 bg-amber-50 p-3">
            <p class="text-sm font-semibold text-amber-950">基线变化影响范围（保存后立即失效对应已接受单元格）</p>
            <div class="mt-2 grid gap-3 md:grid-cols-2">
              <div>
                <p class="text-xs font-medium text-amber-900">受影响配置</p>
                <label v-for="name in project.configurations" :key="name" class="mt-1 flex items-center gap-2 text-sm text-amber-900">
                  <input v-model="impactConfigSelection" type="checkbox" :value="name" />{{ name }}
                </label>
                <p v-for="name in editor.configurations.filter((item) => item && !project!.configurations.includes(item))" :key="name" class="mt-1 text-xs text-amber-700">
                  新配置「{{ name }}」自动按待补处理，无需勾选
                </p>
              </div>
              <div>
                <p class="text-xs font-medium text-amber-900">受影响法规</p>
                <label
                  v-for="regulation in project.regulations.filter((item) => item.required)"
                  :key="regulation.id"
                  class="mt-1 flex items-center gap-2 text-sm text-amber-900"
                >
                  <input v-model="impactRegSelection" type="checkbox" :value="regulation.id" />
                  {{ regulation.code }} {{ regulation.title }}
                </label>
              </div>
            </div>
          </div>

          <div class="md:col-span-2 xl:col-span-3">
            <UButton type="submit" color="primary">保存并生成版本修订</UButton>
          </div>
        </form>
      </div>

      <div class="border border-slate-200 bg-white p-5">
        <h2 class="font-semibold">审批流转</h2>
        <p class="mt-1 text-xs text-slate-500">批准入口逐格检查覆盖：任一必选单元格待补或版本过期都会阻断批准。</p>
        <div v-if="!matrix.openCells.length" class="mt-3 border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          全部必选单元格已接受，可以批准。
        </div>
        <form class="mt-4 space-y-4" @submit.prevent="transition">
          <UFormGroup label="目标状态">
            <USelect v-model="transitionStatus" :options="transitionOptions" />
          </UFormGroup>
          <UFormGroup label="流转依据">
            <UTextarea v-model="transitionReason" :rows="3" placeholder="记录接受、拒绝或补件依据" />
          </UFormGroup>
          <UButton
            type="submit"
            color="primary"
            class="w-full justify-center"
            :disabled="transitionStatus === 'approved' && matrix.openCells.length > 0"
          >
            提交审批流转
          </UButton>
        </form>
      </div>
    </section>

    <UTabs v-model="activeTab" :items="tabs" class="mb-5" />

    <!-- 覆盖矩阵 + 单元格补件 -->
    <section v-if="activeTab === 0" class="space-y-6">
      <div>
        <h2 class="font-semibold">法规 × 配置覆盖矩阵</h2>
        <p class="mt-1 text-sm text-slate-500">
          每个必选法规逐配置显示已接受、待补或版本过期；勾选非接受单元格可发起补件。
        </p>
      </div>

      <CoverageMatrix
        :regulations="project.regulations"
        :configurations="project.configurations"
        :cells="matrix.cells"
        :baseline="project.softwareVersion"
        selectable
        :selected="selectedCells"
        @toggle="toggleCell"
      />

      <div class="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div class="border border-slate-200 bg-white p-5">
          <h3 class="font-semibold">已勾选补件单元格（{{ selectedCellTargets.length }}）</h3>
          <ul class="mt-3 space-y-2 text-sm">
            <li
              v-for="target in selectedCellTargets"
              :key="`${target.evidenceId}-${target.configuration}`"
              class="flex items-center justify-between gap-2 border border-slate-200 px-3 py-2"
            >
              <span>{{ target.configuration }}</span>
              <span class="font-mono text-xs text-slate-500">
                {{ regulationCode(project.evidence.find((item) => item.id === target.evidenceId)?.regulationId ?? '') }}
                · {{ target.evidenceId }}
              </span>
            </li>
          </ul>
          <p v-if="!selectedCellTargets.length" class="mt-3 text-sm text-slate-500">
            在矩阵中勾选待补或版本过期单元格，补件会为对应证据追加新修订，不覆盖旧报告。
          </p>
        </div>

        <div class="border border-slate-200 bg-white p-5">
          <h3 class="font-semibold">生成补件修订</h3>
          <form class="mt-4 space-y-4" @submit.prevent="bulkSupplement">
            <UFormGroup label="新文件版本（可选，默认自动递增）">
              <UInput v-model="supplementFileVersion" placeholder="例如 R5" />
            </UFormGroup>
            <UFormGroup label="补件说明">
              <UTextarea
                v-model="supplementNote"
                :rows="4"
                placeholder="说明重新测试的配置、软件基线与测试结论（至少 6 个字符）"
              />
            </UFormGroup>
            <p class="text-xs text-slate-500">
              新修订软件版本默认对齐当前基线 SW {{ project.softwareVersion }}，提交后单元格变为待审阅，审阅接受后恢复已接受。
            </p>
            <UButton type="submit" color="primary" class="w-full justify-center">生成补件修订</UButton>
          </form>
        </div>
      </div>
    </section>

    <!-- 证据与修订 -->
    <section v-else-if="activeTab === 1" class="space-y-6">
      <div class="border border-slate-200 bg-white">
        <div class="border-b border-slate-200 px-4 py-3">
          <h2 class="font-semibold">证据文件审阅</h2>
          <p class="mt-1 text-xs text-slate-500">展开证据可查看完整修订链；补件生成新修订，历史报告与文件版本保留。</p>
        </div>
        <EvidenceTable :evidence="project.evidence" :regulation-label="regulationCode" editable @update="updateEvidence" />
      </div>

      <div class="border border-slate-200 bg-white p-5">
        <h2 class="font-semibold">新增覆盖证据</h2>
        <p class="mt-1 text-xs text-slate-500">为尚无证据的法规 × 配置关联首版文件，提交后进入审阅。</p>
        <form class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3" @submit.prevent="addEvidence">
          <UFormGroup label="法规项">
            <USelect
              v-model="newEvidence.regulationId"
              :options="project.regulations.map((item) => ({ label: `${item.code} ${item.title}`, value: item.id }))"
            />
          </UFormGroup>
          <UFormGroup label="证据名称"><UInput v-model="newEvidence.name" placeholder="例如：后雾灯补充测试报告" /></UFormGroup>
          <UFormGroup label="证据类型"><USelect v-model="newEvidence.type" :options="evidenceTypeOptions" /></UFormGroup>
          <UFormGroup label="文件版本"><UInput v-model="newEvidence.version" placeholder="例如 R1" /></UFormGroup>
          <UFormGroup label="覆盖配置">
            <div class="flex flex-wrap gap-3">
              <label v-for="name in project.configurations" :key="name" class="flex items-center gap-2 text-sm">
                <input v-model="newEvidence.configurations" type="checkbox" :value="name" />{{ name }}
              </label>
            </div>
          </UFormGroup>
          <UFormGroup label="说明"><UInput v-model="newEvidence.note" placeholder="测试范围与结论" /></UFormGroup>
          <div class="md:col-span-2 xl:col-span-3">
            <UButton type="submit" color="primary">提交证据审阅</UButton>
          </div>
        </form>
      </div>
    </section>

    <!-- 版本与影响 -->
    <section v-else-if="activeTab === 2" class="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
      <div class="border border-slate-200 bg-white">
        <div class="border-b border-slate-200 px-4 py-3">
          <h2 class="font-semibold">版本与失效单元格</h2>
          <p class="mt-1 text-xs text-slate-500">每个版本永久记录其失效的法规 × 配置单元格。</p>
        </div>
        <div class="divide-y divide-slate-200">
          <article v-for="version in project.versions" :key="version.id" class="p-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="font-medium">{{ version.label }} · {{ version.author }}</p>
                <p class="mt-1 text-xs text-slate-500">{{ formatDateTime(version.createdAt) }}</p>
              </div>
              <UBadge color="gray" variant="soft">{{ version.impactedConfigurations.join('、') || '无受影响配置' }}</UBadge>
            </div>
            <p class="mt-3 text-sm">{{ version.summary }}</p>
            <ul class="mt-2 list-inside list-disc text-sm text-slate-600">
              <li v-for="change in version.changes" :key="change">{{ change }}</li>
            </ul>
            <div v-if="version.invalidatedCells.length" class="mt-3 border border-red-200 bg-red-50 p-3">
              <p class="text-xs font-semibold text-red-900">基线变化失效单元格（{{ version.invalidatedCells.length }}）</p>
              <div class="mt-2 flex flex-wrap gap-2">
                <UBadge v-for="cell in version.invalidatedCells" :key="`${cell.regulationId}-${cell.configuration}`" color="red" variant="soft">
                  {{ regulationCode(cell.regulationId) }} × {{ cell.configuration }}
                </UBadge>
              </div>
              <p class="mt-2 text-[11px] text-red-800">旧报告未被删除，仍可在覆盖矩阵与修订链中追溯，重测接受后恢复。</p>
            </div>
          </article>
        </div>
      </div>

      <div class="border border-slate-200 bg-white p-5">
        <h2 class="font-semibold">覆盖确认台账</h2>
        <p class="mt-1 text-xs text-slate-500">共 {{ project.coverage.length }} 条接受记录，其中 {{ project.coverage.filter((item) => item.invalidatedAt).length }} 条已失效但保留。</p>
        <div class="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
          <div
            v-for="entry in [...project.coverage].reverse()"
            :key="entry.id"
            class="border px-3 py-2 text-xs"
            :class="entry.invalidatedAt ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'"
          >
            <p class="font-medium">
              {{ regulationCode(entry.regulationId) }} × {{ entry.configuration }}
            </p>
            <p class="mt-1 text-slate-600">SW {{ entry.softwareVersion }} · {{ entry.acceptedAt.slice(0, 10) }} · {{ entry.acceptedBy }}</p>
            <p v-if="entry.invalidatedAt" class="mt-1 text-red-800">
              失效：{{ entry.invalidatedReason }}（{{ entry.invalidatedAt.slice(0, 10) }}）
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- 审计 -->
    <section v-else class="border border-slate-200 bg-white p-5">
      <h2 class="font-semibold">项目审计记录</h2>
      <p class="mt-1 text-xs text-slate-500">覆盖变化（accepted / pending / stale 之间的迁移）随操作写入审计。</p>
      <div class="mt-5 space-y-5">
        <article v-for="entry in project.audit" :key="entry.id" class="audit-item">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-sm font-medium">{{ entry.action }} · {{ entry.actor }}</p>
            <span class="text-xs text-slate-500">{{ formatDateTime(entry.createdAt) }}</span>
          </div>
          <p class="mt-1 text-sm text-slate-600">{{ entry.detail }}</p>
          <div v-if="entry.coverageChanges?.length" class="mt-2 flex flex-wrap gap-2">
            <UBadge
              v-for="change in entry.coverageChanges"
              :key="`${change.regulationId}-${change.configuration}-${change.from}-${change.to}`"
              :color="change.to === 'accepted' ? 'green' : change.to === 'stale' ? 'red' : 'amber'"
              variant="soft"
            >
              {{ change.regulationCode ?? change.regulationId }} × {{ change.configuration }}：
              {{ coverageStateLabels[change.from] }} → {{ coverageStateLabels[change.to] }}
            </UBadge>
          </div>
        </article>
      </div>
    </section>
  </template>
</template>
