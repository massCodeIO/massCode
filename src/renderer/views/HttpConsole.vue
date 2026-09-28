<script setup lang="ts">
import { i18n } from '@/electron'
</script>

<template>
  <div class="bg-background text-foreground flex h-full flex-col">
    <UiText
      as="div"
      variant="sm"
      weight="medium"
      class="shrink-0 border-b px-3 py-2"
    >
      {{ i18n.t("spaces.http.devtools.console") }}
    </UiText>
    <HttpDevtoolsConsole detached />
  </div>
</template>
