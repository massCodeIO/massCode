<script setup lang="ts">
import type { LineResult } from '@/composables/math-notebook'
import type { MathSettings } from '~/main/store/types'
import { useMathEngine, useMathNotebook } from '@/composables'
import { i18n, ipc, store } from '@/electron'
import { Calculator } from 'lucide-vue-next'

interface CurrencyRatesPayload {
  rates: Record<string, number>
  source: 'live' | 'cache' | 'unavailable'
}

const { activeSheet, updateSheet } = useMathNotebook()
const {
  evaluateDocument,
  setCurrencyServiceState,
  setFormatSettings,
  updateCurrencyRates,
} = useMathEngine()

const mathSettings = reactive(store.preferences.get('math') as MathSettings)

setFormatSettings(mathSettings.locale, mathSettings.decimalPlaces)

watch(
  mathSettings,
  () => {
    store.preferences.set('math', JSON.parse(JSON.stringify(mathSettings)))
    setFormatSettings(mathSettings.locale, mathSettings.decimalPlaces)
  },
  { deep: true },
)

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
    if (payload.source === 'unavailable') {
      setCurrencyServiceState(
        'unavailable',
        i18n.t('spaces.math.currencyUnavailable'),
      )
    }
    else {
      updateCurrencyRates(payload.rates)
    }
    results.value = evaluateDocument(content.value)
  }
  catch {
    setCurrencyServiceState(
      'unavailable',
      i18n.t('spaces.math.currencyUnavailable'),
    )
    results.value = evaluateDocument(content.value)
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
      :locale="mathSettings.locale"
      :decimal-places="mathSettings.decimalPlaces"
    />
  </div>

  <div
    v-else
    class="flex h-full flex-col items-center justify-center gap-4"
  >
    <div class="text-muted-foreground/20">
      <Calculator
        class="h-16 w-16"
        :stroke-width="1"
      />
    </div>
    <!-- <div class="text-center">
      <p class="text-muted-foreground/60 text-[13px]">
        {{ i18n.t("spaces.math.newSheet") }}
      </p>
    </div> -->
  </div>
</template>
