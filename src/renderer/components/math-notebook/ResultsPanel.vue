<script setup lang="ts">
import type { LineResult } from '@/composables/math-notebook'
import { Button } from '@/components/ui/shadcn/button'
import { useCopyToClipboard } from '@/composables'
import { i18n, ipc } from '@/electron'
import { LoaderCircle, Sigma } from 'lucide-vue-next'

interface Props {
  results: LineResult[]
  scrollTop: number
  activeLine: number
}

const props = defineProps<Props>()

const showTotal = ref(true)
const copy = useCopyToClipboard()
const MATH_NOTEBOOK_DOCUMENTATION_URL
  = 'https://masscode.io/documentation/math-notebook.html'

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
    = 'flex h-[22px] select-none items-center justify-end font-mono text-[13px] leading-[22px] transition-all duration-100'

  if (result.error) {
    return `${base} text-destructive`
  }

  if (result.type === 'pending') {
    return `${base} text-muted-foreground`
  }

  if (result.type === 'comment') {
    return `${base} text-muted-foreground`
  }

  if (result.type === 'assignment') {
    return `${base} group text-muted-foreground`
  }

  if (result.value) {
    return `${base} group`
  }

  return base
}

function getResultValueClasses(result: LineResult) {
  const base = 'truncate rounded-md px-1.5 transition-colors duration-100'

  if (result.type === 'assignment') {
    return `${base} group-hover:bg-accent-hover`
  }

  if (result.value) {
    return `${base} group-hover:bg-primary group-hover:text-white`
  }

  return base
}

function openDocumentation() {
  void ipc.invoke('system:open-external', MATH_NOTEBOOK_DOCUMENTATION_URL)
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
        class="border-border flex h-[34px] shrink-0 items-center gap-2 border-t px-3"
      >
        <UiText
          variant="caption"
          weight="medium"
          uppercase
          class="text-muted-foreground shrink-0 tracking-[0.1em]"
        >
          {{ i18n.t("total") }}
        </UiText>
        <span
          class="group flex h-[22px] min-w-0 flex-1 items-center justify-end font-mono text-[13px] leading-[22px] select-none"
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
      class="border-border flex h-[34px] shrink-0 items-center justify-between border-t px-2"
    >
      <Button
        variant="ghost"
        size="sm"
        @click="openDocumentation"
      >
        {{ i18n.t("menu:help.documentation") }}
      </Button>
      <UiActionButton
        :tooltip="i18n.t('total')"
        @click="showTotal = !showTotal"
      >
        <Sigma class="text-foreground h-3.5 w-3.5 transition-colors" />
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
