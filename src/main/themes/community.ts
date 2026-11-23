import type {
  CommunityThemeConflictReason,
  CommunityThemeEntry,
  CommunityThemeInstalledMeta,
  CommunityThemeInstallPayload,
  CommunityThemeInstallResult,
  CommunityThemeItem,
  CommunityThemePreview,
  CommunityThemesCache,
  CommunityThemesCatalogResult,
  CommunityThemesStoreState,
  CommunityThemeStatus,
  CommunityThemeSubmitResult,
  CommunityThemeUninstallPayload,
  CommunityThemeUninstallResult,
  ThemeFile,
  ThemeType,
} from '../store/types/theme'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import path from 'node:path'
import {
  ensureDirSync,
  existsSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'fs-extra'

export const COMMUNITY_THEMES_REPO = 'massCodeIO/masscode-themes'
export const COMMUNITY_THEMES_REGISTRY_URL = `https://raw.githubusercontent.com/${COMMUNITY_THEMES_REPO}/main/registry.json`
export const COMMUNITY_THEMES_SCHEMA_URL = `https://raw.githubusercontent.com/${COMMUNITY_THEMES_REPO}/main/schema/theme.schema.json`
export const COMMUNITY_THEMES_NEW_FILE_URL = `https://github.com/${COMMUNITY_THEMES_REPO}/new/main/themes`
export const COMMUNITY_THEMES_CACHE_TTL_MS = 1000 * 60 * 30
const FETCH_TIMEOUT_MS = 10_000
const THEME_FILE_EXT = '.json'

export const RESERVED_THEME_IDS = new Set(['light', 'dark', 'auto'])

export const LEGACY_COLOR_TOKENS = new Set([
  'color-primary',
  'color-bg',
  'color-fg',
  'color-text',
  'color-text-muted',
  'color-border',
  'color-button',
  'color-button-hover',
  'color-list-selection',
  'color-list-selection-fg',
  'color-scrollbar',
])

const REQUIRED_COLOR_KEYS = [
  'background',
  'foreground',
  'primary',
  'card',
  'border',
] as const

const THEME_ID_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const CSS_TOKEN_REGEX = /^[a-z0-9-]+$/i
const COMMIT_SHA_REGEX = /^[0-9a-f]{40}$/i
const SHA256_REGEX = /^[0-9a-f]{64}$/i
const GITHUB_URL_REGEX = /^https:\/\/github\.com\/[\w.-]+(?:\/[\w.-]+)?\/?$/
const HEX_COLOR_REGEX
  = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const FUNC_COLOR_REGEX = /^(?:rgba?|hsla?|oklch)\([0-9.%\s,/+deg-]+\)$/i

export interface CommunityThemesStoreAdapter {
  getState: () => CommunityThemesStoreState
  setCache: (cache: CommunityThemesCache | null) => void
  setInstalled: (
    installed: Record<string, CommunityThemeInstalledMeta>,
  ) => void
}

export interface CommunityThemesServiceDeps {
  themesDir: string
  registryUrl: string
  rawBaseUrl: string
  cacheTtlMs: number
  fetchFn: typeof fetch
  now: () => number
  storeAdapter: CommunityThemesStoreAdapter
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isThemeType(value: unknown): value is ThemeType {
  return value === 'light' || value === 'dark'
}

export function isValidCssColor(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }

  const trimmed = value.trim()

  if (!trimmed || trimmed.length > 80) {
    return false
  }

  if (/[;{}\r\n]|url\(|expression\(|@import/i.test(trimmed)) {
    return false
  }

  return HEX_COLOR_REGEX.test(trimmed) || FUNC_COLOR_REGEX.test(trimmed)
}

export function isValidCommunityThemeId(id: string): boolean {
  return THEME_ID_REGEX.test(id) && !RESERVED_THEME_IDS.has(id)
}

export function computeSha256(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex')
}

function resolveThemeFilePath(themesDir: string, id: string): string | null {
  if (!isValidCommunityThemeId(id)) {
    return null
  }

  const filePath = path.resolve(themesDir, `${id}${THEME_FILE_EXT}`)
  const relative = path.relative(themesDir, filePath)

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null
  }

  return filePath
}

function validatePreview(raw: unknown): CommunityThemePreview | undefined {
  if (!isRecord(raw)) {
    return undefined
  }

  const background = isValidCssColor(raw.background)
    ? raw.background.trim()
    : ''
  const card = isValidCssColor(raw.card) ? raw.card.trim() : ''
  const foreground = isValidCssColor(raw.foreground)
    ? raw.foreground.trim()
    : ''
  const primary = isValidCssColor(raw.primary) ? raw.primary.trim() : ''
  const border = isValidCssColor(raw.border) ? raw.border.trim() : ''

  if (!background || !card || !foreground || !primary || !border) {
    return undefined
  }

  return {
    background,
    card,
    foreground,
    primary,
    border,
    ...(isValidCssColor(raw.accent) ? { accent: raw.accent.trim() } : {}),
    ...(isValidCssColor(raw.keyword) ? { keyword: raw.keyword.trim() } : {}),
    ...(isValidCssColor(raw.string) ? { string: raw.string.trim() } : {}),
    ...(isValidCssColor(raw.comment) ? { comment: raw.comment.trim() } : {}),
  }
}

function derivePreviewFromThemeFile(
  theme: ThemeFile,
): Partial<CommunityThemePreview> | undefined {
  const preview: Partial<CommunityThemePreview> = {}
  const colors = theme.colors
  const editorColors = theme.editorColors

  if (colors) {
    if (isValidCssColor(colors.background))
      preview.background = colors.background.trim()
    if (isValidCssColor(colors.card))
      preview.card = colors.card.trim()
    if (isValidCssColor(colors.foreground))
      preview.foreground = colors.foreground.trim()
    if (isValidCssColor(colors.primary))
      preview.primary = colors.primary.trim()
    if (isValidCssColor(colors.border))
      preview.border = colors.border.trim()
    if (isValidCssColor(colors.accent))
      preview.accent = colors.accent.trim()
  }

  if (editorColors) {
    if (isValidCssColor(editorColors['editor-keyword']))
      preview.keyword = editorColors['editor-keyword'].trim()
    if (isValidCssColor(editorColors['editor-string']))
      preview.string = editorColors['editor-string'].trim()
    if (isValidCssColor(editorColors['editor-comment']))
      preview.comment = editorColors['editor-comment'].trim()
  }

  return Object.keys(preview).length > 0 ? preview : undefined
}

export function validateCommunityThemeJson(rawText: string): ThemeFile {
  let parsed: unknown

  try {
    parsed = JSON.parse(rawText)
  }
  catch {
    throw new Error('Downloaded theme is not valid JSON')
  }

  if (!isRecord(parsed)) {
    throw new Error('Downloaded theme must be a JSON object')
  }

  if (
    typeof parsed.name !== 'string'
    || !parsed.name.trim()
    || parsed.name.trim().length > 64
  ) {
    throw new Error('Downloaded theme has an invalid name')
  }

  if (!isThemeType(parsed.type)) {
    throw new Error('Downloaded theme has an invalid type')
  }

  if (
    parsed.author !== undefined
    && (typeof parsed.author !== 'string'
      || !parsed.author.trim()
      || parsed.author.trim().length > 64)
  ) {
    throw new Error('Downloaded theme has an invalid author')
  }

  if (
    parsed.authorUrl !== undefined
    && (typeof parsed.authorUrl !== 'string'
      || !GITHUB_URL_REGEX.test(parsed.authorUrl.trim()))
  ) {
    throw new Error('Downloaded theme has an invalid authorUrl')
  }

  if (!isRecord(parsed.colors)) {
    throw new Error('Downloaded theme is missing colors')
  }

  for (const requiredKey of REQUIRED_COLOR_KEYS) {
    if (!(requiredKey in parsed.colors)) {
      throw new Error(
        `Downloaded theme is missing required color "${requiredKey}"`,
      )
    }
  }

  const colors: Record<string, string> = {}
  for (const [key, value] of Object.entries(parsed.colors)) {
    if (!CSS_TOKEN_REGEX.test(key)) {
      throw new Error(`Downloaded theme has invalid color token "${key}"`)
    }
    if (LEGACY_COLOR_TOKENS.has(key)) {
      throw new Error(`Downloaded theme uses forbidden legacy token "${key}"`)
    }
    if (!isValidCssColor(value)) {
      throw new Error(`Downloaded theme has invalid color value for "${key}"`)
    }
    colors[key] = value.trim()
  }

  let editorColors: Record<string, string> | undefined
  if (parsed.editorColors !== undefined) {
    if (!isRecord(parsed.editorColors)) {
      throw new Error('Downloaded theme has invalid editorColors')
    }
    editorColors = {}
    for (const [key, value] of Object.entries(parsed.editorColors)) {
      if (!key.startsWith('editor-') || !CSS_TOKEN_REGEX.test(key)) {
        throw new Error(`Downloaded theme has invalid editor token "${key}"`)
      }
      if (!isValidCssColor(value)) {
        throw new Error(
          `Downloaded theme has invalid editor color value for "${key}"`,
        )
      }
      editorColors[key] = value.trim()
    }
  }

  return {
    name: parsed.name.trim(),
    ...(typeof parsed.author === 'string'
      ? { author: parsed.author.trim() }
      : {}),
    ...(typeof parsed.authorUrl === 'string'
      ? { authorUrl: parsed.authorUrl.trim() }
      : {}),
    type: parsed.type,
    colors,
    ...(editorColors ? { editorColors } : {}),
  }
}

function parseRegistryResponse(raw: unknown): {
  commit: string
  themes: CommunityThemeEntry[]
} {
  if (!isRecord(raw)) {
    throw new TypeError('Registry response is not a JSON object')
  }

  if (raw.schemaVersion !== 1) {
    throw new Error('Unsupported registry schemaVersion')
  }

  if (typeof raw.commit !== 'string' || !COMMIT_SHA_REGEX.test(raw.commit)) {
    throw new Error('Registry response has an invalid commit SHA')
  }

  if (!Array.isArray(raw.themes)) {
    throw new TypeError('Registry response is missing themes array')
  }

  const themes: CommunityThemeEntry[] = []
  const seenIds = new Set<string>()

  for (const item of raw.themes) {
    if (!isRecord(item)) {
      continue
    }

    if (
      typeof item.id !== 'string'
      || !isValidCommunityThemeId(item.id)
      || seenIds.has(item.id)
      || typeof item.name !== 'string'
      || !item.name.trim()
      || !isThemeType(item.type)
      || typeof item.file !== 'string'
      || item.file !== `themes/${item.id}${THEME_FILE_EXT}`
      || typeof item.sha256 !== 'string'
      || !SHA256_REGEX.test(item.sha256)
    ) {
      continue
    }

    const author
      = typeof item.author === 'string' && item.author.trim()
        ? item.author.trim()
        : undefined
    const authorUrl
      = typeof item.authorUrl === 'string'
        && GITHUB_URL_REGEX.test(item.authorUrl.trim())
        ? item.authorUrl.trim()
        : undefined
    const preview = validatePreview(item.preview)

    seenIds.add(item.id)
    themes.push({
      id: item.id,
      name: item.name.trim(),
      ...(author ? { author } : {}),
      ...(authorUrl ? { authorUrl } : {}),
      type: item.type,
      file: item.file,
      sha256: item.sha256.toLowerCase(),
      ...(preview ? { preview } : {}),
    })
  }

  return {
    commit: raw.commit.toLowerCase(),
    themes,
  }
}

function readLocalThemeMeta(filePath: string): {
  sha256: string
  theme: ThemeFile | null
} | null {
  if (!existsSync(filePath)) {
    return null
  }

  try {
    const buffer = readFileSync(filePath)
    const sha256 = computeSha256(buffer)
    let theme: ThemeFile | null = null

    try {
      const parsed = JSON.parse(buffer.toString('utf8')) as unknown
      if (
        isRecord(parsed)
        && typeof parsed.name === 'string'
        && parsed.name.trim()
        && isThemeType(parsed.type)
      ) {
        theme = {
          name: parsed.name.trim(),
          ...(typeof parsed.author === 'string' && parsed.author.trim()
            ? { author: parsed.author.trim() }
            : {}),
          ...(typeof parsed.authorUrl === 'string'
            && GITHUB_URL_REGEX.test(parsed.authorUrl.trim())
            ? { authorUrl: parsed.authorUrl.trim() }
            : {}),
          type: parsed.type,
          ...(isRecord(parsed.colors)
            ? { colors: parsed.colors as Record<string, string> }
            : {}),
          ...(isRecord(parsed.editorColors)
            ? { editorColors: parsed.editorColors as Record<string, string> }
            : {}),
        }
      }
    }
    catch {
      theme = null
    }

    return { sha256, theme }
  }
  catch {
    return null
  }
}

function toKebabCaseSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function resolveAnyLocalThemeFilePath(
  themesDir: string,
  id: string,
): string | null {
  const normalized = id.trim()
  if (
    !normalized
    || normalized.includes('\0')
    || normalized.includes('/')
    || normalized.includes('\\')
    || normalized === '.'
    || normalized === '..'
  ) {
    return null
  }

  const filePath = path.resolve(themesDir, `${normalized}${THEME_FILE_EXT}`)
  const relative = path.relative(themesDir, filePath)

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null
  }

  return filePath
}

export function createCommunityThemesService(deps: CommunityThemesServiceDeps) {
  function pruneMissingInstalled(
    installed: Record<string, CommunityThemeInstalledMeta>,
  ): Record<string, CommunityThemeInstalledMeta> {
    let changed = false
    const next: Record<string, CommunityThemeInstalledMeta> = {}

    for (const [id, meta] of Object.entries(installed)) {
      const filePath = resolveThemeFilePath(deps.themesDir, id)
      if (!filePath || !existsSync(filePath)) {
        changed = true
        continue
      }
      next[id] = meta
    }

    if (changed) {
      deps.storeAdapter.setInstalled(next)
    }

    return next
  }

  function buildCatalogItems(
    entries: CommunityThemeEntry[],
    installed: Record<string, CommunityThemeInstalledMeta>,
    hasCatalog: boolean,
  ): CommunityThemeItem[] {
    const items: CommunityThemeItem[] = []
    const catalogIds = new Set<string>()
    let reconciledInstalled: Record<
      string,
      CommunityThemeInstalledMeta
    > | null = null

    for (const entry of entries) {
      catalogIds.add(entry.id)
      const filePath = resolveThemeFilePath(deps.themesDir, entry.id)
      const localMeta = filePath ? readLocalThemeMeta(filePath) : null
      let installedMeta = installed[entry.id]

      // If app store metadata was reset or themes folder was synced from another machine,
      // an exact SHA-256 match with the registry file proves it is this exact community theme.
      if (localMeta && !installedMeta && localMeta.sha256 === entry.sha256) {
        installedMeta = {
          sha256: entry.sha256,
          installedAt: deps.now(),
        }
        reconciledInstalled ??= { ...installed }
        reconciledInstalled[entry.id] = installedMeta
      }

      let status: CommunityThemeStatus = 'available'
      let hasLocalConflict = false
      let hasLocalModifications = false

      if (localMeta) {
        if (installedMeta) {
          hasLocalModifications = localMeta.sha256 !== installedMeta.sha256
          status
            = installedMeta.sha256 === entry.sha256
              ? 'installed'
              : 'update-available'
        }
        else {
          hasLocalConflict = true
          status = 'available'
        }
      }

      items.push({
        id: entry.id,
        name: entry.name,
        ...(entry.author ? { author: entry.author } : {}),
        ...(entry.authorUrl ? { authorUrl: entry.authorUrl } : {}),
        type: entry.type,
        ...(entry.preview ? { preview: entry.preview } : {}),
        status,
        hasLocalConflict,
        hasLocalModifications,
        isDelisted: false,
        registry: {
          file: entry.file,
          sha256: entry.sha256,
        },
      })
    }

    // Merge installed community themes not present in remote catalog (delisted or offline without cache)
    for (const [id, installedMeta] of Object.entries(installed)) {
      if (catalogIds.has(id)) {
        continue
      }

      const filePath = resolveThemeFilePath(deps.themesDir, id)
      if (!filePath) {
        continue
      }

      const localMeta = readLocalThemeMeta(filePath)
      if (!localMeta) {
        continue
      }

      const localTheme = localMeta.theme
      const preview = localTheme
        ? derivePreviewFromThemeFile(localTheme)
        : undefined

      items.push({
        id,
        name: localTheme?.name ?? id,
        ...(localTheme?.author ? { author: localTheme.author } : {}),
        ...(localTheme?.authorUrl ? { authorUrl: localTheme.authorUrl } : {}),
        type: localTheme?.type ?? 'dark',
        ...(preview ? { preview } : {}),
        status: 'installed',
        hasLocalConflict: false,
        hasLocalModifications: localMeta.sha256 !== installedMeta.sha256,
        isDelisted: hasCatalog,
      })
    }

    if (reconciledInstalled) {
      deps.storeAdapter.setInstalled(reconciledInstalled)
    }

    items.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    )

    return items
  }

  async function fetchRemoteRegistry(
    bustCdnCache = false,
  ): Promise<CommunityThemesCache> {
    const url = bustCdnCache
      ? `${deps.registryUrl}${deps.registryUrl.includes('?') ? '&' : '?'}t=${deps.now()}`
      : deps.registryUrl

    const response = await deps.fetchFn(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })

    if (!response.ok) {
      throw new Error(`Registry request failed with status ${response.status}`)
    }

    const raw = (await response.json()) as unknown
    const parsed = parseRegistryResponse(raw)
    const cache: CommunityThemesCache = {
      commit: parsed.commit,
      fetchedAt: deps.now(),
      themes: parsed.themes,
    }

    deps.storeAdapter.setCache(cache)

    return cache
  }

  async function fetchCommunityThemes(
    options: { forceRefresh?: boolean } = {},
  ): Promise<CommunityThemesCatalogResult> {
    const state = deps.storeAdapter.getState()
    const installed = pruneMissingInstalled(state.installed)
    const cached = state.cache

    if (
      !options.forceRefresh
      && cached
      && deps.now() - cached.fetchedAt < deps.cacheTtlMs
    ) {
      return {
        items: buildCatalogItems(cached.themes, installed, true),
        fetchedAt: cached.fetchedAt,
        source: 'cache',
        isOfflineFallback: false,
      }
    }

    try {
      const fresh = await fetchRemoteRegistry(Boolean(options.forceRefresh))

      return {
        items: buildCatalogItems(fresh.themes, installed, true),
        fetchedAt: fresh.fetchedAt,
        source: 'live',
        isOfflineFallback: false,
      }
    }
    catch (error) {
      const errorMessage
        = error instanceof Error ? error.message : String(error)

      if (cached) {
        return {
          items: buildCatalogItems(cached.themes, installed, true),
          fetchedAt: cached.fetchedAt,
          source: 'cache',
          isOfflineFallback: true,
          error: errorMessage,
        }
      }

      return {
        items: buildCatalogItems([], installed, false),
        fetchedAt: null,
        source: 'unavailable',
        isOfflineFallback: true,
        error: errorMessage,
      }
    }
  }

  function checkInstallConflict(
    filePath: string,
    id: string,
    installed: Record<string, CommunityThemeInstalledMeta>,
    expectedLocalSha256?: string,
  ): CommunityThemeInstallResult | null {
    const exists = existsSync(filePath)
    const currentLocalSha256 = exists
      ? computeSha256(readFileSync(filePath))
      : undefined
    const installedMeta = installed[id]
    const reason: CommunityThemeConflictReason = installedMeta
      ? 'locally-modified'
      : 'untracked-file'

    // If caller explicitly confirmed a specific local file snapshot,
    // ANY drift (even reverting back to installedMeta.sha256 or deletion)
    // must return a fresh conflict.
    if (expectedLocalSha256 !== undefined) {
      if (!exists || currentLocalSha256 !== expectedLocalSha256) {
        return {
          status: 'conflict',
          reason,
          ...(currentLocalSha256 ? { localSha256: currentLocalSha256 } : {}),
        }
      }

      return null
    }

    if (!exists || !currentLocalSha256) {
      return null
    }

    if (!installedMeta) {
      return {
        status: 'conflict',
        reason: 'untracked-file',
        localSha256: currentLocalSha256,
      }
    }

    if (currentLocalSha256 !== installedMeta.sha256) {
      return {
        status: 'conflict',
        reason: 'locally-modified',
        localSha256: currentLocalSha256,
      }
    }

    return null
  }

  async function installCommunityTheme(
    payload: CommunityThemeInstallPayload,
  ): Promise<CommunityThemeInstallResult> {
    const id = payload.id.trim()
    const filePath = resolveThemeFilePath(deps.themesDir, id)

    if (!filePath) {
      throw new Error(`Invalid community theme ID: "${payload.id}"`)
    }

    ensureDirSync(deps.themesDir)

    let state = deps.storeAdapter.getState()
    let cache = state.cache

    if (!cache) {
      cache = await fetchRemoteRegistry()
      state = deps.storeAdapter.getState()
    }

    const entry = cache.themes.find(item => item.id === id)
    if (!entry) {
      throw new Error(`Theme "${id}" not found in community registry`)
    }

    const initialConflict = checkInstallConflict(
      filePath,
      id,
      state.installed,
      payload.expectedLocalSha256,
    )
    if (initialConflict) {
      return initialConflict
    }

    const themeUrl = `${deps.rawBaseUrl}/${cache.commit}/${entry.file}`
    const response = await deps.fetchFn(themeUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })

    if (!response.ok) {
      throw new Error(`Theme download failed with status ${response.status}`)
    }

    const rawBytes = Buffer.from(await response.arrayBuffer())
    const actualSha256 = computeSha256(rawBytes)

    if (actualSha256 !== entry.sha256) {
      throw new Error(
        `Theme integrity check failed for "${id}" (SHA-256 mismatch)`,
      )
    }

    // Validate parsed JSON against unified contract (forbids legacy tokens & invalid CSS colors)
    validateCommunityThemeJson(rawBytes.toString('utf8'))

    // Re-check conflict right before writing (TOCTOU guard)
    const latestState = deps.storeAdapter.getState()
    const preWriteConflict = checkInstallConflict(
      filePath,
      id,
      latestState.installed,
      payload.expectedLocalSha256,
    )
    if (preWriteConflict) {
      return preWriteConflict
    }

    // Write exact verified raw bytes without re-serializing JSON
    writeFileSync(filePath, rawBytes)

    const nextInstalled: Record<string, CommunityThemeInstalledMeta> = {
      ...latestState.installed,
      [id]: {
        sha256: actualSha256,
        installedAt: deps.now(),
      },
    }
    deps.storeAdapter.setInstalled(nextInstalled)

    return { status: 'installed' }
  }

  async function uninstallCommunityTheme(
    payload: CommunityThemeUninstallPayload,
  ): Promise<CommunityThemeUninstallResult> {
    const id = payload.id.trim()
    const filePath = resolveThemeFilePath(deps.themesDir, id)

    if (!filePath) {
      return { status: 'not-managed' }
    }

    const state = deps.storeAdapter.getState()
    const installedMeta = state.installed[id]

    if (!installedMeta) {
      return { status: 'not-managed' }
    }

    if (existsSync(filePath)) {
      const localSha256 = computeSha256(readFileSync(filePath))

      if (payload.expectedLocalSha256 !== undefined) {
        if (localSha256 !== payload.expectedLocalSha256) {
          return {
            status: 'conflict',
            reason: 'locally-modified',
            localSha256,
          }
        }
      }
      else if (localSha256 !== installedMeta.sha256) {
        return {
          status: 'conflict',
          reason: 'locally-modified',
          localSha256,
        }
      }

      unlinkSync(filePath)
    }
    else if (payload.expectedLocalSha256 !== undefined) {
      return {
        status: 'conflict',
        reason: 'locally-modified',
      }
    }

    const nextInstalled = { ...state.installed }
    delete nextInstalled[id]
    deps.storeAdapter.setInstalled(nextInstalled)

    return { status: 'uninstalled' }
  }

  function prepareCommunityThemeSubmission(
    id: string,
  ): CommunityThemeSubmitResult {
    const filePath = resolveAnyLocalThemeFilePath(deps.themesDir, id)
    if (!filePath || !existsSync(filePath)) {
      return { ok: false, error: 'Theme file not found.' }
    }

    let rawObj: unknown
    try {
      rawObj = JSON.parse(readFileSync(filePath, 'utf8'))
    }
    catch {
      return { ok: false, error: 'Theme file is not valid JSON.' }
    }

    if (!isRecord(rawObj)) {
      return { ok: false, error: 'Theme file must be a JSON object.' }
    }

    // Normalize blank optional template fields before validation
    const cleaned: Record<string, unknown> = { ...rawObj }
    if (typeof cleaned.author === 'string' && !cleaned.author.trim()) {
      delete cleaned.author
    }
    if (typeof cleaned.authorUrl === 'string' && !cleaned.authorUrl.trim()) {
      delete cleaned.authorUrl
    }
    delete cleaned.$schema

    let validated: ThemeFile
    try {
      validated = validateCommunityThemeJson(JSON.stringify(cleaned))
    }
    catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }

    const candidateSlug = isValidCommunityThemeId(id.trim())
      ? id.trim()
      : toKebabCaseSlug(id) || toKebabCaseSlug(validated.name)

    if (!isValidCommunityThemeId(candidateSlug)) {
      return {
        ok: false,
        error: `Theme ID "${candidateSlug || id}" cannot be used for submission (use kebab-case and avoid reserved names light/dark/auto).`,
      }
    }

    const fileName = `${candidateSlug}${THEME_FILE_EXT}`
    const formattedJson = `${JSON.stringify(validated, null, 2)}\n`
    const url = `${COMMUNITY_THEMES_NEW_FILE_URL}?filename=${encodeURIComponent(fileName)}&value=${encodeURIComponent(formattedJson)}`

    return {
      ok: true,
      fileName,
      url,
    }
  }

  return {
    fetchCommunityThemes,
    installCommunityTheme,
    uninstallCommunityTheme,
    prepareCommunityThemeSubmission,
  }
}
