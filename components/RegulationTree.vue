<script setup lang="ts">
import type { ApprovalProject } from '~/types/certification';
import { buildCoverageMatrix, coverageStateColors, coverageStateLabels } from '~/services/coverage';

const props = defineProps<{
  project: ApprovalProject;
  category?: string;
}>();

const matrix = computed(() => buildCoverageMatrix(props.project));
const regulations = computed(() =>
  props.category && props.category !== '全部'
    ? matrix.value.regulations.filter((item) => item.category === props.category)
    : matrix.value.regulations
);

const expanded = ref<string[]>([]);
watchEffect(() => {
  if (!expanded.value.length) expanded.value = regulations.value.map((item) => item.id);
});

function toggle(id: string) {
  expanded.value = expanded.value.includes(id)
    ? expanded.value.filter((item) => item !== id)
    : [...expanded.value, id];
}

function rowOf(regulationId: string) {
  return matrix.value.cells.filter((cell) => cell.regulationId === regulationId);
}
</script>

<template>
  <div class="divide-y divide-slate-200 border-y border-slate-200 bg-white">
    <section v-for="regulation in regulations" :key="regulation.id">
      <button
        type="button"
        class="flex w-full items-start justify-between gap-4 px-4 py-4 text-left hover:bg-slate-50"
        @click="toggle(regulation.id)"
      >
        <span class="min-w-0">
          <span class="flex flex-wrap items-center gap-2">
            <strong class="font-mono text-sm">{{ regulation.code }}</strong>
            <UBadge color="gray" variant="soft">{{ regulation.category }}</UBadge>
          </span>
          <span class="mt-1 block text-sm font-medium text-slate-800">{{ regulation.title }}</span>
        </span>
        <span class="shrink-0 text-sm text-slate-500">{{ expanded.includes(regulation.id) ? '收起' : '展开' }}</span>
      </button>

      <div v-if="expanded.includes(regulation.id)" class="border-t border-slate-100 bg-slate-50 px-4 py-4">
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="cell in rowOf(regulation.id)"
            :key="cell.configuration"
            class="border bg-white p-3"
            :class="{
              'border-green-300': cell.state === 'accepted',
              'border-amber-300': cell.state === 'pending',
              'border-red-300': cell.state === 'stale'
            }"
          >
            <div class="flex items-center justify-between gap-2">
              <p class="text-sm font-medium">{{ cell.configuration }}</p>
              <UBadge :color="coverageStateColors[cell.state]" variant="soft">{{ coverageStateLabels[cell.state] }}</UBadge>
            </div>
            <p v-if="cell.revision" class="mt-2 text-xs text-slate-600">
              {{ cell.revision.name }} · {{ cell.revision.version }} · SW {{ cell.revision.softwareVersion }}
            </p>
            <p v-if="cell.state === 'stale' && cell.acceptedRevision" class="mt-1 text-[11px] text-red-700">
              旧报告 {{ cell.acceptedRevision.version }}（SW {{ cell.acceptedRevision.softwareVersion }}）可追溯
            </p>
            <p class="mt-2 text-[11px] leading-5 text-slate-500">{{ cell.note }}</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
