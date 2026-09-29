<script setup lang="ts">
import { regulationCatalog } from '~/data/seed';
import { useCertificationStore } from '~/stores/certification';

const store = useCertificationStore();
const selectedCategory = ref('全部');
const selectedProjectId = ref('TA-2026-118');

const categories = computed(() => ['全部', ...Array.from(new Set(regulationCatalog.map((item) => item.category)))]);
const selectedProject = computed(() => store.projectById(selectedProjectId.value));
const projectOptions = computed(() => store.projects.map((project) => ({ label: `${project.id} · ${project.name}`, value: project.id })));

onMounted(() => {
  store.hydrate();
});
</script>

<template>
  <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold">法规项目树</h1>
      <p class="mt-1 text-sm text-slate-600">按分类逐配置查看覆盖单元格：已接受、待补、版本过期及旧报告追溯。</p>
    </div>
    <div class="min-w-[320px]">
      <UFormGroup label="查看认证项目">
        <USelect v-model="selectedProjectId" :options="projectOptions" />
      </UFormGroup>
    </div>
  </div>

  <div class="mb-5 flex flex-wrap gap-2">
    <UButton
      v-for="category in categories"
      :key="category"
      size="xs"
      :variant="selectedCategory === category ? 'solid' : 'soft'"
      :color="selectedCategory === category ? 'primary' : 'gray'"
      @click="selectedCategory = category"
    >
      {{ category }}
    </UButton>
  </div>

  <RegulationTree v-if="selectedProject" :project="selectedProject" :category="selectedCategory" />
  <div v-else class="border border-red-200 bg-red-50 p-6 text-red-900">未找到所选认证项目。</div>
</template>
