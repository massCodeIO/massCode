import { Buffer } from 'node:buffer'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  available: true,
  decryptFails: false,
  saved: {} as Record<string, any>,
}))
vi.mock('electron-store', () => ({
  default: class {
    constructor(options: any) {
      mocks.saved = structuredClone(options.defaults)
    }

    get(key: string) {
      return mocks.saved[key]
    }

    set(key: string, value: unknown) {
      mocks.saved[key] = value
    }
  },
}))
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => mocks.available,
    getSelectedStorageBackend: () => 'gnome_libsecret',
    encryptString: (value: string) => Buffer.from(`encrypted:${value}`),
    decryptString: (value: Buffer) => {
      if (mocks.decryptFails)
        throw new Error('keychain changed')
      return value.toString().replace('encrypted:', '')
    },
  },
}))
beforeEach(() => {
  vi.resetModules()
  mocks.available = true
  mocks.decryptFails = false
})

describe('aI settings secrets', () => {
  it('never exposes saved key and binds it to provider and canonical endpoint', async () => {
    const { configureAi, getAiConnection } = await import('../settings')
    const result = configureAi({
      provider: 'ollama',
      baseURL: 'http://localhost:11434/v1/',
      model: 'local',
      apiKey: 'sensitive',
    })
    expect(JSON.stringify(result)).not.toContain('sensitive')
    expect(JSON.stringify(result)).not.toContain(
      mocks.saved.profiles.ollama.encryptedKey,
    )
    expect(result.profiles.ollama.hasStoredKey).toBe(true)
    expect(result.profiles.ollama.hasKey).toBe(true)
    expect(getAiConnection().apiKey).toBe('sensitive')
    configureAi({
      provider: 'ollama',
      baseURL: 'http://localhost:11434/v1',
      model: 'other',
    })
    expect(getAiConnection().apiKey).toBe('sensitive')
    configureAi({
      provider: 'lmstudio',
      baseURL: 'http://localhost:11434/v1',
      model: 'other',
    })
    expect(getAiConnection().apiKey).toBeUndefined()
    configureAi({
      provider: 'ollama',
      baseURL: 'http://localhost:9999/v1',
      model: 'other',
    })
    expect(getAiConnection().apiKey).toBeUndefined()
    configureAi({
      provider: 'ollama',
      baseURL: 'http://localhost:11434/v1',
      model: 'other',
    })
    expect(getAiConnection().apiKey).toBeUndefined()
  })
  it('deletes keys explicitly and refuses plaintext fallback', async () => {
    const { configureAi, getAiSettings, getAiConnection } = await import(
      '../settings'
    )
    configureAi({
      provider: 'ollama',
      baseURL: 'http://localhost/v1',
      model: 'local',
      apiKey: 'secret',
    })
    mocks.available = false
    expect(getAiSettings().profiles.ollama).toMatchObject({
      hasKey: false,
      hasStoredKey: true,
    })
    expect(() => getAiConnection()).toThrow('keyUnavailable')
    expect(() =>
      configureAi({
        provider: 'ollama',
        baseURL: 'http://localhost/v1',
        model: 'local',
        apiKey: 'new',
      }),
    ).toThrow('encryptionUnavailable')
    configureAi({
      provider: 'ollama',
      baseURL: 'http://localhost/v1',
      model: 'local',
      apiKey: null,
    })
    expect(getAiConnection().apiKey).toBeUndefined()
    expect(JSON.stringify(mocks.saved)).not.toContain('encryptedKey')
    expect(getAiSettings().profiles.ollama).toMatchObject({
      hasKey: false,
      hasStoredKey: false,
    })
  })
  it('allows deleting an unreadable stored key to restore unauthenticated local access', async () => {
    const { configureAi, getAiSettings, getAiConnection } = await import(
      '../settings'
    )
    configureAi({
      provider: 'lmstudio',
      baseURL: 'http://localhost:1234/v1',
      model: 'local',
      apiKey: 'secret',
    })
    mocks.decryptFails = true
    expect(getAiSettings().profiles.lmstudio).toMatchObject({
      hasKey: false,
      hasStoredKey: true,
    })
    expect(() => getAiConnection()).toThrow('keyUnavailable')
    const result = configureAi({
      provider: 'lmstudio',
      baseURL: 'http://localhost:1234/v1',
      model: 'local',
      apiKey: null,
    })
    expect(result.profiles.lmstudio).toMatchObject({
      hasKey: false,
      hasStoredKey: false,
    })
    expect(getAiConnection().apiKey).toBeUndefined()
    expect(JSON.stringify(mocks.saved)).not.toContain('encryptedKey')
  })
  it('fails closed on unreadable keychain and fixes OpenAI endpoint', async () => {
    const { configureAi, getAiConnection, canonicalAiURL } = await import(
      '../settings'
    )
    configureAi({
      provider: 'openai',
      baseURL: 'https://api.openai.com/v1',
      model: 'test',
      apiKey: 'secret',
    })
    mocks.decryptFails = true
    expect(() => getAiConnection()).toThrow('keyUnavailable')
    for (const url of [
      'http://api.openai.com/v1',
      'https://example.com/v1',
      'https://api.openai.com/v1?x=1',
    ])
      expect(() => canonicalAiURL('openai', url)).toThrow('invalidRequest')
    for (const url of [
      'file:///tmp/model',
      'http://user:pass@localhost/v1',
      'http://localhost/v1#secret',
    ])
      expect(() => canonicalAiURL('ollama', url)).toThrow('invalidRequest')
  })
})

it('upgrades legacy profiles lazily without losing keys or selecting a new provider', async () => {
  const { getAiSettings, configureAi, getAiConnection } = await import(
    '../settings'
  )
  mocks.saved.profiles = {
    openai: {
      baseURL: 'https://api.openai.com/v1',
      model: 'old-model',
      encryptedKey: Buffer.from('encrypted:old-secret').toString('base64'),
    },
  }
  const before = getAiSettings()
  expect(before.provider).toBe('openai')
  expect(before.profiles.anthropic.model).toBe('')
  expect(getAiConnection().apiKey).toBe('old-secret')
  configureAi({
    provider: 'anthropic',
    baseURL: 'https://api.anthropic.com/v1',
    model: 'claude',
    apiKey: 'new-secret',
  })
  expect(getAiConnection().apiKey).toBe('new-secret')
  expect(mocks.saved.profiles.openai.model).toBe('old-model')
  expect(JSON.stringify(getAiSettings())).not.toContain('secret')
})
it('pins cloud credentials to official provider endpoints', async () => {
  const { canonicalAiURL } = await import('../settings')
  for (const provider of [
    'anthropic',
    'gemini',
    'deepseek',
    'mistral',
    'xai',
  ] as const) {
    expect(() =>
      canonicalAiURL(provider, 'https://unrelated.invalid/v1'),
    ).toThrow()
  }
})

it('returns only a masked key preview and clears it when removed or unreadable', async () => {
  const { configureAi, getAiSettings } = await import('../settings')
  const input = {
    provider: 'openai' as const,
    baseURL: 'https://api.openai.com/v1',
    model: 'test',
  }
  const key = 'sk-synthetic-private-provider-key-abcd'
  const saved = configureAi({ ...input, apiKey: key })
  expect(saved.profiles.openai.keyPreview).toBe('sk-sy...abcd')
  expect(JSON.stringify(saved)).not.toContain(key)
  mocks.decryptFails = true
  expect(getAiSettings().profiles.openai.keyPreview).toBeUndefined()
  mocks.decryptFails = false
  expect(
    configureAi({ ...input, apiKey: 'short' }).profiles.openai.keyPreview,
  ).toBe('••••••••')
  expect(
    configureAi({ ...input, apiKey: null }).profiles.openai.keyPreview,
  ).toBeUndefined()
})

it('persists discovered models in the existing profile and invalidates them with connection credentials', async () => {
  const { configureAi, getAiSettings, getAiConnection, rememberAiModels }
    = await import('../settings')
  const input = {
    provider: 'lmstudio' as const,
    baseURL: 'http://localhost:1234/v1',
    model: 'one',
  }
  configureAi(input)
  const initial = getAiConnection()
  rememberAiModels(initial, ['one', 'two'])
  expect(mocks.saved.profiles.lmstudio.models).toEqual(['one', 'two'])
  expect(getAiSettings().profiles.lmstudio.models).toEqual(['one', 'two'])
  configureAi({ ...input, model: 'two' })
  expect(getAiSettings().profiles.lmstudio.models).toEqual(['one', 'two'])
  configureAi({ ...input, apiKey: 'new-key' })
  expect(getAiSettings().profiles.lmstudio.models).toEqual([])
  rememberAiModels(initial, ['stale'])
  expect(getAiSettings().profiles.lmstudio.models).toEqual([])
  rememberAiModels(getAiConnection(), ['new-account'])
  configureAi({ ...input, baseURL: 'http://localhost:9999/v1' })
  expect(getAiSettings().profiles.lmstudio.models).toEqual([])
})

it('stores global user preferences across provider changes and supports clearing', async () => {
  const { configureAi, getAiSettings, getAiConnection } = await import(
    '../settings'
  )
  const input = {
    provider: 'lmstudio' as const,
    baseURL: 'http://localhost:1234/v1',
    model: 'local',
  }
  configureAi({ ...input, userInstructions: 'Всегда отвечай на русском' })
  expect(mocks.saved.userInstructions).toBe('Всегда отвечай на русском')
  configureAi({
    provider: 'ollama',
    baseURL: 'http://localhost:11434/v1',
    model: 'local',
  })
  expect(getAiSettings().userInstructions).toBe('Всегда отвечай на русском')
  expect(getAiConnection().userInstructions).toBe('Всегда отвечай на русском')
  configureAi({ ...input, userInstructions: '' })
  expect(getAiConnection().userInstructions).toBe('')
})
