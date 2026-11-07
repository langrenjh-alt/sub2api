<template>
  <div class="w-full">
    <label v-if="label" :for="fieldId" class="input-label mb-1.5 block">
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
    </label>
    <div class="relative">
      <!-- Prefix Icon Slot -->
      <div
        v-if="$slots.prefix"
        class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 dark:text-dark-400"
      >
        <slot name="prefix"></slot>
      </div>

      <UiInput
        :id="fieldId"
        :aria-invalid="Boolean(error)"
        :aria-describedby="error || hint ? fieldId + '-description' : undefined"
        ref="inputRef"
        :type="type"
        :model-value="modelValue ?? ''"
        :disabled="disabled"
        :required="required"
        :placeholder="placeholderText"
        :autocomplete="autocomplete"
        :readonly="readonly"
        :class="[
          'w-full',
          $slots.prefix ? 'pl-11' : '',
          $slots.suffix ? 'pr-11' : '',
          error ? 'input-error' : '',
          disabled ? 'cursor-not-allowed opacity-60' : ''
        ]"
        @update:model-value="$emit('update:modelValue', String($event))"
        @change="$emit('change', ($event.target as HTMLInputElement).value)"
        @blur="$emit('blur', $event)"
        @focus="$emit('focus', $event)"
        @keyup.enter="$emit('enter', $event)"
      />

      <!-- Suffix Slot (e.g. Password Toggle or Clear Button) -->
      <div
        v-if="$slots.suffix"
        class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 dark:text-dark-400"
      >
        <slot name="suffix"></slot>
      </div>
    </div>
    <!-- Hint / Error Text -->
    <p v-if="error" :id="fieldId + '-description'" class="input-error-text mt-1.5">
      {{ error }}
    </p>
    <p v-else-if="hint" :id="fieldId + '-description'" class="input-hint mt-1.5">
      {{ hint }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { Input as UiInput } from '@/components/ui/input'

interface Props {
  modelValue: string | number | null | undefined
  type?: string
  label?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  readonly?: boolean
  error?: string
  hint?: string
  id?: string
  autocomplete?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  disabled: false,
  required: false,
  readonly: false
})

defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
  (e: 'blur', event: FocusEvent): void
  (e: 'focus', event: FocusEvent): void
  (e: 'enter', event: KeyboardEvent): void
}>()

const generatedId = useId()
const fieldId = computed(() => props.id || generatedId)
const inputRef = ref<InstanceType<typeof UiInput> | null>(null)
const placeholderText = computed(() => props.placeholder || '')

// Expose focus method
defineExpose({
  focus: () => inputRef.value?.focus(),
  select: () => inputRef.value?.select()
})
</script>
