<script setup lang="ts">
import { i18n } from '@/electron'

interface Props {
  title: string
}

defineProps<Props>()
</script>

<template>
  <div class="px-1">
    <div class="truncate px-1 pb-2 font-bold leading-5 select-none">
      {{ title }}
    </div>
    <UiText
      as="div"
      variant="caption"
      weight="bold"
      uppercase
      class="flex gap-1 pb-1 pl-1 select-none"
    >
      {{ i18n.t("sidebar.library") }}
    </UiText>
  </div>
</template>
