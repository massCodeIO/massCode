import type { NativeBridgeResult } from '@/composables/ai/nativeBridges'
import type { AiProvider, AiResult, AiSettings } from '~/shared/ai'
import {
  cancelPreferenceHandoff,
  claimPreferenceHandoff,
  finishPreferenceHandoff,
  preferenceHandoff,
  registerPreferenceFlow,
  waitForPreferenceUser,
} from '@/composables/ai/nativePreferenceFlows'
import { useAi } from '@/composables/ai/useAi'
import { useSonner } from '@/composables/useSonner'
import { i18n, ipc } from '@/electron'
import { AI_DEFAULT_URLS, AI_PROVIDERS, isLocalAiProvider } from '~/shared/ai'

export function useAiPreferences() {
  const { settings, refreshSettings } = useAi()
  const { sonner } = useSonner()
  const cloudProviders = AI_PROVIDERS.filter(
    value => !isLocalAiProvider(value),
  )
  const localProviders = AI_PROVIDERS.filter(isLocalAiProvider)
  const provider = ref<AiProvider>('openai')
  const baseURL = ref(AI_DEFAULT_URLS.openai)
  const model = ref('')
  const userInstructions = ref('')
  const apiKey = ref('')
  const removeKey = ref(false)
  const editingKey = ref(false)
  const busy = ref(false)
  const refreshingModels = ref(false)
  const manualModel = ref(false)
  const modelSaved = ref(false)
  const loaded = ref(false)
  const currentProfile = computed(
    () => settings.value?.profiles[provider.value],
  )
  const sameEndpoint = computed(
    () =>
      baseURL.value.trim().replace(/\/+$/, '')
      === currentProfile.value?.baseURL,
  )
  const models = computed(() =>
    apiKey.value.trim() || removeKey.value || !sameEndpoint.value
      ? []
      : (currentProfile.value?.models ?? []),
  )
  const connectionDirty = computed(
    () =>
      provider.value !== settings.value?.provider
      || !sameEndpoint.value
      || Boolean(apiKey.value.trim())
      || removeKey.value,
  )
  const selectedModel = computed(() => model.value)
  async function selectModel(value: unknown) {
    if (
      typeof value !== 'string'
      || busy.value
      || !loaded.value
      || connectionDirty.value
    ) {
      return
    }
    if (value === '__manual__') {
      manualModel.value = true
      modelSaved.value = false
      return
    }
    model.value = value
    await save('model')
    if (!modelSaved.value)
      model.value = currentProfile.value?.model ?? ''
  }
  const hasKey = computed(
    () =>
      currentProfile.value?.hasKey && !removeKey.value && sameEndpoint.value,
  )
  const hasStoredKey = computed(
    () =>
      currentProfile.value?.hasStoredKey
      && !removeKey.value
      && sameEndpoint.value,
  )
  const keyPlaceholder = computed(() => {
    if (hasKey.value)
      return i18n.t('ai.keySaved')
    if (hasStoredKey.value)
      return i18n.t('ai.keyUnreadable')
    return i18n.t(
      !isLocalAiProvider(provider.value)
        ? 'ai.keyRequired'
        : 'ai.keyPlaceholder',
    )
  })
  const keyDescription = computed(() => {
    if (removeKey.value)
      return i18n.t('ai.keyWillRemove')
    return i18n.t(
      settings.value?.encryptionAvailable
        ? 'ai.keyHint'
        : 'ai.errors.encryptionUnavailable',
    )
  })
  function loadProfile() {
    const profile = settings.value?.profiles[provider.value]
    baseURL.value = profile?.baseURL ?? AI_DEFAULT_URLS[provider.value]
    model.value = profile?.model ?? ''
    apiKey.value = ''
    removeKey.value = false
    editingKey.value = false
    manualModel.value = Boolean(
      model.value && !profile?.models?.includes(model.value),
    )
    modelSaved.value = false
  }
  watch(provider, loadProfile)
  function chooseFromList() {
    model.value = currentProfile.value?.model ?? ''
    manualModel.value = false
    modelSaved.value = false
  }
  async function refreshModels(afterSave = false) {
    if (!afterSave && (busy.value || !loaded.value || connectionDirty.value))
      return
    busy.value = true
    refreshingModels.value = true
    try {
      const result = (await ipc.invoke('system:ai:models', null)) as AiResult<
        string[]
      >
      if (!result.ok)
        throw new Error(i18n.t(`ai.errors.${result.error}`))
      if (settings.value)
        settings.value.profiles[provider.value].models = result.data
      if (!afterSave)
        sonner({ type: 'success', message: i18n.t('ai.modelsRefreshed') })
      return true
    }
    catch (error) {
      sonner({
        type: 'error',
        message: afterSave
          ? i18n.t('ai.savedModelsFailed')
          : error instanceof Error
            ? error.message
            : i18n.t('ai.errors.connection'),
      })
      return false
    }
    finally {
      refreshingModels.value = false
      if (!afterSave)
        busy.value = false
    }
  }
  async function save(kind: 'connection' | 'model' | 'instructions') {
    if (
      busy.value
      || !loaded.value
      || (kind === 'model' && (connectionDirty.value || !model.value.trim()))
    ) {
      return
    }
    const handoffId = claimPreferenceHandoff('configureAi')
    if (preferenceHandoff.value?.kind === 'configureAi' && !handoffId)
      return
    busy.value = true
    modelSaved.value = false
    let outcome: NativeBridgeResult = { status: 'failed', persisted: false }
    let keepOpen = true
    try {
      const savedProvider
        = kind === 'instructions' ? settings.value!.provider : provider.value
      const profile = settings.value!.profiles[savedProvider]
      const result = (await ipc.invoke('system:ai:configure', {
        provider: savedProvider,
        baseURL: kind === 'connection' ? baseURL.value : profile.baseURL,
        model: kind === 'model' ? model.value : profile.model,
        ...(kind === 'instructions'
          ? { userInstructions: userInstructions.value }
          : {}),
        ...(handoffId ? { nativeActionId: handoffId } : {}),
        ...(kind === 'connection' && apiKey.value.trim()
          ? { apiKey: apiKey.value.trim() }
          : kind === 'connection' && removeKey.value
            ? { apiKey: null }
            : {}),
      })) as AiResult<AiSettings>
      if (!result.ok) {
        sonner({ type: 'error', message: i18n.t(`ai.errors.${result.error}`) })
        return
      }
      settings.value = result.data
      const savedProfile = result.data.profiles[result.data.provider]
      outcome = {
        status: 'done',
        persisted: true,
        profile: {
          provider: result.data.provider,
          model: savedProfile.model,
          saved: true,
          connectionCheck: 'notRun',
        },
      }
      if (kind === 'connection') {
        baseURL.value = savedProfile.baseURL
        apiKey.value = ''
        removeKey.value = false
        editingKey.value = false
        const refreshed = await refreshModels(true)
        outcome.profile!.connectionCheck = refreshed ? 'passed' : 'failed'
        // Saving succeeded even when discovery is unavailable.
        if (!refreshed)
          outcome.status = 'failed'
        else sonner({ type: 'success', message: i18n.t('ai.saved') })
      }
      else if (kind === 'model') {
        model.value = savedProfile.model
        modelSaved.value = true
      }
      else {
        userInstructions.value = result.data.userInstructions ?? ''
        sonner({ type: 'success', message: i18n.t('ai.saved') })
      }
      keepOpen = kind === 'instructions' || !savedProfile.model
    }
    catch {
      sonner({ type: 'error', message: i18n.t('ai.errors.connection') })
    }
    finally {
      busy.value = false
      finishPreferenceHandoff(handoffId, outcome, keepOpen)
    }
  }
  onMounted(async () => {
    try {
      const result = await refreshSettings()
      if (!result.ok) {
        sonner({ type: 'error', message: i18n.t(`ai.errors.${result.error}`) })
        return
      }
      userInstructions.value = result.data.userInstructions ?? ''
      provider.value = result.data.provider
      loadProfile()
      loaded.value = true
    }
    catch {
      sonner({ type: 'error', message: i18n.t('ai.errors.connection') })
    }
  })
  onBeforeUnmount(() => {
    apiKey.value = ''
    if (preferenceHandoff.value?.kind === 'configureAi')
      cancelPreferenceHandoff()
  })
  const unregisterNative = registerPreferenceFlow(
    'configureAi',
    async (action, id, current) =>
      action.action === 'configureAi'
        ? waitForPreferenceUser('configureAi', id, current)
        : { status: 'unavailable' },
  )
  onBeforeUnmount(unregisterNative)
  return {
    settings,
    provider,
    baseURL,
    model,
    userInstructions,
    apiKey,
    removeKey,
    editingKey,
    busy,
    refreshingModels,
    loaded,
    currentProfile,
    models,
    selectedModel,
    hasStoredKey,
    keyPlaceholder,
    keyDescription,
    cloudProviders,
    localProviders,
    manualModel,
    modelSaved,
    connectionDirty,
    selectModel,
    chooseFromList,
    save,
    refreshModels,
  }
}
