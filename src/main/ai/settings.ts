import type { AiConfigure, AiProvider, AiSettings } from '../../shared/ai'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import { safeStorage } from 'electron'
import Store from 'electron-store'
import {
  AI_DEFAULT_URLS,
  AI_PROVIDERS,
  isLocalAiProvider,
} from '../../shared/ai'
import { isSafeStorageUsable } from '../store/module/httpSecretsAvailability'
import { AiError } from './errors'

interface SavedProfile {
  baseURL: string
  model: string
  models?: string[]
  encryptedKey?: string
}
interface SavedSettings {
  userInstructions: string
  provider: AiProvider
  profiles: Record<AiProvider, SavedProfile>
}
const settings = new Store<SavedSettings>({
  name: 'ai-settings',
  cwd: 'v2',
  defaults: {
    provider: 'openai',
    userInstructions: '',
    profiles: Object.fromEntries(
      AI_PROVIDERS.map(provider => [
        provider,
        { baseURL: AI_DEFAULT_URLS[provider], model: '' },
      ]),
    ) as SavedSettings['profiles'],
  },
})

export function canonicalAiURL(provider: AiProvider, value: string): string {
  try {
    const url = new URL(value.trim())
    if (
      !['http:', 'https:'].includes(url.protocol)
      || url.username
      || url.password
      || url.search
      || url.hash
    ) {
      throw new AiError('invalidRequest')
    }
    const canonical = url.toString().replace(/\/+$/, '')
    if (!isLocalAiProvider(provider) && canonical !== AI_DEFAULT_URLS[provider])
      throw new AiError('invalidRequest')
    return canonical
  }
  catch {
    throw new AiError('invalidRequest')
  }
}

function encryptionAvailable(): boolean {
  try {
    return isSafeStorageUsable({
      platform: process.platform,
      backend:
        process.platform === 'linux'
          ? safeStorage.getSelectedStorageBackend()
          : undefined,
      encryptionAvailable: safeStorage.isEncryptionAvailable(),
    })
  }
  catch {
    return false
  }
}

function decrypt(profile: SavedProfile): string | undefined {
  if (!profile.encryptedKey || !encryptionAvailable())
    return undefined
  try {
    return safeStorage.decryptString(
      Buffer.from(profile.encryptedKey, 'base64'),
    )
  }
  catch {
    return undefined
  }
}

export function getAiSettings(): AiSettings {
  const profiles = settings.get('profiles')
  const publicProfiles = {} as AiSettings['profiles']
  for (const provider of AI_PROVIDERS) {
    const profile = profiles[provider] ?? {
      baseURL: AI_DEFAULT_URLS[provider],
      model: '',
    }
    const key = decrypt(profile)
    publicProfiles[provider] = {
      baseURL: profile.baseURL,
      model: profile.model,
      models: profile.models ?? [],
      hasKey: Boolean(key),
      ...(key
        ? {
            keyPreview:
              key.length > 12
                ? `${key.slice(0, 5)}...${key.slice(-4)}`
                : '••••••••',
          }
        : {}),
      hasStoredKey: Boolean(profile.encryptedKey),
    }
  }
  return {
    provider: settings.get('provider'),
    userInstructions: settings.get('userInstructions') ?? '',
    profiles: publicProfiles,
    encryptionAvailable: encryptionAvailable(),
  }
}

export function configureAi(input: AiConfigure): AiSettings {
  const baseURL = canonicalAiURL(input.provider, input.baseURL)
  const profiles = settings.get('profiles')
  const previous = profiles[input.provider] ?? {
    baseURL: AI_DEFAULT_URLS[input.provider],
    model: '',
  }
  const profile: SavedProfile = { baseURL, model: input.model }
  if (input.apiKey === undefined && previous.baseURL === baseURL) {
    profile.encryptedKey = previous.encryptedKey
    profile.models = previous.models
  }
  if (typeof input.apiKey === 'string') {
    if (!encryptionAvailable())
      throw new AiError('encryptionUnavailable')
    profile.encryptedKey = safeStorage
      .encryptString(input.apiKey)
      .toString('base64')
  }
  settings.set('profiles', { ...profiles, [input.provider]: profile })
  settings.set('provider', input.provider)
  if (input.userInstructions !== undefined)
    settings.set('userInstructions', input.userInstructions)
  return getAiSettings()
}

export function getAiConnection() {
  const provider = settings.get('provider')
  const profile = settings.get('profiles')[provider] ?? {
    baseURL: AI_DEFAULT_URLS[provider],
    model: '',
  }
  const baseURL = canonicalAiURL(provider, profile.baseURL)
  const apiKey = decrypt(profile)
  if ((profile.encryptedKey || !isLocalAiProvider(provider)) && !apiKey)
    throw new AiError('keyUnavailable')
  return {
    provider,
    baseURL,
    model: profile.model,
    apiKey,
    userInstructions: settings.get('userInstructions') ?? '',
  }
}

export function rememberAiModels(
  connection: { provider: AiProvider, baseURL: string, apiKey?: string },
  models: string[],
) {
  const profiles = settings.get('profiles')
  const profile = profiles[connection.provider]
  // A request completing after a credential/endpoint change must not restore
  // the old account's catalog. Model selection alone does not invalidate it.
  if (
    !profile
    || profile.baseURL !== connection.baseURL
    || decrypt(profile) !== connection.apiKey
  ) {
    return
  }
  settings.set('profiles', {
    ...profiles,
    [connection.provider]: { ...profile, models },
  })
}
