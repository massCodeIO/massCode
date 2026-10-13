import type { AiResult } from '~/shared/ai'
import type { AiSemanticProgress } from '~/shared/aiSemantic'
import { ipc } from '@/electron'
import {
  isSemanticIndicatorVisible,
  nextBusySince,
  SEMANTIC_INDICATOR_DELAY_MS,
  semanticIndicatorPercent,
  semanticIndicatorPhase,
} from './semantic-indexing/indicator'

const status = ref<AiSemanticProgress>()
const busySince = ref<number>()
const now = ref(Date.now())
let revealTimer: ReturnType<typeof setTimeout> | undefined
let updates = 0

const phase = computed(() =>
  status.value ? semanticIndicatorPhase(status.value) : 'hidden',
)
const isVisible = computed(() =>
  isSemanticIndicatorVisible(phase.value, busySince.value, now.value),
)
const percent = computed(() =>
  status.value
    ? semanticIndicatorPercent(status.value, phase.value)
    : undefined,
)

function setSemanticIndexingStatus(next: AiSemanticProgress): void {
  const time = Date.now()
  updates++
  status.value = next
  busySince.value = nextBusySince(phase.value, busySince.value, time)
  now.value = time
  clearTimeout(revealTimer)
  if (busySince.value !== undefined && !isVisible.value) {
    revealTimer = setTimeout(
      () => {
        now.value = Date.now()
      },
      busySince.value + SEMANTIC_INDICATOR_DELAY_MS - time,
    )
  }
}

async function refreshSemanticIndexingStatus(): Promise<void> {
  const updatesBefore = updates
  const result = await ipc.invoke<null, AiResult<AiSemanticProgress>>(
    'system:ai:semantic-progress-status',
    null,
  )

  // Событие, пришедшее за время запроса, новее ответа.
  if (result?.ok && updates === updatesBefore) {
    setSemanticIndexingStatus(result.data)
  }
}

export function useSemanticIndexing() {
  return {
    isVisible,
    percent,
    phase,
    refreshSemanticIndexingStatus,
    setSemanticIndexingStatus,
    status,
  }
}
