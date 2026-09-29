<script setup lang="ts">
import type { CoverageCellStatus, EvidenceStatus, ProjectInput, ProjectStatus } from '~/types/certification';
import { validateEvidenceUpgrade, validateProjectInput, validateSubmission } from '~/services/validators';
import { activeEvidence, blockingCells, coverageStatusLabels } from '~/services/coverage-matrix';
import { useCertificationStore } from '~/stores/certification';

const route = useRoute();
const store = useCertificationStore();
const id = String(route.params.id);
const project = computed(() => store.projectById(id));
const activeTab = ref(0);
const message = ref('');
const error = ref('');

const editor = reactive({
  name: '',
  modelCode: '',
  vehicleType: '',
  configurationText: '',
  maintenanceVersion: '',
  softwareVersion: '',
  applicant: '',
  agency: '',
  certificateExpiry: ''
});

function editorInput(): ProjectInput | null {
  if (!project.value) return null;
  return {
    name: editor.name,
    modelCode: editor.modelCode,
    vehicleType: editor.vehicleType,
    configurations: editor.configurationText.split('\n').map((item) => item.trim()).filter(Boolean),
    maintenanceVersion: editor.maintenanceVersion,
    softwareVersion: editor.softwareVersion,
    applicant: editor.applicant,
    agency: editor.agency,
    certificateExpiry: editor.certificateExpiry
  };
}

watch(
  project,
  (value) => {
    if (!value) return;
    Object.assign(editor, {
      name: value.name,
      modelCode: value.modelCode,
      vehicleType: value.vehicleType,
      configurationText: value.configurations.join('\n'),
      maintenanceVersion: value.maintenanceVersion,
      softwareVersion: value.softwareVersion,
      applicant: value.applicant,
      agency: value.agency,
      certificateExpiry: value.certificateExpiry
    });
  },
  { immediate: true }
);

const transitionStatus = ref<ProjectStatus>('under_review');
const transitionReason = ref('');
const editReason = ref('');
const supplementNote = ref('');
const selectedEvidence = ref<string[]>([]);

const tabs = [
  { label: '覆盖矩阵', icon: 'i-heroicons-table-cells' },
  { label: '证据文件', icon: 'i-heroicons-document-text' },
  { label: '版本与补件', icon: 'i-heroicons-arrows-right-left' },
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
const blockers = computed(() => (project.value ? blockingCells(project.value) : []));
const liveEvidence = computed(() => (project.value ? activeEvidence(project.value) : []));
const archivedEvidence = computed(() => project.value?.evidence.filter((item) => item.supersededBy) ?? []);
const supplementCandidates = computed(() =>
  liveEvidence.value.filter(
    (item) =>
      ['rejected', 'resubmit', 'missing', 'submitted'].includes(item.status) ||
      (item.status === 'accepted' && !!project.value && item.softwareVersion !== project.value.softwareVersion)
  )
);

function cellLabel(status: CoverageCellStatus | null | undefined) {
  return status ? coverageStatusLabels[status] : '—';
}

const submitButtonLabel = computed(() =>
  transitionStatus.value === 'approved' && blockers.value.length > 0
    ? `仍有 ${blockers.value.length} 个单元格未闭环`
    : '提交审批流转'
);

function saveEditor() {
  message.value = '';
  error.value = '';
  const input = editorInput();
  if (!input) return;
  const errors = validateProjectInput(input);
  if (Object.keys(errors).length) {
    error.value = Object.values(errors)[0] ?? '项目资料校验失败';
    return;
  }
  if (!editReason.value.trim()) {
    error.value = '请填写本次变更原因';
    return;
  }
  store.updateProject(id, input, editReason.value);
  editReason.value = '';
  message.value = '项目资料与版本影响已保存，覆盖矩阵已按受影响单元格更新。';
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
    error.value = `存在 ${blockers.value.length} 个未闭环单元格，不能批准。`;
    return;
  }
  const actor = project.value.reviewer === '待分派' ? '认证机构审阅人' : project.value.reviewer;
  const ok = store.transition(id, transitionStatus.value, actor, transitionReason.value);
  if (!ok) {
    error.value = '批准被阻断：仍有必选法规的配置单元格未接受。';
    return;
  }
  transitionReason.value = '';
  message.value = '审批状态已更新。';
}

function updateEvidence(evidenceId: string, status: EvidenceStatus) {
  if (!project.value) return;
  store.updateEvidence(id, evidenceId, status, `审阅人将证据标记为${status}`);
  message.value = '证据审阅状态已更新，覆盖矩阵与审计记录已同步。';
}

function bulkSupplement() {
  if (!project.value) return;
  const errors = validateEvidenceUpgrade(project.value, selectedEvidence.value, supplementNote.value);
  if (errors.length) {
    error.value = errors.join('；');
    return;
  }
  const { count } = store.bulkSupplement(id, selectedEvidence.value, supplementNote.value);
  selectedEvidence.value = [];
  supplementNote.value = '';
  message.value = `已为 ${count} 项证据生成新修订（SW ${project.value.softwareVersion}）并重新提交，旧报告留档，等待重新审阅。`;
}
</script>

<template>
  <div v-if="!project" class="border border-red-200 bg-red-50 p-6 text-red-900">
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
          {{ project.modelCode }} · {{ project.vehicleType }} · {{ project.configurations.join('、') }} ·
          {{ project.maintenanceVersion }} / SW {{ project.softwareVersion }}
        </p>
      </div>
      <div class="min-w-[240px] border border-slate-200 bg-white p-4">
        <div class="flex items-center justify-between text-sm">
          <span class="text-slate-500">必选法规覆盖</span>
          <span class="metric-value font-semibold">{{ project.progress }}%</span>
        </div>
        <UProgress class="mt-2" :value="project.progress" size="sm" />
        <p class="mt-2 text-xs text-slate-500">证书到期：{{ project.certificateExpiry }}</p>
      </div>
    </div>

    <div v-if="message" class="mb-4 border border-green-200 bg-green-50 p-3 text-sm text-green-900">{{ message }}</div>
    <div v-if="error" class="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-900">{{ error }}</div>
    <div v-if="blockingIssues.length" class="mb-5 border border-amber-200 bg-amber-50 p-4">
      <p class="text-sm font-semibold text-amber-950">批准前阻断项（{{ blockers.length }} 个法规×配置单元格）</p>
      <ul class="mt-2 list-inside list-disc space-y-1 text-sm text-amber-900">
        <li v-for="issue in blockingIssues" :key="issue">{{ issue }}</li>
      </ul>
      <div class="mt-3 flex flex-wrap gap-2">
        <UBadge
          v-for="blocker in blockers"
          :key="blocker.regulation.id + '-' + blocker.cell.configuration"
          :color="blocker.cell.status === 'outdated' ? 'red' : 'amber'"
          variant="soft"
        >
          {{ blocker.regulation.code }} × {{ blocker.cell.configuration }}
        </UBadge>
      </div>
    </div>

    <section class="mb-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
      <div class="border border-slate-200 bg-white p-5">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 class="font-semibold">项目与版本基线</h2>
            <p class="mt-1 text-xs text-slate-500">软件基线变化只让受影响单元格失效；每行一个申报配置。</p>
          </div>
        </div>
        <form class="grid gap-4 md:grid-cols-2 xl:grid-cols-3" @submit.prevent="saveEditor">
          <UFormGroup label="项目名称"><UInput v-model="editor.name" /></UFormGroup>
          <UFormGroup label="车型代码"><UInput v-model="editor.modelCode" /></UFormGroup>
          <UFormGroup label="维护版本"><UInput v-model="editor.maintenanceVersion" /></UFormGroup>
          <UFormGroup label="软件版本"><UInput v-model="editor.softwareVersion" /></UFormGroup>
          <UFormGroup label="证书有效期"><UInput v-model="editor.certificateExpiry" type="date" /></UFormGroup>
          <UFormGroup label="申请主体"><UInput v-model="editor.applicant" /></UFormGroup>
          <UFormGroup label="认证机构"><UInput v-model="editor.agency" /></UFormGroup>
          <UFormGroup label="变更原因"><UInput v-model="editReason" placeholder="说明变更和影响范围" /></UFormGroup>
          <UFormGroup label="申报配置（每行一个）" class="md:col-span-2 xl:col-span-3">
            <UTextarea v-model="editor.configurationText" :rows="3" placeholder="长续航四驱版&#10;标准续航后驱版" />
          </UFormGroup>
          <div class="md:col-span-2 xl:col-span-3">
            <UButton type="submit" color="primary">保存并生成版本</UButton>
          </div>
        </form>
      </div>

      <div class="border border-slate-200 bg-white p-5">
        <h2 class="font-semibold">审批流转</h2>
        <p class="mt-1 text-xs text-slate-500">批准前逐必选法规、逐配置检查：已接受 / 待补 / 版本过期。</p>
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
            :disabled="transitionStatus === 'approved' && blockers.length > 0"
          >
            {{ submitButtonLabel }}
          </UButton>
        </form>
      </div>
    </section>

    <UTabs v-model="activeTab" :items="tabs" class="mb-5" />

    <section v-if="activeTab === 0">
      <div class="mb-3">
        <h2 class="font-semibold">法规 × 配置覆盖矩阵</h2>
        <p class="mt-1 text-sm text-slate-500">每个必选法规逐配置显示已接受、待补、版本过期或未覆盖；点击单元格查看证据与修订链。</p>
      </div>
      <CoverageMatrix :project="project" />
    </section>

    <section v-else-if="activeTab === 1" class="space-y-5">
      <div class="border border-slate-200 bg-white">
        <div class="border-b border-slate-200 px-4 py-3">
          <h2 class="font-semibold">生效证据（{{ liveEvidence.length }}）</h2>
          <p class="mt-1 text-xs text-slate-500">逐项接受、拒绝或要求重新抽样；只有当前基线 + 已接受才计入覆盖。</p>
        </div>
        <EvidenceTable :evidence="liveEvidence" :baseline="project.softwareVersion" editable @update="updateEvidence" />
      </div>
      <div v-if="archivedEvidence.length" class="border border-slate-200 bg-white">
        <div class="border-b border-slate-200 px-4 py-3">
          <h2 class="font-semibold">历史修订归档（{{ archivedEvidence.length }}）</h2>
          <p class="mt-1 text-xs text-slate-500">被新补件取代的旧报告与文件版本，留档可追溯，不参与覆盖计算。</p>
        </div>
        <EvidenceTable :evidence="archivedEvidence" />
      </div>
    </section>

    <section v-else-if="activeTab === 2" class="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
      <div class="border border-slate-200 bg-white">
        <div class="border-b border-slate-200 px-4 py-3">
          <h2 class="font-semibold">版本差异</h2>
        </div>
        <div class="divide-y divide-slate-200">
          <article v-for="version in project.versions" :key="version.id" class="p-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="font-medium">{{ version.label }} · {{ version.author }}</p>
                <p class="mt-1 text-xs text-slate-500">{{ version.createdAt.slice(0, 16).replace('T', ' ') }}</p>
              </div>
              <UBadge color="gray" variant="soft">{{ version.impactedConfigurations.join('、') || '无受影响配置' }}</UBadge>
            </div>
            <p class="mt-3 text-sm">{{ version.summary }}</p>
            <ul class="mt-2 list-inside list-disc text-sm text-slate-600">
              <li v-for="change in version.changes" :key="change">{{ change }}</li>
            </ul>
          </article>
        </div>
      </div>

      <div class="border border-slate-200 bg-white p-5">
        <h2 class="font-semibold">批量补件</h2>
        <p class="mt-1 text-xs text-slate-500">补件生成新修订并升级到当前软件基线，旧报告不覆盖；新修订须重新审阅接受。</p>
        <form class="mt-4 space-y-4" @submit.prevent="bulkSupplement">
          <label
            v-for="item in supplementCandidates"
            :key="item.id"
            class="flex gap-3 border border-slate-200 p-3"
          >
            <input v-model="selectedEvidence" type="checkbox" :value="item.id" class="mt-1" />
            <span>
              <span class="flex items-center gap-2 text-sm font-medium">
                {{ item.name }}
                <span class="text-xs text-slate-400">R{{ item.revision }}</span>
              </span>
              <span class="mt-1 block text-xs text-slate-500">{{ item.id }} · 文件 {{ item.version }} · SW {{ item.softwareVersion }}</span>
            </span>
          </label>
          <p v-if="!supplementCandidates.length" class="text-sm text-slate-500">
            当前没有待补件证据。
          </p>
          <UFormGroup label="补件说明">
            <UTextarea v-model="supplementNote" :rows="3" placeholder="说明已完成的重新测试、配置覆盖和版本更新" />
          </UFormGroup>
          <UButton type="submit" color="primary" class="w-full justify-center">生成新修订并重新提交</UButton>
        </form>
      </div>
    </section>

    <section v-else class="border border-slate-200 bg-white p-5">
      <h2 class="font-semibold">项目审计记录</h2>
      <p class="mt-1 text-xs text-slate-500">覆盖变化随操作一并记录，可在提交包中导出。</p>
      <div class="mt-5 space-y-5">
        <article v-for="entry in project.audit" :key="entry.id" class="audit-item">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-sm font-medium">{{ entry.action }} · {{ entry.actor }}</p>
            <span class="text-xs text-slate-500">{{ entry.createdAt.slice(0, 16).replace('T', ' ') }}</span>
          </div>
          <p class="mt-1 text-sm text-slate-600">{{ entry.detail }}</p>
          <div v-if="entry.coverageChanges?.length" class="mt-2 flex flex-wrap gap-1.5">
            <UBadge
              v-for="change in entry.coverageChanges"
              :key="change.regulationId + change.configuration + change.from + change.to"
              :color="change.to === 'accepted' ? 'green' : change.to === 'outdated' ? 'red' : 'amber'"
              variant="soft"
            >
              {{ change.regulationCode }} × {{ change.configuration }}：
              {{ cellLabel(change.from) }}
              →
              {{ cellLabel(change.to) }}
            </UBadge>
          </div>
        </article>
      </div>
    </section>
  </template>
</template>
