<script setup lang="ts">
import { i18n } from '@/electron'

interface Props {
  title: string
}

defineProps<Props>()
</script>

<template>
  <div class="px-1">
    <div class="truncate px-1 pb-2 leading-5 font-bold select-none">
      {{ title }}
    </div>
    <UiText
      as="div"
      variant="caption"
      weight="bold"
      uppercase
      class="flex gap-1 pb-1 pl-1 select-none"
    >
      {{ i18n.t("common.library") }}
    </UiText>
  </div>
</template>
