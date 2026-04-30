<script setup lang="ts">
import { i18n } from '@/electron'
</script>

<template>
  <div class="bg-sidebar h-full overflow-hidden">
    <div class="flex h-full flex-col">
      <div class="border-border flex h-9 shrink-0 items-center border-b px-3">
        <UiText class="text-muted-foreground text-xs">
          {{ i18n.t("spaces.http.title") }}
        </UiText>
      </div>
      <div class="flex-1 overflow-auto p-2">
        <UiText class="text-muted-foreground text-xs">
          TODO: collections + requests
        </UiText>
      </div>
    </div>
  </div>
</template>
