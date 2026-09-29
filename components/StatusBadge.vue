<script setup lang="ts">
import type { CoverageCellStatus, EvidenceStatus, ProjectStatus } from '~/types/certification';

defineProps<{
  status: ProjectStatus | EvidenceStatus | CoverageCellStatus;
}>();

const labels: Record<ProjectStatus | EvidenceStatus | CoverageCellStatus, string> = {
  draft: '草稿',
  submitted: '已提交',
  under_review: '审阅中',
  supplement_required: '待补件',
  approved: '已批准',
  rejected: '已拒绝',
  missing: '未覆盖',
  accepted: '已接受',
  resubmit: '需重交',
  pending: '待补',
  outdated: '版本过期'
};

const colors: Record<ProjectStatus | EvidenceStatus | CoverageCellStatus, 'gray' | 'blue' | 'amber' | 'green' | 'red'> = {
  draft: 'gray',
  submitted: 'blue',
  under_review: 'blue',
  supplement_required: 'amber',
  approved: 'green',
  rejected: 'red',
  missing: 'gray',
  accepted: 'green',
  resubmit: 'amber',
  pending: 'amber',
  outdated: 'red'
};
</script>

<template>
  <UBadge :color="colors[status]" variant="soft">{{ labels[status] }}</UBadge>
</template>
