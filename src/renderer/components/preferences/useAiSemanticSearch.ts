import type { AiResult } from '~/shared/ai'
import type {
  AiSemanticConfigure,
  AiSemanticProvider,
  AiSemanticSource,
  AiSemanticStatus,
} from '~/shared/aiSemantic'
import { useSonner } from '@/composables/useSonner'
import { i18n, ipc } from '@/electron'
import { isWindows } from '@/utils'
import { useIntervalFn } from '@vueuse/core'

export function useAiSemanticSearch() {
  const { sonner } = useSonner()
  const status = ref<AiSemanticStatus>()
  const busy = ref(false)
  const models = ref<string[]>([])
  const refreshingModels = ref(false)
  const sources = computed<AiSemanticSource[]>(() =>
    status.value?.builtin.supported
      ? ['off', 'builtin', 'provider']
      : ['off', 'provider'],
  )
  const builtinErrorText = computed(() => {
    const error = status.value?.builtin.error
    if (!error)
      return ''
    return i18n.t(
      `ai.semantic.builtin.errors.${error === 'runtime' && isWindows ? 'runtimeWindows' : error}`,
    )
  })
  const indexText = computed(() => {
    const index = status.value?.index
    if (!index || index.state === 'error' || index.state === 'off')
      return ''
    if (index.state === 'indexing') {
      return index.total
        ? i18n.t('ai.semantic.indexing', {
            done: index.done ?? 0,
            total: index.total,
          })
        : i18n.t('ai.semantic.preparing')
    }
    return i18n.t('ai.semantic.indexed', { count: index.indexed })
  })

  async function load() {
    try {
      const result = (await ipc.invoke(
        'system:ai:semantic',
        null,
      )) as AiResult<AiSemanticStatus>
      if (result.ok)
        status.value = result.data
    }
    catch {}
  }
  async function request(
    channel: `system:ai:semantic-${'configure' | 'download' | 'cancel' | 'remove' | 'retry'}`,
    input: AiSemanticConfigure | null = null,
  ) {
    if (busy.value)
      return false
    busy.value = true
    try {
      const result = (await ipc.invoke(
        channel,
        input,
      )) as AiResult<AiSemanticStatus>
      if (!result.ok) {
        sonner({ type: 'error', message: i18n.t(`ai.errors.${result.error}`) })
        return false
      }
      status.value = result.data
      return true
    }
    catch {
      sonner({ type: 'error', message: i18n.t('ai.errors.connection') })
      return false
    }
    finally {
      busy.value = false
    }
  }
  // Автоматическое обновление молчит: сервер может быть ещё не запущен, ошибку покажет только ручной запрос.
  async function refreshModels(silent = false) {
    if (refreshingModels.value)
      return
    refreshingModels.value = true
    try {
      const result = (await ipc.invoke(
        'system:ai:semantic-models',
        null,
      )) as AiResult<string[]>
      if (result.ok)
        models.value = result.data
      else if (!silent)
        sonner({ type: 'error', message: i18n.t(`ai.errors.${result.error}`) })
    }
    catch {
      if (!silent)
        sonner({ type: 'error', message: i18n.t('ai.errors.connection') })
    }
    finally {
      refreshingModels.value = false
    }
  }
  async function selectSource(value: unknown) {
    if (typeof value !== 'string' || value === status.value?.source)
      return
    const saved = await request('system:ai:semantic-configure', {
      source: value as AiSemanticSource,
    })
    if (saved && value === 'provider')
      void refreshModels(true)
  }
  async function selectProvider(patch: Partial<AiSemanticProvider>) {
    const current = status.value?.provider
    if (!current)
      return
    const provider = { ...current, ...patch }
    if (
      provider.kind === current.kind
      && provider.baseURL === current.baseURL
      && provider.model === current.model
    ) {
      return
    }
    const saved = await request('system:ai:semantic-configure', {
      source: 'provider',
      provider,
    })
    if (saved && (patch.kind || patch.baseURL)) {
      models.value = []
      void refreshModels(true)
    }
  }
  const downloadModel = () => request('system:ai:semantic-download')
  const cancelDownload = () => request('system:ai:semantic-cancel')
  const removeModel = () => request('system:ai:semantic-remove')
  const retryIndex = () => request('system:ai:semantic-retry')

  const { pause, resume } = useIntervalFn(load, 1000, { immediate: false })
  // Опрос идёт и пока индекс не достроен: main запускает сборку сам, UI не должен застыть на «0».
  watch(
    () =>
      status.value?.index.state === 'indexing'
      || (status.value?.index.state === 'idle' && !status.value.index.complete)
      || status.value?.builtin.state === 'downloading',
    active => (active ? resume() : pause()),
  )
  onMounted(async () => {
    await load()
    if (status.value?.source === 'provider')
      void refreshModels(true)
  })

  return {
    status,
    busy,
    sources,
    models,
    refreshingModels,
    indexText,
    builtinErrorText,
    selectSource,
    selectProvider,
    refreshModels,
    downloadModel,
    cancelDownload,
    removeModel,
    retryIndex,
  }
}
