<script setup lang="ts">
import type { LineResult } from '@/composables/math-notebook'
import { useMathEngine, useMathNotebook } from '@/composables'
import { i18n, ipc } from '@/electron'
import { Calculator } from 'lucide-vue-next'

interface CurrencyRatesPayload {
  rates: Record<string, number>
}

const { activeSheet, updateSheet } = useMathNotebook()
const { evaluateDocument, updateCurrencyRates } = useMathEngine()

const scrollTop = ref(0)
const activeLine = ref(0)
const results = ref<LineResult[]>([])
const timeTick = ref(0)
let timeTickInterval: number | undefined

const content = computed({
  get: () => activeSheet.value?.content || '',
  set: (value: string) => {
    if (activeSheet.value) {
      updateSheet(activeSheet.value.id, value)
    }
  },
})

watch(
  [content, timeTick],
  ([text]) => {
    results.value = evaluateDocument(text)
  },
  { immediate: true },
)

onMounted(async () => {
  timeTickInterval = window.setInterval(() => {
    timeTick.value = Date.now()
  }, 60_000)

  try {
    const payload = await ipc.invoke<null, CurrencyRatesPayload>(
      'system:currency-rates',
      null,
    )
    updateCurrencyRates(payload.rates)
    results.value = evaluateDocument(content.value)
  }
  catch {
    // The engine already has static fallback rates.
  }
})

onBeforeUnmount(() => {
  if (timeTickInterval !== undefined) {
    window.clearInterval(timeTickInterval)
  }
})

function handleScroll(top: number) {
  scrollTop.value = top
}

function handleActiveLine(line: number) {
  activeLine.value = line
}
</script>

<template>
  <div
    v-if="activeSheet"
    class="grid h-full min-h-0 overflow-hidden"
    style="grid-template-columns: 1fr 1px 220px"
  >
    <MathNotebookMathEditor
      :key="activeSheet.id"
      v-model="content"
      @scroll="handleScroll"
      @active-line="handleActiveLine"
    />
    <div class="bg-border/50" />
    <MathNotebookResultsPanel
      :results="results"
      :scroll-top="scrollTop"
      :active-line="activeLine"
    />
  </div>

  <div
    v-else
    class="flex h-full flex-col items-center justify-center gap-4"
  >
    <div class="text-text-muted/20">
      <Calculator
        class="h-16 w-16"
        :stroke-width="1"
      />
    </div>
    <div class="text-center">
      <p class="text-text-muted/60 text-[13px]">
        {{ i18n.t("math-notebook:newSheet") }}
      </p>
    </div>
  </div>
</template>
