<script setup lang="ts">
import type { ApprovalProject, CoverageCell, RegulationCoverageRow } from '~/types/certification';
import { buildCoverageMatrix, coverageStatusColors, coverageStatusLabels } from '~/services/coverage-matrix';

const props = defineProps<{
  project: ApprovalProject;
  /** 可选：限定要展示的法规（如按分类过滤） */
  regulations?: ApprovalProject['regulations'];
}>();

const rows = computed<RegulationCoverageRow[]>(() => {
  const matrix = buildCoverageMatrix(props.project);
  if (!props.regulations) return matrix;
  const ids = new Set(props.regulations.map((item) => item.id));
  return matrix.filter((row) => ids.has(row.regulation.id));
});

const legend: { key: CoverageCell['status']; hint: string }[] = [
  { key: 'accepted', hint: '当前基线证据已被接受' },
  { key: 'pending', hint: '已提交待审或被退回' },
  { key: 'outdated', hint: '基线变化，需重新测试' },
  { key: 'missing', hint: '未关联任何证据' }
];

const expanded = ref<Set<string>>(new Set());

function cellKey(regulationId: string, configuration: string) {
  return regulationId + '::' + configuration;
}
function toggleCell(cell: CoverageCell) {
  const key = cellKey(cell.regulationId, cell.configuration);
  if (expanded.value.has(key)) expanded.value.delete(key);
  else expanded.value.add(key);
}
function isOpen(cell: CoverageCell) {
  return expanded.value.has(cellKey(cell.regulationId, cell.configuration));
}

const rowBadge = (row: RegulationCoverageRow) =>
  row.status === 'complete'
    ? { label: '完整', color: 'green' as const }
    : row.status === 'outdated'
      ? { label: '版本过期', color: 'red' as const }
      : row.status === 'pending'
        ? { label: '待补', color: 'amber' as const }
        : { label: '未覆盖', color: 'gray' as const };
</script>

<template>
  <div class="border border-slate-200 bg-white">
    <div class="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-slate-200 px-4 py-3 text-xs text-slate-600">
      <span class="font-medium text-slate-800">当前软件基线 SW {{ project.softwareVersion }}</span>
      <span v-for="item in legend" :key="item.key" class="flex items-center gap-1.5">
        <span
          class="inline-block h-2.5 w-2.5 rounded-sm"
          :class="{
            'bg-green-500': item.key === 'accepted',
            'bg-amber-500': item.key === 'pending',
            'bg-red-500': item.key === 'outdated',
            'bg-slate-300': item.key === 'missing'
          }"
        />
        {{ coverageStatusLabels[item.key] }}
        <span class="text-slate-400">{{ item.hint }}</span>
      </span>
    </div>

    <div class="overflow-x-auto">
      <table class="data-table min-w-[860px]">
        <thead>
          <tr>
            <th class="min-w-[260px]">必选法规</th>
            <th v-for="configuration in project.configurations" :key="configuration" class="min-w-[180px]">
              {{ configuration }}
            </th>
            <th class="min-w-[110px]">覆盖</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.regulation.id">
            <td>
              <p class="flex flex-wrap items-center gap-2">
                <span class="font-mono text-sm">{{ row.regulation.code }}</span>
                <UBadge color="gray" variant="soft">{{ row.regulation.category }}</UBadge>
                <UBadge :color="rowBadge(row).color" variant="soft">{{ rowBadge(row).label }}</UBadge>
              </p>
              <p class="mt-1 text-sm text-slate-600">{{ row.regulation.title }}</p>
            </td>
            <td v-for="cell in row.cells" :key="cell.configuration">
              <button
                type="button"
                class="flex w-full flex-col items-start gap-1 border border-transparent px-2 py-2 text-left transition hover:border-slate-200 hover:bg-slate-50"
                @click="toggleCell(cell)"
              >
                <UBadge :color="coverageStatusColors[cell.status]" variant="soft">
                  {{ coverageStatusLabels[cell.status] }}
                </UBadge>
                <span class="line-clamp-2 text-xs text-slate-500">{{ cell.detail }}</span>
                <span class="text-[11px] text-teal-700">
                  {{ isOpen(cell) ? '收起证据' : '查看证据' }}
                </span>
              </button>
            </td>
            <td>
              <div class="flex items-center gap-2">
                <UProgress :value="row.coverage" size="xs" class="min-w-[60px]" />
                <span class="metric-value text-sm">{{ row.coverage }}%</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 单元格证据明细（含已取代历史，可追溯） -->
    <div class="space-y-3 border-t border-slate-200 bg-slate-50 p-4">
      <template v-for="row in rows" :key="'detail-' + row.regulation.id">
        <div
          v-for="cell in row.cells"
          :key="cellKey(row.regulation.id, cell.configuration)"
          v-show="isOpen(cell)"
          class="border border-slate-200 bg-white p-3"
        >
          <p class="flex flex-wrap items-center gap-2 text-sm font-medium">
            <span class="font-mono text-xs">{{ row.regulation.code }}</span>
            <span>{{ cell.configuration }}</span>
            <StatusBadge :status="cell.status" />
          </p>

          <div v-if="cell.current" class="mt-3 space-y-2">
            <div class="border-l-2 border-teal-600 pl-3">
              <p class="text-sm font-medium">
                {{ cell.current.name }}
                <span class="ml-1 text-xs text-slate-400">修订 R{{ cell.current.revision }}</span>
              </p>
              <p class="mt-1 text-xs text-slate-500">
                文件版本 {{ cell.current.version }} · 软件 {{ cell.current.softwareVersion }} ·
                <StatusBadge :status="cell.current.status" class="ml-1 align-middle" />
              </p>
              <p class="mt-1 text-xs text-slate-600">{{ cell.current.note }}</p>
            </div>

            <div v-if="cell.current.revisions.length > 1" class="pl-3">
              <p class="text-xs font-medium text-slate-500">修订链（旧版本可追溯，不覆盖历史）</p>
              <ol class="mt-1 list-inside list-decimal space-y-0.5 text-xs text-slate-500">
                <li
                  v-for="rev in [...cell.current.revisions].reverse()"
                  :key="rev.revision"
                  :class="cell.current && rev.revision === cell.current.revision ? 'font-medium text-slate-800' : ''"
                >
                  R{{ rev.revision }} · {{ rev.version }} / SW {{ rev.softwareVersion }} · {{ rev.createdAt.slice(0, 10) }}
                </li>
              </ol>
            </div>
          </div>
          <p v-else class="mt-2 text-sm text-slate-500">{{ cell.detail }}</p>
        </div>
      </template>

      <p v-if="!rows.length" class="py-6 text-center text-sm text-slate-500">该分类下暂无法规项。</p>
    </div>
  </div>
</template>
