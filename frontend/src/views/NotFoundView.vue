<template>
  <main class="grid min-h-screen place-items-center bg-background px-6 py-12 text-foreground">
    <section class="w-full max-w-lg border-y border-border py-8 sm:py-12">
      <div class="mb-10 flex items-center justify-between">
        <RouterLink to="/home" :aria-label="t('common.gatewayHome')">
          <img src="/logo.svg" alt="" class="size-12" />
        </RouterLink>
        <span class="font-mono text-sm text-muted-foreground">HTTP / 404</span>
      </div>
      <div aria-hidden="true" class="text-8xl font-semibold leading-none tracking-tighter sm:text-9xl">404</div>
      <h1 class="mt-5 text-2xl font-semibold">{{ t('common.pageNotFound') }}</h1>
      <p class="mt-3 text-muted-foreground">{{ t('common.pageNotFoundDescription') }}</p>
      <div class="mt-8 flex flex-wrap gap-3">
        <Button as-child>
          <RouterLink to="/home">{{ t('common.gatewayHome') }}</RouterLink>
        </Button>
        <Button v-if="canGoBack" variant="outline" type="button" @click="router.back()">
          {{ t('common.back') }}
        </Button>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'

const { t } = useI18n()
const router = useRouter()
const canGoBack = Boolean(router.options.history.state.back)
</script>
