import type { AiConfigure, AiProvider, AiSettings } from '../../shared/ai'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import { safeStorage } from 'electron'
import Store from 'electron-store'
import { AI_DEFAULT_URLS } from '../../shared/ai'
import { isSafeStorageUsable } from '../store/module/httpSecretsAvailability'
import { AiError } from './errors'

interface SavedProfile {
  baseURL: string
  model: string
  encryptedKey?: string
}
interface SavedSettings {
  provider: AiProvider
  profiles: Record<AiProvider, SavedProfile>
}
const settings = new Store<SavedSettings>({
  name: 'ai-settings',
  cwd: 'v2',
  defaults: {
    provider: 'openai',
    profiles: {
      openai: { baseURL: AI_DEFAULT_URLS.openai, model: '' },
      ollama: { baseURL: AI_DEFAULT_URLS.ollama, model: '' },
      lmstudio: { baseURL: AI_DEFAULT_URLS.lmstudio, model: '' },
    },
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
    if (provider === 'openai' && canonical !== AI_DEFAULT_URLS.openai)
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
  for (const provider of ['openai', 'ollama', 'lmstudio'] as const) {
    const profile = profiles[provider]
    publicProfiles[provider] = {
      baseURL: profile.baseURL,
      model: profile.model,
      hasKey: Boolean(decrypt(profile)),
      hasStoredKey: Boolean(profile.encryptedKey),
    }
  }
  return {
    provider: settings.get('provider'),
    profiles: publicProfiles,
    encryptionAvailable: encryptionAvailable(),
  }
}

export function configureAi(input: AiConfigure): AiSettings {
  const baseURL = canonicalAiURL(input.provider, input.baseURL)
  const profiles = settings.get('profiles')
  const previous = profiles[input.provider]
  const profile: SavedProfile = { baseURL, model: input.model }
  if (input.apiKey === undefined && previous.baseURL === baseURL)
    profile.encryptedKey = previous.encryptedKey
  if (typeof input.apiKey === 'string') {
    if (!encryptionAvailable())
      throw new AiError('encryptionUnavailable')
    profile.encryptedKey = safeStorage
      .encryptString(input.apiKey)
      .toString('base64')
  }
  settings.set('profiles', { ...profiles, [input.provider]: profile })
  settings.set('provider', input.provider)
  return getAiSettings()
}

export function getAiConnection() {
  const provider = settings.get('provider')
  const profile = settings.get('profiles')[provider]
  const baseURL = canonicalAiURL(provider, profile.baseURL)
  const apiKey = decrypt(profile)
  if ((profile.encryptedKey || provider === 'openai') && !apiKey)
    throw new AiError('keyUnavailable')
  return { provider, baseURL, model: profile.model, apiKey }
}
