<script setup lang="ts">
import { i18n } from '@/electron'
import { ArrowLeft } from 'lucide-vue-next'
import { computed } from 'vue'

interface Props {
  title: string
  leftSize?: string
  rightSize?: string
}

interface Emits {
  (e: 'back'): void
}

const props = withDefaults(defineProps<Props>(), {
  leftSize: '220px',
  rightSize: '1fr',
})

const emit = defineEmits<Emits>()

const gridTemplateColumns = computed(() => {
  return `${props.leftSize} 1px ${props.rightSize}`
})
</script>

<template>
  <div
    class="relative grid h-screen flex-1 overflow-hidden"
    :style="{ gridTemplateColumns }"
  >
    <div class="grid h-full grid-rows-[auto_1fr] overflow-hidden">
      <div
        class="mt-2 flex items-center justify-between gap-2 overflow-hidden px-2 pt-[var(--title-bar-height)] pb-2"
      >
        <div class="truncate font-bold">
          {{ title }}
        </div>
        <UiActionButton
          :tooltip="i18n.t('button.back')"
          class="shrink-0"
          @click="() => emit('back')"
        >
          <ArrowLeft class="h-4 w-4" />
        </UiActionButton>
      </div>
      <div class="h-full overflow-auto">
        <slot name="left" />
      </div>
    </div>
    <div class="bg-border" />
    <div class="mt-2 h-full overflow-auto pt-[var(--title-bar-height)]">
      <slot name="right" />
    </div>
  </div>
</template>
