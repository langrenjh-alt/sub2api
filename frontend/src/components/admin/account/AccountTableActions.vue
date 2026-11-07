<template>
  <div class="flex flex-wrap items-center gap-3">
    <slot name="before"></slot>
    <ShButton variant="outline" @click="$emit('refresh')" :disabled="loading" class="btn btn-secondary">
      <Icon name="refresh" size="md" :class="[loading ? 'animate-spin' : '']" />
    </ShButton>
    <slot name="after"></slot>
    <slot name="beforeCreate"></slot>
    <ShButton variant="default" @click="$emit('create')" class="btn btn-primary">{{ t('admin.accounts.createAccount') }}</ShButton>
    <slot name="afterCreate"></slot>
  </div>
</template>

<script setup lang="ts">
import { Button as ShButton } from "@/components/ui/button"
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'

defineProps(['loading'])
defineEmits(['refresh', 'create'])

const { t } = useI18n()
</script>
