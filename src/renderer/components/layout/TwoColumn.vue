<script setup lang="ts">
import { useSpacePanels } from '@/composables/useSpacePanels'
import { i18n } from '@/electron'
import { getActiveSpaceId } from '@/spaceDefinitions'
import { ArrowLeft } from 'lucide-vue-next'

interface Props {
  title: string
  leftSize?: string
  rightSize?: string
  showBack?: boolean
  topSpace?: number
  headerGap?: number
}

interface Emits {
  (e: 'back'): void
}

const props = withDefaults(defineProps<Props>(), {
  leftSize: '220px',
  rightSize: '1fr',
  showBack: true,
  topSpace: 0,
  headerGap: 0,
})

const emit = defineEmits<Emits>()

const { primaryOpen } = useSpacePanels()
const sidebarShown = computed(() => !getActiveSpaceId() || primaryOpen.value)

const gridTemplateColumns = computed(() => {
  if (!sidebarShown.value)
    return '1fr'
  return `${props.leftSize} 1px ${props.rightSize}`
})

const leftHeaderStyle = computed(() => {
  return {
    paddingTop: `calc(var(--content-top-offset) + ${props.topSpace}px)`,
    paddingBottom: `${props.headerGap}px`,
  }
})
</script>

<template>
  <div
    class="relative grid h-screen flex-1 overflow-hidden"
    :style="{ gridTemplateColumns }"
  >
    <div
      v-show="sidebarShown"
      class="grid h-full min-h-0 grid-rows-[auto_1fr] overflow-hidden"
    >
      <slot name="leftHeader">
        <div
          class="flex items-center justify-between gap-2 px-2"
          :style="leftHeaderStyle"
        >
          <div class="min-w-0 truncate px-1 leading-5 font-bold select-none">
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
      </slot>
      <div class="h-full min-h-0 overflow-auto">
        <slot name="left" />
      </div>
    </div>
    <div
      v-show="sidebarShown"
      class="bg-border"
    />
    <div class="h-full min-h-0 overflow-auto pt-[var(--content-top-offset)]">
      <slot name="right" />
    </div>
  </div>
</template>
