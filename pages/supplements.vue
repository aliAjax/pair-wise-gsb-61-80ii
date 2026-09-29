<script setup lang="ts">
import { buildCoverageMatrix, coverageStateColors, coverageStateLabels, latestRevision } from '~/services/coverage';
import { validateEvidenceUpgrade } from '~/services/validators';
import { useCertificationStore } from '~/stores/certification';
import type { SupplementInput } from '~/types/certification';

const store = useCertificationStore();
const selectedProjectId = ref('');
const selectedCells = ref<string[]>([]);
const fileVersion = ref('');
const note = ref('');
const message = ref('');
const error = ref('');

const projectOptions = computed(() =>
  store.projects
    .filter((project) => buildCoverageMatrix(project).openCells.length > 0)
    .map((project) => ({ label: `${project.id} · ${project.name}`, value: project.id }))
);

const current = computed(() => store.projects.find((project) => project.id === selectedProjectId.value));
const matrix = computed(() => (current.value ? buildCoverageMatrix(current.value) : undefined));

watch(selectedProjectId, () => {
  selectedCells.value = [];
  message.value = '';
  error.value = '';
});

function toggleCell(key: string) {
  selectedCells.value = selectedCells.value.includes(key)
    ? selectedCells.value.filter((item) => item !== key)
    : [...selectedCells.value, key];
}

const selectedCellDetails = computed(() =>
  selectedCells.value
    .map((key) => {
      const [regulationId, configuration] = key.split('@@');
      const cell = matrix.value?.cell(regulationId, configuration);
      if (!cell || cell.state === 'accepted') return null;
      const evidence =
        current.value?.evidence.find((item) => item.id === cell.evidenceId) ??
        current.value?.evidence.find((item) => item.regulationId === regulationId);
      return evidence
        ? { key, regulationId, configuration, state: cell.state, evidenceId: evidence.id, evidence }
        : { key, regulationId, configuration, state: cell.state, evidenceId: '', evidence: undefined };
    })
    .filter((item): item is NonNullable<typeof item> => !!item)
);

const missingEvidenceCells = computed(() => selectedCellDetails.value.filter((item) => !item.evidence));

function submit() {
  message.value = '';
  error.value = '';
  if (!current.value || !matrix.value) {
    error.value = '请选择需要补件的认证项目';
    return;
  }
  if (missingEvidenceCells.value.length) {
    error.value = `存在尚无证据文件的单元格，请先在项目页新增证据：${missingEvidenceCells.value
      .map((item) => `${item.regulationId} × ${item.configuration}`)
      .join('、')}`;
    return;
  }

  const grouped = new Map<string, string[]>();
  for (const item of selectedCellDetails.value) {
    if (!item.evidence) continue;
    const previous = latestRevision(item.evidence)?.configurations ?? [];
    const configs = grouped.get(item.evidenceId) ?? [...previous];
    if (!configs.includes(item.configuration)) configs.push(item.configuration);
    grouped.set(item.evidenceId, configs);
  }

  const input: SupplementInput = {
    targets: Array.from(grouped.entries()).map(([evidenceId, configurations]) => ({ evidenceId, configurations })),
    fileVersion: fileVersion.value,
    note: note.value
  };

  const errors = validateEvidenceUpgrade(current.value, input);
  if (errors.length) {
    error.value = errors.join('；');
    return;
  }
  const result = store.supplement(current.value.id, input);
  selectedCells.value = [];
  fileVersion.value = '';
  note.value = '';
  message.value = `已生成 ${result.count} 条补件新修订，历史报告与文件版本保留；请通知审阅人接受后恢复覆盖。`;
}

onMounted(() => {
  store.hydrate();
  if (!selectedProjectId.value && projectOptions.value[0]) selectedProjectId.value = projectOptions.value[0].value;
});
</script>

<template>
  <div class="mb-6">
    <h1 class="text-2xl font-semibold">批量补件工作区</h1>
    <p class="mt-1 text-sm text-slate-600">
      在覆盖矩阵中勾选待补或版本过期单元格；补件为旧证据追加新修订（不覆盖历史），软件版本对齐当前基线。
    </p>
  </div>

  <div v-if="message" class="mb-4 border border-green-200 bg-green-50 p-3 text-sm text-green-900">{{ message }}</div>
  <div v-if="error" class="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-900">{{ error }}</div>

  <section class="mb-5 border border-slate-200 bg-white p-4">
    <div class="grid gap-4 md:grid-cols-3">
      <UFormGroup label="认证项目">
        <USelect v-model="selectedProjectId" :options="projectOptions" />
      </UFormGroup>
      <div v-if="current && matrix" class="text-sm">
        <p class="text-slate-500">申报配置（{{ current.configurations.length }}）</p>
        <p class="mt-1 font-medium">{{ current.configurations.join('、') }}</p>
      </div>
      <div v-if="current && matrix" class="text-sm">
        <p class="text-slate-500">当前基线 / 开放单元格</p>
        <p class="metric-value mt-1 font-medium">
          {{ current.maintenanceVersion }} / SW {{ current.softwareVersion }} ·
          <span class="text-amber-700">{{ matrix.pendingCells.length }} 待补</span> ·
          <span class="text-red-700">{{ matrix.staleCells.length }} 过期</span>
        </p>
      </div>
    </div>
  </section>

  <div v-if="current && matrix" class="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
    <CoverageMatrix
      :regulations="current.regulations"
      :configurations="current.configurations"
      :cells="matrix.cells"
      :baseline="current.softwareVersion"
      selectable
      :selected="selectedCells"
      @toggle="toggleCell"
    />

    <section class="border border-slate-200 bg-white p-5">
      <h2 class="font-semibold">补件清单（{{ selectedCellDetails.length }} 个单元格）</h2>
      <ul class="mt-3 space-y-2 text-sm">
        <li
          v-for="item in selectedCellDetails"
          :key="item.key"
          class="flex items-center justify-between gap-2 border border-slate-200 px-3 py-2"
        >
          <span>
            <span class="font-mono text-xs">{{ item.regulationId }}</span>
            <span class="mx-1">×</span>{{ item.configuration }}
          </span>
          <UBadge :color="coverageStateColors[item.state]" variant="soft">{{ coverageStateLabels[item.state] }}</UBadge>
        </li>
      </ul>
      <p v-if="!selectedCellDetails.length" class="mt-3 text-sm text-slate-500">
        在左侧矩阵勾选非已接受单元格。
      </p>

      <form class="mt-5 space-y-4" @submit.prevent="submit">
        <UFormGroup label="新文件版本（可选）">
          <UInput v-model="fileVersion" placeholder="留空则按原版本自动递增" />
        </UFormGroup>
        <UFormGroup label="批量补件说明">
          <UTextarea v-model="note" :rows="4" placeholder="填写重新测试的配置、软件基线核对和测试结论（至少 6 个字符）" />
        </UFormGroup>
        <UButton type="submit" color="primary" class="w-full justify-center">生成补件修订</UButton>
      </form>
    </section>
  </div>
</template>
