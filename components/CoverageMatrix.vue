<script setup lang="ts">
import { computed } from 'vue';
import type { CoverageCell, RegulationItem } from '~/types/certification';
import { coverageStateColors, coverageStateLabels } from '~/services/coverage';

const props = defineProps<{
  regulations: RegulationItem[];
  configurations: string[];
  cells: CoverageCell[];
  baseline: string;
  /** 允许勾选待补 / 过期单元格用于批量补件 */
  selectable?: boolean;
  selected?: string[];
}>();

const emit = defineEmits<{
  toggle: [key: string];
}>();

function cellKey(cell: CoverageCell) {
  return `${cell.regulationId}@@${cell.configuration}`;
}

interface MatrixRow {
  regulation: RegulationItem;
  cells: CoverageCell[];
  accepted: number;
  stale: number;
  pending: number;
  total: number;
  badge: { label: string; color: 'green' | 'red' | 'amber' };
}

const rows = computed<MatrixRow[]>(() =>
  props.regulations.map((regulation) => {
    const cells = props.configurations.map(
      (configuration) =>
        props.cells.find((cell) => cell.regulationId === regulation.id && cell.configuration === configuration)!
    );
    const accepted = cells.filter((cell) => cell?.state === 'accepted').length;
    const stale = cells.filter((cell) => cell?.state === 'stale').length;
    const pending = cells.filter((cell) => cell?.state === 'pending').length;
    const total = cells.length;
    const badge =
      accepted === total
        ? { label: '全部已接受', color: 'green' as const }
        : stale > 0
          ? { label: `${stale} 个版本过期`, color: 'red' as const }
          : { label: `${pending} 个待补`, color: 'amber' as const };
    return { regulation, cells, accepted, stale, pending, total, badge };
  })
);
</script>

<template>
  <div class="overflow-x-auto border border-slate-200 bg-white">
    <table class="data-table min-w-[860px]">
      <thead>
        <tr>
          <th class="min-w-[240px]">必选法规 / 申报配置</th>
          <th v-for="configuration in configurations" :key="configuration" class="min-w-[230px]">
            {{ configuration }}
          </th>
          <th class="min-w-[130px]">覆盖小计</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.regulation.id">
          <td>
            <p class="font-mono text-xs text-slate-500">{{ row.regulation.code }}</p>
            <p class="mt-1 text-sm font-medium">{{ row.regulation.title }}</p>
            <div class="mt-2 flex items-center gap-2">
              <UBadge color="gray" variant="soft">{{ row.regulation.category }}</UBadge>
              <UBadge v-if="!row.regulation.required" color="gray" variant="outline">非必选</UBadge>
            </div>
          </td>
          <td v-for="cell in row.cells" :key="cell.configuration" class="align-top">
            <div
              class="coverage-cell h-full border p-3"
              :class="{
                'border-green-300 bg-green-50': cell.state === 'accepted',
                'border-amber-300 bg-amber-50': cell.state === 'pending',
                'border-red-300 bg-red-50': cell.state === 'stale'
              }"
            >
              <div class="flex items-center justify-between gap-2">
                <UBadge :color="coverageStateColors[cell.state]" variant="soft">
                  {{ coverageStateLabels[cell.state] }}
                </UBadge>
                <label
                  v-if="selectable && cell.state !== 'accepted'"
                  class="flex cursor-pointer items-center gap-1 text-xs text-slate-600"
                >
                  <input
                    type="checkbox"
                    :checked="selected?.includes(cellKey(cell))"
                    @change="emit('toggle', cellKey(cell))"
                  />
                  补件
                </label>
              </div>

              <p v-if="cell.revision" class="mt-2 text-xs text-slate-700">{{ cell.revision.name }}</p>
              <p v-if="cell.revision" class="mt-1 text-[11px] text-slate-500">
                文件 {{ cell.revision.version }} · SW {{ cell.revision.softwareVersion }}
                <span v-if="cell.revision.generatedBySupplement" class="text-teal-700">· 补件修订</span>
              </p>

              <p
                v-if="cell.state === 'stale' && cell.acceptedRevision"
                class="mt-2 border-t border-red-200 pt-2 text-[11px] text-red-800"
              >
                历史接受：{{ cell.acceptedRevision.version }}（SW {{ cell.acceptedRevision.softwareVersion }}），旧报告仍可追溯
              </p>

              <p
                class="mt-2 text-[11px] leading-5"
                :class="cell.state === 'accepted' ? 'text-green-800' : cell.state === 'stale' ? 'text-red-800' : 'text-amber-900'"
              >
                {{ cell.note }}
              </p>
            </div>
          </td>
          <td>
            <UBadge :color="row.badge.color" variant="soft">{{ row.badge.label }}</UBadge>
            <p class="metric-value mt-2 text-sm text-slate-600">{{ row.accepted }}/{{ row.total }}</p>
          </td>
        </tr>
      </tbody>
    </table>
    <p class="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
      当前软件基线：SW {{ baseline }}。基线变化只让命中的法规 × 配置单元格失效，未受影响单元格保持已接受，旧报告与文件版本保留可追溯。
    </p>
  </div>
</template>
