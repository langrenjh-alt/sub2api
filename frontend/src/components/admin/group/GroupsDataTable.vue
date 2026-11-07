<script setup lang="ts">
import { TableCell as ShTableCell } from "@/components/ui/table"
import { computed, ref, watch, type ComponentPublicInstance } from "vue";
import { getCoreRowModel, useVueTable } from "@tanstack/vue-table";
import { useVirtualizer } from "@tanstack/vue-virtual";
import { useMediaQuery } from "@vueuse/core";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import type { AdminGroup } from "@/types";
import type { Column } from "@/components/common/types";
const props = defineProps<{
  columns: Column[];
  data: AdminGroup[];
  loading: boolean;
  sortKey: string;
  sortOrder: "asc" | "desc";
}>();
const emit = defineEmits<{ sort: [key: string, order: "asc" | "desc"] }>();
const table = useVueTable({
  get data() {
    return props.data;
  },
  get columns() {
    return props.columns.map((c) => ({
      id: c.key,
      accessorFn: (row: AdminGroup) => Reflect.get(row, c.key),
      enableSorting: c.sortable === true,
    }));
  },
  getRowId: (r) => String(r.id),
  getCoreRowModel: getCoreRowModel(),
  manualSorting: true,
  manualFiltering: true,
  manualPagination: true,
});
const rows = computed(() => table.getRowModel().rows);
const desktop = useMediaQuery("(min-width: 1024px)");
const frame = ref<HTMLElement>();
const scrollEl = () => frame.value?.firstElementChild as HTMLElement | null;
const large = computed(
  () => desktop.value && !props.loading && rows.value.length > 100,
);
const virt = useVirtualizer(
  computed(() => ({
    count: large.value ? rows.value.length : 0,
    getScrollElement: scrollEl,
    estimateSize: () => 78,
    overscan: 8,
    getItemKey: (i: number) => rows.value[i]?.id ?? i,
  })),
);
const items = computed(() => virt.value.getVirtualItems());
const rendered = computed(() =>
  large.value && items.value.length
    ? items.value.map((i) => rows.value[i.index])
    : rows.value,
);
const top = computed(() => (large.value ? (items.value[0]?.start ?? 0) : 0));
const bottom = computed(() =>
  large.value && items.value.length
    ? virt.value.getTotalSize() - items.value.at(-1)!.end
    : 0,
);
function measure(el: Element | ComponentPublicInstance | null) {
  if (large.value && el && "$el" in el) virt.value.measureElement(el.$el);
}
watch(
  () => props.data,
  () => {
    const el = scrollEl();
    if (el) el.scrollTop = 0;
    virt.value.measure();
  },
  { flush: "post" },
);
function sort(k: string) {
  emit(
    "sort",
    k,
    k === props.sortKey && props.sortOrder === "asc" ? "desc" : "asc",
  );
}
</script>
<template>
  <div
    v-if="desktop"
    ref="frame"
    class="group-grid min-h-0 overflow-hidden rounded-md border bg-card"
    data-testid="groups-table"
  >
    <Table class="min-w-max"
      ><TableHeader class="sticky top-0 z-20 bg-card"
        ><TableRow class="hover:bg-transparent">
          <TableHead
            v-for="c in columns"
            :key="c.key"
            :class="[
              c.key === 'actions' && 'sticky right-0 z-10 border-l bg-card',
              c.key === 'name' && 'sticky left-0 z-10 bg-card',
            ]"
            :aria-sort="
              !c.sortable
                ? undefined
                : sortKey !== c.key
                  ? 'none'
                  : sortOrder === 'asc'
                    ? 'ascending'
                    : 'descending'
            "
          >
            <Button
              v-if="c.sortable"
              variant="ghost"
              size="sm"
              class="-ml-2"
              @click="sort(c.key)"
              >{{ c.label
              }}<component
                :is="
                  sortKey !== c.key
                    ? ArrowUpDown
                    : sortOrder === 'asc'
                      ? ArrowUp
                      : ArrowDown
                "
                class="size-3.5 opacity-60"
            /></Button>
            <template v-else>{{ c.label }}</template>
          </TableHead></TableRow
        ></TableHeader
      >
      <TableBody
        ><template v-if="loading"
          ><TableRow v-for="n in 5" :key="n"
            ><TableCell v-for="c in columns" :key="c.key"
              ><div
                class="h-4 w-16 animate-pulse rounded bg-muted" /></TableCell></TableRow
        ></template>
        <TableRow v-else-if="!rows.length"
          ><TableCell :colspan="columns.length" class="p-12 text-center"
            ><slot name="empty" /></TableCell
        ></TableRow>
        <template v-else>
          <tr v-if="top" aria-hidden="true">
            <ShTableCell :colspan="columns.length" :style="{ height: top + 'px' }" />
          </tr>
          <TableRow
            v-for="r in rendered"
            :key="r.id"
            :ref="measure"
            :data-index="r.index"
            :data-row-id="r.id"
          >
            <TableCell
              v-for="cell in r.getVisibleCells()"
              :key="cell.id"
              class="whitespace-nowrap px-3 py-3"
              :class="[
                cell.column.id === 'name' &&
                  'sticky left-0 bg-card font-medium',
                cell.column.id === 'actions' &&
                  'sticky right-0 border-l bg-card',
              ]"
            >
              <slot
                :name="'cell-' + cell.column.id"
                :row="r.original"
                :value="cell.getValue()"
                >{{ cell.getValue() }}</slot
              >
            </TableCell></TableRow
          >
          <tr v-if="bottom" aria-hidden="true">
            <ShTableCell :colspan="columns.length" :style="{ height: bottom + 'px' }" />
          </tr> </template></TableBody
    ></Table>
  </div>
  <div v-else class="space-y-3" data-testid="groups-mobile">
    <div v-if="loading" class="h-28 animate-pulse rounded-lg bg-muted" />
    <Card v-else-if="!rows.length" class="p-6 text-center shadow-none"
      ><slot name="empty"
    /></Card>
    <template v-else
      ><Card v-for="r in rows" :key="r.id" class="space-y-3 p-4 shadow-none">
        <div
          v-for="c in columns"
          :key="c.key"
          class="flex items-start justify-between gap-4 text-sm"
        >
          <span class="text-muted-foreground">{{ c.label }}</span
          ><slot
            :name="'cell-' + c.key"
            :row="r.original"
            :value="r.getValue(c.key)"
            >{{ r.getValue(c.key) }}</slot
          >
        </div>
      </Card></template
    >
  </div>
</template>
<style scoped>
.group-grid > :deep(.overflow-auto) {
  max-height: calc(100dvh - 280px);
  min-height: 110px;
  scrollbar-gutter: stable;
}
.group-grid :deep(th) {
  white-space: nowrap;
}
</style>
