<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  PaginationRoot,
  PaginationList,
  PaginationListItem,
  PaginationEllipsis,
} from "reka-ui";
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import GroupSelect from "./GroupSelect.vue";
import {
  getConfiguredTablePageSizeOptions,
  normalizeTablePageSize,
} from "@/utils/tablePreferences";
import { setPersistedPageSize } from "@/composables/usePersistedPageSize";
const props = defineProps<{ page: number; total: number; pageSize: number }>();
const emit = defineEmits<{
  "update:page": [value: number];
  "update:pageSize": [value: number];
}>();
const { t } = useI18n();
const opts = computed(() =>
  [...new Set([...getConfiguredTablePageSizeOptions(), props.pageSize])]
    .sort((a, b) => a - b)
    .map((value) => ({ value, label: String(value) })),
);
function size(n: number) {
  setPersistedPageSize(normalizeTablePageSize(n));
  emit("update:pageSize", n);
}
</script>
<template>
  <div
    class="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"
  >
    <div class="flex items-center gap-3">
      <span
        >{{ t("pagination.showing") }} {{ (page - 1) * pageSize + 1 }}–{{
          Math.min(page * pageSize, total)
        }}
        {{ t("pagination.of") }} {{ total }}</span
      >
      <GroupSelect
        class="w-[5rem]"
        :label="t('pagination.perPage')"
        :model-value="pageSize"
        :options="opts"
        @change="size"
      />
    </div>
    <PaginationRoot
      :page="page"
      :total="total"
      :items-per-page="pageSize"
      :sibling-count="1"
      show-edges
      @update:page="emit('update:page', $event)"
    >
      <PaginationList v-slot="{ items }" class="flex items-center gap-1">
        <Button
          size="icon-sm"
          variant="outline"
          :disabled="page <= 1"
          :aria-label="t('pagination.previous')"
          @click="emit('update:page', page - 1)"
          ><ChevronLeft
        /></Button>
        <template v-for="(item, i) in items" :key="i"
          ><PaginationListItem
            v-if="item.type === 'page'"
            :value="item.value"
            as-child
            ><Button
              size="icon-sm"
              :variant="item.value === page ? 'outline' : 'ghost'"
              :aria-label="t('pagination.goToPage', { page: item.value })"
              >{{ item.value }}</Button
            ></PaginationListItem
          ><PaginationEllipsis v-else :index="i"
            >…</PaginationEllipsis
          ></template
        >
        <Button
          size="icon-sm"
          variant="outline"
          :disabled="page * pageSize >= total"
          :aria-label="t('pagination.next')"
          @click="emit('update:page', page + 1)"
          ><ChevronRight
        /></Button>
      </PaginationList>
    </PaginationRoot>
  </div>
</template>
