<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { computed, ref } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  defaultValue?: string | number
  modelValue?: string | number | null
  class?: HTMLAttributes["class"]
}>()

const emits = defineEmits<{
  (e: "update:modelValue", payload: string | number): void
}>()

// Update the parent synchronously: autocomplete handlers read its model in
// the same native input event. Preserve raw number and composition semantics.
const localValue = ref(props.defaultValue ?? "")
const modelValue = computed({
  get: () => props.modelValue === undefined ? localValue.value : (props.modelValue ?? ""),
  set: (value: string | number) => { localValue.value = value; emits("update:modelValue", value) },
})
// Legacy form fields expose these native operations to callers.
const input = ref<HTMLInputElement>()
defineExpose({
  focus: () => input.value?.focus(),
  select: () => input.value?.select(),
})
</script>

<template>
  <input ref="input" v-model="modelValue" :class="cn('flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50', props.class)">
</template>
