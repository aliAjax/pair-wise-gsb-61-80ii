<script setup lang="ts">
import type { EvidenceItem, EvidenceStatus } from '~/types/certification';
import { latestRevision } from '~/services/coverage';

const props = defineProps<{
  evidence: EvidenceItem[];
  editable?: boolean;
  /** 法规 ID -> 编码/标题映射 */
  regulationLabel?: (id: string) => string;
}>();

const emit = defineEmits<{
  update: [evidenceId: string, status: EvidenceStatus];
}>();

const expanded = ref<string[]>([]);
const typeLabels: Record<EvidenceItem['revisions'][number]['type'], string> = {
  test_report: '测试报告',
  part_list: '部件清单',
  software_report: '软件报告',
  exemption: '豁免材料',
  certificate: '证书'
};

function toggle(id: string) {
  expanded.value = expanded.value.includes(id)
    ? expanded.value.filter((item) => item !== id)
    : [...expanded.value, id];
}

function formatDate(value: string) {
  return value.slice(0, 16).replace('T', ' ');
}

const actionStatus: { label: string; status: EvidenceStatus; color: 'green' | 'red' | 'amber' }[] = [
  { label: '接受', status: 'accepted', color: 'green' },
  { label: '拒绝', status: 'rejected', color: 'red' },
  { label: '重新抽样', status: 'resubmit', color: 'amber' }
];
</script>

<template>
  <div class="overflow-x-auto">
    <table class="data-table min-w-[1080px]">
      <thead>
        <tr>
          <th>证据文件 / 修订</th>
          <th>法规项</th>
          <th>当前文件 / 软件版本</th>
          <th>配置覆盖</th>
          <th>状态</th>
          <th>审阅说明</th>
          <th v-if="editable">操作</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="item in evidence" :key="item.id">
          <tr>
            <td>
              <p class="font-medium">{{ latestRevision(item)?.name }}</p>
              <p class="mt-1 text-xs text-slate-500">
                {{ typeLabels[latestRevision(item)?.type ?? 'test_report'] }} · {{ item.id }}
              </p>
              <button
                type="button"
                class="mt-1 text-xs font-medium text-teal-700 hover:underline"
                @click="toggle(item.id)"
              >
                修订历史（{{ item.revisions.length }}）{{ expanded.includes(item.id) ? ' · 收起' : ' · 展开' }}
              </button>
            </td>
            <td class="font-mono text-sm">{{ regulationLabel ? regulationLabel(item.regulationId) : item.regulationId }}</td>
            <td>
              <p>文件 {{ latestRevision(item)?.version }} <span class="text-xs text-slate-400">v{{ latestRevision(item)?.revision }}</span></p>
              <p class="mt-1 text-xs text-slate-500">软件 {{ latestRevision(item)?.softwareVersion }}</p>
            </td>
            <td class="max-w-[240px] text-sm">{{ latestRevision(item)?.configurations.join('、') }}</td>
            <td><StatusBadge :status="latestRevision(item)?.status ?? 'missing'" /></td>
            <td class="max-w-[300px] text-sm text-slate-600">{{ latestRevision(item)?.note }}</td>
            <td v-if="editable">
              <div class="flex min-w-[200px] flex-wrap gap-2">
                <UButton
                  v-for="action in actionStatus"
                  :key="action.status"
                  size="xs"
                  :color="action.color"
                  variant="soft"
                  @click="emit('update', item.id, action.status)"
                >
                  {{ action.label }}
                </UButton>
              </div>
            </td>
          </tr>
          <tr v-if="expanded.includes(item.id)">
            <td :colspan="editable ? 7 : 6" class="bg-slate-50 p-0">
              <div class="border-l-2 border-teal-600 p-4">
                <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">修订链（新修订追加，不覆盖历史）</p>
                <ol class="space-y-3">
                  <li
                    v-for="revision in [...item.revisions].reverse()"
                    :key="revision.id"
                    class="border border-slate-200 bg-white p-3"
                  >
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <p class="text-sm font-medium">
                        修订 v{{ revision.revision }} · 文件 {{ revision.version }} · SW {{ revision.softwareVersion }}
                        <UBadge v-if="revision.generatedBySupplement" color="teal" variant="soft" class="ml-1">补件生成</UBadge>
                      </p>
                      <StatusBadge :status="revision.status" />
                    </div>
                    <p class="mt-2 text-sm text-slate-600">{{ revision.note }}</p>
                    <p class="mt-2 text-xs text-slate-500">
                      覆盖配置：{{ revision.configurations.join('、') }} · {{ formatDate(revision.updatedAt) }}
                      <template v-if="revision.updatedBy"> · {{ revision.updatedBy }}</template>
                      <template v-if="revision.expiryDate"> · 到期 {{ revision.expiryDate }}</template>
                    </p>
                  </li>
                </ol>
              </div>
            </td>
          </tr>
        </template>
        <tr v-if="!evidence.length">
          <td :colspan="editable ? 7 : 6" class="py-12 text-center text-slate-500">当前项目尚未关联证据。</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
