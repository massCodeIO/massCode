<script setup lang="ts">
import { i18n } from '@/electron'
import { ArrowLeft } from 'lucide-vue-next'
import { computed } from 'vue'

interface Props {
  title: string
  leftSize?: string
  rightSize?: string
  showBack?: boolean
  topSpace?: number
}

interface Emits {
  (e: 'back'): void
}

const props = withDefaults(defineProps<Props>(), {
  leftSize: '220px',
  rightSize: '1fr',
  showBack: true,
  topSpace: 0,
})

const emit = defineEmits<Emits>()

const gridTemplateColumns = computed(() => {
  return `${props.leftSize} 1px ${props.rightSize}`
})

const leftHeaderStyle = computed(() => {
  return {
    paddingTop: `calc(var(--content-top-offset) + ${props.topSpace}px)`,
  }
})
</script>

<template>
  <div
    class="relative grid h-screen flex-1 overflow-hidden"
    :style="{ gridTemplateColumns }"
  >
    <div class="grid h-full min-h-0 grid-rows-[auto_1fr] overflow-hidden">
      <div
        class="flex items-center justify-between gap-2 overflow-hidden px-2 pb-2"
        :style="leftHeaderStyle"
      >
        <div class="truncate font-bold">
          {{ title }}
        </div>
        <UiActionButton
          v-if="showBack"
          :tooltip="i18n.t('button.back')"
          class="shrink-0"
          @click="() => emit('back')"
        >
          <ArrowLeft class="h-4 w-4" />
        </UiActionButton>
      </div>
      <div class="h-full min-h-0 overflow-auto">
        <slot name="left" />
      </div>
    </div>
    <div class="bg-border" />
    <div class="h-full min-h-0 overflow-auto pt-[var(--content-top-offset)]">
      <slot name="right" />
    </div>
  </div>
</template>
