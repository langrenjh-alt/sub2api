<script setup lang="ts" generic="T extends string | number | null">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Check, ChevronsUpDown } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<{
  modelValue?: T;
  options: readonly { value: T; label: string; disabled?: boolean }[];
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  searchable?: boolean;
  clearable?: boolean;
  error?:boolean;
  ariaLabel?:string;
}>(), {searchable: true});
const emit = defineEmits<{
  "update:modelValue": [value: T];
  change: [value: T];
}>();
const { t } = useI18n();
const open = ref(false);
// Reka reserves the empty string. Keep null, numbers and the "all" option distinct.
const key = (v: T | undefined) => typeof v + ":" + String(v);
const current = computed(() =>
  props.options.find((o) => o.value === props.modelValue),
);
function pick(k: unknown) {
  const o = props.options.find((o) => key(o.value) === k);
  if (k === '__clear' && props.clearable) {
    // The existing reasoning-policy handlers use null to mean "no override".
    emit("update:modelValue", null as T); emit("change", null as T); open.value=false; return
  }
  if (!o || o.disabled) return;
  emit("update:modelValue", o.value);
  emit("change", o.value);
  open.value = false;
}
</script>
<template>
  <Popover v-if="searchable !== false && options.length > 5" v-model:open="open">
    <PopoverTrigger as-child
      ><Button
        type="button"
        variant="outline"
        v-bind="$attrs"
        class="h-9 w-full justify-between font-normal"
        :disabled="disabled"
        role="combobox"
        :aria-invalid="error || undefined" :aria-label="ariaLabel || label || placeholder || current?.label"
        :aria-expanded="open"
      >
        <span class="truncate">{{ current?.label || placeholder }}</span
        ><ChevronsUpDown class="size-4 opacity-50" /> </Button
    ></PopoverTrigger>
    <PopoverContent
      align="start"
      class="w-[var(--reka-popover-trigger-width)] min-w-44 p-0"
    >
      <Command
        ><CommandInput
          :placeholder="t('common.search')"
          :aria-label="t('common.search')" /><CommandList>
          <CommandEmpty>{{ t("empty.noData") }}</CommandEmpty
          ><CommandGroup>
            <CommandItem
              v-for="o in options"
              :key="key(o.value)"
              :value="key(o.value)"
              :disabled="o.disabled"
              @select="pick(key(o.value))"
              >{{ o.label
              }}<Check
                class="ml-auto size-4"
                :class="o.value !== modelValue && 'invisible'"
            /></CommandItem> </CommandGroup></CommandList
      ></Command>
    </PopoverContent>
  </Popover>
  <Select
    v-else
    :model-value="current ? key(modelValue) : undefined"
    :disabled="disabled"
    @update:model-value="pick"
  >
    <SelectTrigger
      v-bind="$attrs"
      class="h-9"
      :aria-invalid="error || undefined" :aria-label="ariaLabel || label || placeholder || current?.label"
      ><SelectValue :placeholder="placeholder"
    /></SelectTrigger>
    <SelectContent
      ><SelectItem v-if="clearable" value="__clear">{{placeholder || t("common.reset")}}</SelectItem>
      <SelectItem
        v-for="o in options"
        :key="key(o.value)"
        :value="key(o.value)"
        :disabled="o.disabled"
        >{{ o.label }}</SelectItem
      ></SelectContent
    >
  </Select>
</template>
