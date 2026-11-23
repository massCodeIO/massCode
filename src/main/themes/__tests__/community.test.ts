import type {
  CommunityThemeInstalledMeta,
  CommunityThemesCache,
  CommunityThemesStoreState,
} from '../../store/types/theme'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  computeSha256,
  createCommunityThemesService,
  isValidCommunityThemeId,
  isValidCssColor,
  validateCommunityThemeJson,
} from '../community'

const COMMIT_V1 = '1111111111111111111111111111111111111111'
const COMMIT_V2 = '2222222222222222222222222222222222222222'

const THEME_A_V1_RAW = `{
  "name": "Tokyo Night",
  "author": "massCodeIO",
  "authorUrl": "https://github.com/massCodeIO",
  "type": "dark",
  "colors": {
    "background": "#1a1b26",
    "card": "#16161e",
    "foreground": "#c0caf5",
    "primary": "#7aa2f7",
    "border": "#292e42"
  }
}
`

const THEME_A_V2_RAW = `{
  "name": "Tokyo Night",
  "author": "massCodeIO",
  "authorUrl": "https://github.com/massCodeIO",
  "type": "dark",
  "colors": {
    "background": "#1a1b26",
    "card": "#16161e",
    "foreground": "#d5ddf8",
    "primary": "#7dcfff",
    "border": "#292e42"
  }
}
`

const THEME_A_V1_SHA = computeSha256(THEME_A_V1_RAW)
const THEME_A_V2_SHA = computeSha256(THEME_A_V2_RAW)

function makeRegistry(commit: string, themes: unknown[]) {
  return {
    schemaVersion: 1,
    commit,
    generatedAt: '2026-11-23T00:00:00.000Z',
    themes,
  }
}

function makeTokyoEntry(sha256: string) {
  return {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    author: 'massCodeIO',
    authorUrl: 'https://github.com/massCodeIO',
    type: 'dark' as const,
    file: 'themes/tokyo-night.json',
    sha256,
    preview: {
      background: '#1a1b26',
      card: '#16161e',
      foreground: '#c0caf5',
      primary: '#7aa2f7',
      border: '#292e42',
    },
  }
}

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function makeRawResponse(body: string, status = 200): Response {
  return new Response(body, { status })
}

describe('communityThemesService', () => {
  let themesDir: string
  let storeState: CommunityThemesStoreState
  let currentTime: number

  beforeEach(() => {
    themesDir = mkdtempSync(path.join(tmpdir(), 'masscode-community-themes-'))
    storeState = { cache: null, installed: {} }
    currentTime = 1_700_000_000_000
  })

  afterEach(() => {
    rmSync(themesDir, { recursive: true, force: true })
  })

  function createService(fetchFn: typeof fetch) {
    return createCommunityThemesService({
      themesDir,
      registryUrl:
        'https://raw.githubusercontent.com/massCodeIO/masscode-themes/main/registry.json',
      rawBaseUrl:
        'https://raw.githubusercontent.com/massCodeIO/masscode-themes',
      cacheTtlMs: 30 * 60 * 1000,
      fetchFn,
      now: () => currentTime,
      storeAdapter: {
        getState: () => ({
          cache: storeState.cache,
          installed: { ...storeState.installed },
        }),
        setCache: (cache: CommunityThemesCache | null) => {
          storeState.cache = cache
        },
        setInstalled: (
          installed: Record<string, CommunityThemeInstalledMeta>,
        ) => {
          storeState.installed = { ...installed }
        },
      },
    })
  }

  it('uses fresh TTL cache with isOfflineFallback=false and refreshes on forceRefresh', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () =>
        makeJsonResponse(
          makeRegistry(COMMIT_V1, [makeTokyoEntry(THEME_A_V1_SHA)]),
        ),
      )
    const service = createService(fetchMock)

    const live = await service.fetchCommunityThemes()
    expect(live.source).toBe('live')
    expect(live.isOfflineFallback).toBe(false)
    expect(live.items).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Within TTL -> returns cache without network and without offline flag
    currentTime += 5 * 60 * 1000
    const cached = await service.fetchCommunityThemes()
    expect(cached.source).toBe('cache')
    expect(cached.isOfflineFallback).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Force refresh hits network
    const refreshed = await service.fetchCommunityThemes({
      forceRefresh: true,
    })
    expect(refreshed.source).toBe('live')
    expect(refreshed.isOfflineFallback).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('falls back to cache with isOfflineFallback=true on network error, and shows installed themes as non-delisted when unavailable without cache', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('offline'))
    const service = createService(fetchMock)

    // Pre-existing installed theme on disk with no cache
    const filePath = path.join(themesDir, 'tokyo-night.json')
    writeFileSync(filePath, THEME_A_V1_RAW, 'utf8')
    storeState.installed['tokyo-night'] = {
      sha256: THEME_A_V1_SHA,
      installedAt: currentTime - 1000,
    }

    const unavailable = await service.fetchCommunityThemes()
    expect(unavailable.source).toBe('unavailable')
    expect(unavailable.isOfflineFallback).toBe(true)
    expect(unavailable.items).toHaveLength(1)
    expect(unavailable.items[0].id).toBe('tokyo-night')
    expect(unavailable.items[0].status).toBe('installed')
    expect(unavailable.items[0].isDelisted).toBe(false)
    expect(unavailable.items[0].registry).toBeUndefined()

    // With stale cache -> returns cache with isOfflineFallback=true
    storeState.cache = {
      commit: COMMIT_V1,
      fetchedAt: currentTime - 60 * 60 * 1000,
      themes: [makeTokyoEntry(THEME_A_V1_SHA)],
    }

    const stale = await service.fetchCommunityThemes()
    expect(stale.source).toBe('cache')
    expect(stale.isOfflineFallback).toBe(true)
    expect(stale.items[0].isDelisted).toBe(false)
    expect(stale.items[0].registry?.sha256).toBe(THEME_A_V1_SHA)
  })

  it('downloads by pinned commit SHA and writes exact raw verified bytes without re-serialization', async () => {
    const requestedUrls: string[] = []
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input)
      requestedUrls.push(url)
      if (url.endsWith('/registry.json')) {
        return makeJsonResponse(
          makeRegistry(COMMIT_V1, [makeTokyoEntry(THEME_A_V1_SHA)]),
        )
      }
      return makeRawResponse(THEME_A_V1_RAW)
    })

    const service = createService(fetchMock)
    await service.fetchCommunityThemes()
    const res = await service.installCommunityTheme({ id: 'tokyo-night' })

    expect(res).toEqual({ status: 'installed' })
    expect(requestedUrls[1]).toBe(
      `https://raw.githubusercontent.com/massCodeIO/masscode-themes/${COMMIT_V1}/themes/tokyo-night.json`,
    )

    // Raw bytes preserved identically
    const diskContent = readFileSync(
      path.join(themesDir, 'tokyo-night.json'),
      'utf8',
    )
    expect(diskContent).toBe(THEME_A_V1_RAW)

    // Subsequent status check reports no local modifications
    const catalog = await service.fetchCommunityThemes()
    expect(catalog.items[0].status).toBe('installed')
    expect(catalog.items[0].hasLocalModifications).toBe(false)
  })

  it('rejects update on SHA-256 mismatch and preserves existing file and installed metadata', async () => {
    const filePath = path.join(themesDir, 'tokyo-night.json')
    writeFileSync(filePath, THEME_A_V1_RAW, 'utf8')
    storeState.installed['tokyo-night'] = {
      sha256: THEME_A_V1_SHA,
      installedAt: currentTime - 5000,
    }
    storeState.cache = {
      commit: COMMIT_V2,
      fetchedAt: currentTime,
      themes: [makeTokyoEntry(THEME_A_V2_SHA)],
    }

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(makeRawResponse('{"tampered": true}'))
    const service = createService(fetchMock)

    await expect(
      service.installCommunityTheme({ id: 'tokyo-night' }),
    ).rejects.toThrow(/SHA-256 mismatch/)

    expect(readFileSync(filePath, 'utf8')).toBe(THEME_A_V1_RAW)
    expect(storeState.installed['tokyo-night'].sha256).toBe(THEME_A_V1_SHA)
  })

  it('enforces reserved IDs, bans legacy tokens, and validates CSS color values', () => {
    expect(isValidCommunityThemeId('light')).toBe(false)
    expect(isValidCommunityThemeId('dark')).toBe(false)
    expect(isValidCommunityThemeId('auto')).toBe(false)
    expect(isValidCommunityThemeId('../evil')).toBe(false)
    expect(isValidCommunityThemeId('tokyo-night')).toBe(true)

    expect(isValidCssColor('#1a1b26')).toBe(true)
    expect(isValidCssColor('hsl(221, 89%, 72%)')).toBe(true)
    expect(isValidCssColor('hsla(221, 89%, 72%, 0.5)')).toBe(true)
    expect(isValidCssColor('red; } body { display: none;')).toBe(false)
    expect(isValidCssColor('url(javascript:alert(1))')).toBe(false)

    expect(() =>
      validateCommunityThemeJson(
        JSON.stringify({
          name: 'Legacy',
          type: 'dark',
          colors: {
            'background': '#000',
            'card': '#111',
            'foreground': '#fff',
            'primary': '#0af',
            'border': '#222',
            'color-bg': '#000',
          },
        }),
      ),
    ).toThrow(/forbidden legacy token/)
  })

  it('detects untracked conflict, TOCTOU edits during download, and rejects stale expectedLocalSha256 even if file reverts to original', async () => {
    const filePath = path.join(themesDir, 'tokyo-night.json')
    const customLocal = '{"name": "My Local", "type": "dark"}\n'
    writeFileSync(filePath, customLocal, 'utf8')
    const customLocalSha = computeSha256(customLocal)

    storeState.cache = {
      commit: COMMIT_V1,
      fetchedAt: currentTime,
      themes: [makeTokyoEntry(THEME_A_V1_SHA)],
    }

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(makeRawResponse(THEME_A_V1_RAW))
    const service = createService(fetchMock)

    // 1. Untracked file conflict
    const conflict = await service.installCommunityTheme({ id: 'tokyo-night' })
    expect(conflict).toEqual({
      status: 'conflict',
      reason: 'untracked-file',
      localSha256: customLocalSha,
    })

    // 2. TOCTOU: user edits file during download
    const toctouFetch = vi.fn<typeof fetch>(async () => {
      writeFileSync(
        filePath,
        '{"name": "Edited During Download", "type": "dark"}\n',
        'utf8',
      )
      return makeRawResponse(THEME_A_V1_RAW)
    })
    const toctouService = createService(toctouFetch)
    const toctouResult = await toctouService.installCommunityTheme({
      id: 'tokyo-night',
      expectedLocalSha256: customLocalSha,
    })
    expect(toctouResult.status).toBe('conflict')
    expect(toctouResult.localSha256).not.toBe(customLocalSha)

    // 3. Confirming with latest sha succeeds
    const confirmed = await service.installCommunityTheme({
      id: 'tokyo-night',
      expectedLocalSha256: toctouResult.localSha256,
    })
    expect(confirmed).toEqual({ status: 'installed' })

    // 4. Update available, user edits file -> gets conflict -> user reverts file back to v1 ->
    // passing stale expectedLocalSha256 MUST still return a fresh conflict!
    storeState.cache = {
      commit: COMMIT_V2,
      fetchedAt: currentTime,
      themes: [makeTokyoEntry(THEME_A_V2_SHA)],
    }
    const editedContent = `${THEME_A_V1_RAW}\n`
    writeFileSync(filePath, editedContent, 'utf8')
    const editedSha = computeSha256(editedContent)

    const updateConflict = await service.installCommunityTheme({
      id: 'tokyo-night',
    })
    expect(updateConflict).toEqual({
      status: 'conflict',
      reason: 'locally-modified',
      localSha256: editedSha,
    })

    // User reverts file back to original v1 while dialog is open
    writeFileSync(filePath, THEME_A_V1_RAW, 'utf8')

    const staleConfirm = await service.installCommunityTheme({
      id: 'tokyo-night',
      expectedLocalSha256: editedSha,
    })
    expect(staleConfirm).toEqual({
      status: 'conflict',
      reason: 'locally-modified',
      localSha256: THEME_A_V1_SHA,
    })
  })

  it('safely refuses uninstalling unmanaged files and enforces expectedLocalSha256 on modified or reverted files', async () => {
    const filePath = path.join(themesDir, 'tokyo-night.json')
    writeFileSync(filePath, THEME_A_V1_RAW, 'utf8')

    const service = createService(vi.fn<typeof fetch>())

    // 1. Unmanaged file -> refused
    const unmanaged = await service.uninstallCommunityTheme({
      id: 'tokyo-night',
    })
    expect(unmanaged).toEqual({ status: 'not-managed' })
    expect(readFileSync(filePath, 'utf8')).toBe(THEME_A_V1_RAW)

    // 2. Managed & modified -> returns conflict with sha
    storeState.installed['tokyo-night'] = {
      sha256: THEME_A_V1_SHA,
      installedAt: currentTime,
    }
    const edited = `${THEME_A_V1_RAW} `
    writeFileSync(filePath, edited, 'utf8')
    const editedSha = computeSha256(edited)

    const modConflict = await service.uninstallCommunityTheme({
      id: 'tokyo-night',
    })
    expect(modConflict).toEqual({
      status: 'conflict',
      reason: 'locally-modified',
      localSha256: editedSha,
    })

    // 3. File reverted while dialog open -> stale expectedLocalSha256 still returns conflict
    writeFileSync(filePath, THEME_A_V1_RAW, 'utf8')
    const revertedConflict = await service.uninstallCommunityTheme({
      id: 'tokyo-night',
      expectedLocalSha256: editedSha,
    })
    expect(revertedConflict).toEqual({
      status: 'conflict',
      reason: 'locally-modified',
      localSha256: THEME_A_V1_SHA,
    })

    // 4. Confirming with current sha deletes file and removes installed record
    const deleted = await service.uninstallCommunityTheme({
      id: 'tokyo-night',
      expectedLocalSha256: THEME_A_V1_SHA,
    })
    expect(deleted).toEqual({ status: 'uninstalled' })
    expect(storeState.installed['tokyo-night']).toBeUndefined()
  })

  it('marks installed themes absent from loaded catalog as isDelisted=true with derived preview', async () => {
    const filePath = path.join(themesDir, 'tokyo-night.json')
    writeFileSync(filePath, THEME_A_V1_RAW, 'utf8')
    storeState.installed['tokyo-night'] = {
      sha256: THEME_A_V1_SHA,
      installedAt: currentTime - 1000,
    }

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(makeJsonResponse(makeRegistry(COMMIT_V2, [])))
    const service = createService(fetchMock)

    const catalog = await service.fetchCommunityThemes()
    expect(catalog.source).toBe('live')
    expect(catalog.items).toHaveLength(1)
    expect(catalog.items[0].id).toBe('tokyo-night')
    expect(catalog.items[0].isDelisted).toBe(true)
    expect(catalog.items[0].registry).toBeUndefined()
    expect(catalog.items[0].preview?.primary).toBe('#7aa2f7')
  })

  it('reconciles exact SHA-256 matches on disk into installed while keeping custom files with different SHA-256 as conflicts', async () => {
    // Exact registry bytes on disk, but installed metadata was reset/missing
    writeFileSync(
      path.join(themesDir, 'tokyo-night.json'),
      THEME_A_V1_RAW,
      'utf8',
    )
    storeState.installed = {}

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        makeJsonResponse(
          makeRegistry(COMMIT_V1, [makeTokyoEntry(THEME_A_V1_SHA)]),
        ),
      )
    const service = createService(fetchMock)

    const catalog = await service.fetchCommunityThemes()
    expect(catalog.items[0].status).toBe('installed')
    expect(catalog.items[0].hasLocalConflict).toBe(false)
    expect(storeState.installed['tokyo-night']?.sha256).toBe(THEME_A_V1_SHA)

    // Custom file with different SHA-256 must NOT be reconciled
    writeFileSync(
      path.join(themesDir, 'tokyo-night.json'),
      '{"name":"Custom","type":"dark"}\n',
      'utf8',
    )
    storeState.installed = {}
    const catalog2 = await service.fetchCommunityThemes()
    expect(catalog2.items[0].status).toBe('available')
    expect(catalog2.items[0].hasLocalConflict).toBe(true)
    expect(storeState.installed['tokyo-night']).toBeUndefined()
  })

  it('prepares a prefilled GitHub Web submission URL for valid local themes and rejects invalid ones', () => {
    const service = createService(vi.fn<typeof fetch>())

    // Valid template with empty author/authorUrl and $schema
    writeFileSync(
      path.join(themesDir, 'My Custom Theme.json'),
      JSON.stringify({
        $schema: 'https://example.com/schema.json',
        name: 'My Custom Theme',
        author: '',
        authorUrl: '',
        type: 'dark',
        colors: {
          background: '#1a1b26',
          card: '#16161e',
          foreground: '#c0caf5',
          primary: '#7aa2f7',
          border: '#292e42',
        },
      }),
      'utf8',
    )

    const valid = service.prepareCommunityThemeSubmission('My Custom Theme')
    expect(valid.ok).toBe(true)
    if (valid.ok) {
      expect(valid.fileName).toBe('my-custom-theme.json')
      expect(valid.url).toContain(
        'https://github.com/massCodeIO/masscode-themes/new/main/themes?filename=my-custom-theme.json&value=',
      )
      expect(decodeURIComponent(valid.url)).not.toContain('"$schema"')
    }

    // Invalid theme with legacy token -> rejected with clear error
    writeFileSync(
      path.join(themesDir, 'broken.json'),
      JSON.stringify({
        name: 'Broken',
        type: 'dark',
        colors: {
          'background': '#000',
          'card': '#111',
          'foreground': '#fff',
          'primary': '#0af',
          'border': '#222',
          'color-bg': '#000',
        },
      }),
      'utf8',
    )

    const invalid = service.prepareCommunityThemeSubmission('broken')
    expect(invalid.ok).toBe(false)
    if (!invalid.ok) {
      expect(invalid.error).toMatch(/legacy token/i)
    }
  })
})
