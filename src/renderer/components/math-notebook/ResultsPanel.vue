<script setup lang="ts">
import type { LineResult } from '@/composables/math-notebook'
import { useCopyToClipboard } from '@/composables'
import { i18n } from '@/electron'
import { Sigma } from 'lucide-vue-next'

interface Props {
  results: LineResult[]
  scrollTop: number
  activeLine: number
}

const props = defineProps<Props>()

const containerRef = ref<HTMLElement>()
const showTotal = ref(true)
const copiedIndex = ref<number | null>(null)

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

watch(
  () => props.scrollTop,
  (val) => {
    if (containerRef.value) {
      containerRef.value.scrollTop = val
    }
  },
)

function handleClickResult(result: LineResult, index: number) {
  if (result.value) {
    copy(result.value)
    copiedIndex.value = index
    setTimeout(() => {
      copiedIndex.value = null
    }, 600)
  }
}

function getResultClasses(result: LineResult, index: number) {
  const base
    = 'flex h-[22px] items-center justify-end font-mono text-[13px] leading-[22px] transition-all duration-100'

  if (copiedIndex.value === index) {
    return `${base} text-primary scale-[1.02] origin-right`
  }

  if (result.error) {
    return `${base} text-red-400/50`
  }

  if (result.type === 'comment') {
    return `${base} text-text-muted/40`
  }

  if (result.type === 'assignment') {
    return `${base} text-text-muted/70 cursor-pointer hover:text-text`
  }

  if (result.value) {
    return `${base} cursor-pointer hover:text-primary`
  }

  return base
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div
      ref="containerRef"
      class="min-h-0 flex-1 overflow-hidden py-1 pr-3 pl-3"
    >
      <div
        v-for="(result, index) in results"
        :key="index"
        :class="getResultClasses(result, index)"
        @click="handleClickResult(result, index)"
      >
        <template v-if="copiedIndex === index">
          <span class="truncate text-[11px] tracking-wider opacity-80">
            {{ i18n.t("mathNotebook.copied") }}
          </span>
        </template>
        <template v-else>
          <span
            v-if="result.value"
            class="truncate"
            :class="{
              'font-medium':
                ['number', 'aggregate'].includes(result.type)
                && props.activeLine === index,
            }"
          >
            {{ result.value }}
          </span>
        </template>
      </div>
    </div>

    <transition name="total-slide">
      <div
        v-if="showTotal"
        class="border-border/60 flex h-[34px] shrink-0 items-center justify-between border-t px-3"
      >
        <span
          class="text-text-muted/60 text-[10px] font-medium tracking-[0.1em] uppercase"
        >
          {{ i18n.t("total") }}
        </span>
        <span
          class="hover:text-primary cursor-pointer font-mono text-[13px] font-medium tracking-wide transition-colors"
          @click="copy(formattedTotal)"
        >
          {{ formattedTotal }}
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
