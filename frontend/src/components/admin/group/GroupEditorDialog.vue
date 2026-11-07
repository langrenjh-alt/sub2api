<script setup lang="ts">
import { ref, watch } from "vue";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import { useI18n } from "vue-i18n";
import { Button } from "@/components/ui/button";
const { t } = useI18n();
const body = ref<HTMLElement>();
const sections = ["details", "billing", "access"] as const;
const active = ref<string>("details");
function jump(k: string) {
  const panel = body.value;
  const h = panel?.querySelector('[data-editor-section="' + k + '"]');
  if (panel && h)
    panel.scrollTop +=
      h.getBoundingClientRect().top - panel.getBoundingClientRect().top - 16;
}
function sync() {
  const panel = body.value;
  if (!panel) return;
  active.value = "details";
  for (const h of panel.querySelectorAll<HTMLElement>(
    "[data-editor-section]",
  )) {
    if (h.getBoundingClientRect().top <= panel.getBoundingClientRect().top + 20)
      active.value = h.dataset.editorSection!;
  }
}
const props = defineProps<{
  show: boolean;
  title: string;
  description: string;
  advanced: boolean;
}>();
const emit = defineEmits<{ close: [] }>();
let trigger: HTMLElement | null = null;
watch(
  () => props.show,
  (on) => {
    if (on) active.value = "details";
    if (on && document.activeElement instanceof HTMLElement)
      trigger = document.activeElement;
  },
  { flush: "sync" },
);
function restore(e: Event) {
  e.preventDefault();
  if (trigger?.isConnected) trigger.focus({ preventScroll: true });
}
</script>
<template>
  <Dialog
    :open="show"
    @update:open="
      (v) => {
        if (!v) emit('close');
      }
    "
  >
    <DialogContent
      class="group-editor flex max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden rounded-lg bg-card p-0"
      @pointer-down-outside.prevent
      @close-auto-focus="restore"
    >
      <DialogHeader class="shrink-0 border-b px-5 py-4 text-left sm:px-6"
        ><DialogTitle>{{ title }}</DialogTitle
        ><DialogDescription>{{ description }}</DialogDescription></DialogHeader
      >
      <nav v-if="advanced" class="flex shrink-0 gap-1 overflow-x-auto border-b px-4 py-2">
        <Button
          v-for="k in sections"
          :key="k"
          size="sm"
          :variant="active === k ? 'secondary' : 'ghost'"
          @click="jump(k)"
          >{{ t("admin.groups.editorSections." + k) }}</Button
        >
      </nav>
      <div
        ref="body"
        @scroll.passive="sync"
        class="min-h-0 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6"
      >
        <slot />
      </div>
      <DialogFooter class="shrink-0 border-t bg-card px-5 py-3 sm:px-6"
        ><slot name="footer"
      /></DialogFooter>
    </DialogContent>
  </Dialog>
</template>
<style scoped>
.group-editor :deep(.input) {
  @apply rounded-md border-input bg-transparent px-3 py-1.5 text-sm shadow-sm focus:border-input focus:ring-2 focus:ring-ring;
}
.group-editor :deep(.input-label) {
  @apply text-sm font-medium text-foreground;
}
.group-editor :deep(.input-hint) {
  @apply text-xs text-muted-foreground;
}
.group-editor :deep(.editor-section) {
  @apply text-base font-semibold tracking-tight;
}
</style>
