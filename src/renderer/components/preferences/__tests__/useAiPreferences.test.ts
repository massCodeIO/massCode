import type { AiConfigure, AiSettings } from '~/shared/ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, ref, watch } from 'vue'
import { AI_DEFAULT_URLS, AI_PROVIDERS } from '~/shared/ai'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  sonner: vi.fn(),
  finish: vi.fn(),
  claim: vi.fn(),
}))
vi.mock('@/electron', () => ({
  ipc: { invoke: mocks.invoke },
  i18n: { t: (key: string) => key },
}))
vi.mock('@/composables/useSonner', () => ({
  useSonner: () => ({ sonner: mocks.sonner }),
}))
vi.mock('@/composables/ai/nativePreferenceFlows', () => ({
  cancelPreferenceHandoff: vi.fn(),
  claimPreferenceHandoff: mocks.claim,
  finishPreferenceHandoff: mocks.finish,
  preferenceHandoff: { value: undefined },
  registerPreferenceFlow: () => vi.fn(),
  waitForPreferenceUser: vi.fn(),
}))

async function setup() {
  const settings = ref<AiSettings>({
    provider: 'openai',
    encryptionAvailable: true,
    userInstructions: 'saved instructions',
    profiles: Object.fromEntries(
      AI_PROVIDERS.map(provider => [
        provider,
        {
          baseURL: AI_DEFAULT_URLS[provider],
          model: 'old-model',
          models: ['old-model', 'new-model'],
          hasKey: true,
          hasStoredKey: true,
        },
      ]),
    ) as AiSettings['profiles'],
  })
  vi.doMock('@/composables/ai/useAi', () => ({
    useAi: () => ({
      settings,
      refreshSettings: async () => ({ ok: true, data: settings.value }),
    }),
  }))
  let mounted: () => Promise<void>
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('onMounted', (callback: () => Promise<void>) => {
    mounted = callback
  })
  vi.stubGlobal('onBeforeUnmount', vi.fn())
  mocks.invoke.mockImplementation(
    async (channel: string, payload: AiConfigure) => {
      if (channel === 'system:ai:models')
        return { ok: true, data: ['old-model', 'new-model'] }
      const data = JSON.parse(JSON.stringify(settings.value)) as AiSettings
      data.provider = payload.provider
      Object.assign(data.profiles[payload.provider], {
        model: payload.model.trim(),
        baseURL: payload.baseURL,
      })
      if (payload.userInstructions !== undefined)
        data.userInstructions = payload.userInstructions
      return { ok: true, data }
    },
  )
  const { useAiPreferences } = await import('../useAiPreferences')
  const scope = effectScope()
  const ui = scope.run(useAiPreferences)!
  await mounted!()
  await nextTick()
  return { ui, settings, scope }
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})

describe('aI preferences persistence', () => {
  it('saves a model immediately without model discovery or unrelated drafts', async () => {
    const { ui, settings, scope } = await setup()
    ui.userInstructions.value = 'unsaved instructions'
    await ui.selectModel('new-model')
    expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith(
      'system:ai:configure',
      {
        provider: 'openai',
        baseURL: AI_DEFAULT_URLS.openai,
        model: 'new-model',
      },
    )
    expect(settings.value.profiles.openai.model).toBe('new-model')
    expect(settings.value.userInstructions).toBe('saved instructions')
    expect(ui.modelSaved.value).toBe(true)
    scope.stop()
  })

  it('restores the saved selection when persistence fails', async () => {
    const { ui, scope } = await setup()
    mocks.invoke.mockResolvedValueOnce({ ok: false, error: 'busy' })
    await ui.selectModel('new-model')
    expect(ui.selectedModel.value).toBe('old-model')
    expect(ui.modelSaved.value).toBe(false)
    scope.stop()
  })

  it('requires saving connection changes before changing models', async () => {
    const { ui, scope } = await setup()
    ui.apiKey.value = 'draft-key'
    await ui.selectModel('new-model')
    await ui.refreshModels()
    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(ui.model.value).toBe('old-model')
    scope.stop()
  })

  it('reports discovery failure separately after persisting the connection', async () => {
    const { ui, settings, scope } = await setup()
    ui.provider.value = 'ollama'
    await nextTick()
    ui.baseURL.value = 'http://localhost:12345/v1'
    mocks.invoke
      .mockImplementationOnce(
        async (_channel: string, payload: AiConfigure) => ({
          ok: true,
          data: {
            ...settings.value,
            provider: 'ollama',
            profiles: {
              ...settings.value.profiles,
              ollama: {
                ...settings.value.profiles.ollama,
                baseURL: payload.baseURL,
                model: '',
              },
            },
          },
        }),
      )
      .mockResolvedValueOnce({ ok: false, error: 'connection' })
    await ui.save('connection')
    expect(ui.connectionDirty.value).toBe(false)
    expect(mocks.sonner).toHaveBeenCalledWith({
      type: 'error',
      message: 'ai.savedModelsFailed',
    })
    expect(mocks.finish).toHaveBeenLastCalledWith(
      undefined,
      expect.objectContaining({
        persisted: true,
        profile: expect.objectContaining({ connectionCheck: 'failed' }),
      }),
      true,
    )
    scope.stop()
  })

  it('opens manual mode without saving and allows an unlisted model', async () => {
    const { ui, settings, scope } = await setup()
    await ui.selectModel('__manual__')
    expect(ui.manualModel.value).toBe(true)
    expect(mocks.invoke).not.toHaveBeenCalled()
    ui.model.value = 'custom-model'
    await ui.save('model')
    expect(settings.value.profiles.openai.model).toBe('custom-model')
    expect(mocks.invoke).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('refreshes the list without saving settings', async () => {
    const { ui, scope } = await setup()
    const pending = ui.refreshModels()
    expect(ui.refreshingModels.value).toBe(true)
    await pending
    expect(ui.refreshingModels.value).toBe(false)
    expect(mocks.sonner).toHaveBeenCalledWith({
      type: 'success',
      message: 'ai.modelsRefreshed',
    })
    expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith(
      'system:ai:models',
      null,
    )
    scope.stop()
  })

  it('saves instructions against the active provider without applying a connection draft', async () => {
    const { ui, scope } = await setup()
    ui.provider.value = 'ollama'
    await nextTick()
    ui.baseURL.value = 'http://localhost:12345/v1'
    ui.apiKey.value = 'draft-key'
    ui.userInstructions.value = 'new instructions'
    await ui.save('instructions')
    expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith(
      'system:ai:configure',
      {
        provider: 'openai',
        baseURL: AI_DEFAULT_URLS.openai,
        model: 'old-model',
        userInstructions: 'new instructions',
      },
    )
    expect(ui.connectionDirty.value).toBe(true)
    scope.stop()
  })
})
