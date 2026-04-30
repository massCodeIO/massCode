<script setup lang="ts">
import { useApp } from '@/composables'
import { i18n } from '@/electron'

const { isAppLoading } = useApp()

onMounted(() => {
  isAppLoading.value = false
})
</script>

<template>
  <div class="flex h-screen items-center justify-center">
    <UiText class="text-muted-foreground">
      {{ i18n.t("spaces.http.title") }}
    </UiText>
  </div>
</template>
