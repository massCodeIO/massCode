<script setup lang="ts">
import type { LineResult } from '@/composables/math-notebook'
import { useCopyToClipboard } from '@/composables'
import { i18n } from '@/electron'
import { LoaderCircle, Sigma } from 'lucide-vue-next'

interface Props {
  results: LineResult[]
  scrollTop: number
  activeLine: number
}

const props = defineProps<Props>()

const showTotal = ref(true)
const copy = useCopyToClipboard()

const total = computed(() => {
  return props.results.reduce((sum, r) => {
    if (r.type === 'number' || r.type === 'assignment') {
      const num = Number.parseFloat((r.value || '').replace(/,/g, ''))
      if (!Number.isNaN(num))
        return sum + num
    }
    return sum
  }, 0)
})

const formattedTotal = computed(() => {
  return Number.isInteger(total.value)
    ? total.value.toLocaleString('en-US')
    : total.value.toLocaleString('en-US', { maximumFractionDigits: 6 })
})

const resultsStyle = computed(() => {
  return {
    transform: `translate3d(0, ${-Math.max(props.scrollTop, 0)}px, 0)`,
  }
})

function handleClickResult(result: LineResult) {
  if (result.value) {
    copy(result.value)
  }
}

function getResultClasses(result: LineResult) {
  const base
    = 'flex h-[22px] items-center justify-end font-mono text-[13px] leading-[22px] transition-all duration-100'

  if (result.error) {
    return `${base} text-red-400/50`
  }

  if (result.type === 'pending') {
    return `${base} text-text-muted/40`
  }

  if (result.type === 'comment') {
    return `${base} text-text-muted/40`
  }

  if (result.type === 'assignment') {
    return `${base} group text-text-muted/70 cursor-pointer`
  }

  if (result.value) {
    return `${base} group cursor-pointer`
  }

  return base
}

function getResultValueClasses(result: LineResult) {
  const base = 'truncate rounded-md px-1.5 transition-colors duration-100'

  if (result.type === 'assignment') {
    return `${base} group-hover:bg-list-selection/70`
  }

  if (result.value) {
    return `${base} group-hover:bg-primary group-hover:text-white`
  }

  return base
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="min-h-0 flex-1 overflow-hidden py-1 pr-3 pl-3">
      <div
        class="will-change-transform"
        :style="resultsStyle"
      >
        <div
          v-for="(result, index) in results"
          :key="index"
          :class="getResultClasses(result)"
          @click="handleClickResult(result)"
        >
          <template v-if="result.type === 'pending'">
            <LoaderCircle class="h-3.5 w-3.5 animate-spin" />
          </template>
          <template v-else-if="result.error && result.showError">
            <span class="truncate">
              {{ result.error }}
            </span>
          </template>
          <template v-else>
            <span
              v-if="result.value"
              :class="[
                getResultValueClasses(result),
                {
                  'font-medium':
                    ['number', 'aggregate'].includes(result.type)
                    && props.activeLine === index,
                },
              ]"
            >
              {{ result.value }}
            </span>
          </template>
        </div>
      </div>
    </div>

    <transition name="total-slide">
      <div
        v-if="showTotal"
        class="border-border/60 flex h-[34px] shrink-0 items-center gap-2 border-t px-3"
      >
        <span
          class="text-text-muted/60 shrink-0 text-[10px] font-medium tracking-[0.1em] uppercase"
        >
          {{ i18n.t("total") }}
        </span>
        <span
          class="group flex h-[22px] min-w-0 flex-1 cursor-pointer items-center justify-end font-mono text-[13px] leading-[22px]"
          @click="copy(formattedTotal)"
        >
          <span
            class="group-hover:bg-primary truncate rounded-md px-1.5 transition-colors duration-100 group-hover:text-white"
          >
            {{ formattedTotal }}
          </span>
        </span>
      </div>
    </transition>

    <div
      class="border-border/40 mb-2 flex h-[28px] shrink-0 items-center justify-end border-t px-2"
    >
      <UiActionButton
        :tooltip="i18n.t('total')"
        @click="showTotal = !showTotal"
      >
        <Sigma
          class="h-3.5 w-3.5 transition-colors"
          :class="showTotal ? 'text-primary' : 'text-text-muted/40'"
        />
      </UiActionButton>
    </div>
  </div>
</template>

<style scoped>
.total-slide-enter-active,
.total-slide-leave-active {
  transition: all 0.15s ease;
}

.total-slide-enter-from,
.total-slide-leave-to {
  opacity: 0;
  height: 0;
  overflow: hidden;
}
</style>
