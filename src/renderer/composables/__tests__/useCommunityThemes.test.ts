import type {
  CommunityThemeInstalledMeta,
  CommunityThemesCache,
  CommunityThemesStoreState,
} from '~/main/store/types/theme'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import {
  computeSha256,
  createCommunityThemesService,
} from '~/main/themes/community'

Object.assign(globalThis, { ref, computed })

const COMMIT_V1 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const COMMIT_V2 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

const THEME_A_V1 = `{
  "name": "Theme A",
  "author": "alice",
  "authorUrl": "https://github.com/alice",
  "type": "dark",
  "colors": {
    "background": "#101018",
    "card": "#181824",
    "foreground": "#e0e0f0",
    "primary": "#7aa2f7",
    "border": "#2a2a3c"
  }
}
`

const THEME_A_V2 = `{
  "name": "Theme A",
  "author": "alice",
  "authorUrl": "https://github.com/alice",
  "type": "dark",
  "colors": {
    "background": "#101018",
    "card": "#181824",
    "foreground": "#ffffff",
    "primary": "#7dcfff",
    "border": "#2a2a3c"
  }
}
`

const THEME_B_V1 = `{
  "name": "Theme B",
  "author": "bob",
  "authorUrl": "https://github.com/bob",
  "type": "light",
  "colors": {
    "background": "#fafafa",
    "card": "#f0f0f0",
    "foreground": "#202020",
    "primary": "#2563eb",
    "border": "#d4d4d8"
  }
}
`

const SHA_A_V1 = computeSha256(THEME_A_V1)
const SHA_A_V2 = computeSha256(THEME_A_V2)
const SHA_B_V1 = computeSha256(THEME_B_V1)

describe('community themes end-to-end flow (install A -> switch B -> update A -> modify A -> cancel/confirm uninstall)', () => {
  let themesDir: string
  let storeState: CommunityThemesStoreState
  let activeThemeId: string
  let registryVersion: 1 | 2

  beforeEach(() => {
    themesDir = mkdtempSync(path.join(tmpdir(), 'masscode-community-e2e-'))
    storeState = { cache: null, installed: {} }
    activeThemeId = 'auto'
    registryVersion = 1
  })

  afterEach(() => {
    rmSync(themesDir, { recursive: true, force: true })
    vi.resetModules()
  })

  it('preserves active theme B on updating A, protects modified A on cancelled uninstall, and removes on confirmed uninstall', async () => {
    const service = createCommunityThemesService({
      themesDir,
      registryUrl:
        'https://raw.githubusercontent.com/massCodeIO/masscode-themes/main/registry.json',
      rawBaseUrl:
        'https://raw.githubusercontent.com/massCodeIO/masscode-themes',
      cacheTtlMs: 30 * 60 * 1000,
      now: () => 1_700_000_000_000,
      fetchFn: vi.fn<typeof fetch>(async (input) => {
        const url = String(input)
        if (url.includes('/registry.json')) {
          const commit = registryVersion === 1 ? COMMIT_V1 : COMMIT_V2
          const shaA = registryVersion === 1 ? SHA_A_V1 : SHA_A_V2
          return new Response(
            JSON.stringify({
              schemaVersion: 1,
              commit,
              generatedAt: '2026-11-23T00:00:00.000Z',
              themes: [
                {
                  id: 'theme-a',
                  name: 'Theme A',
                  author: 'alice',
                  authorUrl: 'https://github.com/alice',
                  type: 'dark',
                  file: 'themes/theme-a.json',
                  sha256: shaA,
                },
                {
                  id: 'theme-b',
                  name: 'Theme B',
                  author: 'bob',
                  authorUrl: 'https://github.com/bob',
                  type: 'light',
                  file: 'themes/theme-b.json',
                  sha256: SHA_B_V1,
                },
              ],
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        }
        if (url.includes(`/${COMMIT_V1}/themes/theme-a.json`)) {
          return new Response(THEME_A_V1, { status: 200 })
        }
        if (url.includes(`/${COMMIT_V2}/themes/theme-a.json`)) {
          return new Response(THEME_A_V2, { status: 200 })
        }
        if (url.includes('/themes/theme-b.json')) {
          return new Response(THEME_B_V1, { status: 200 })
        }
        return new Response('Not Found', { status: 404 })
      }),
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

    const currentThemeIdRef = ref(activeThemeId)
    const setThemeMock = vi.fn(async (id: string) => {
      activeThemeId = id
      currentThemeIdRef.value = id
    })
    const loadCustomThemesMock = vi.fn(async () => {})

    vi.doMock('@/composables/useTheme', () => ({
      useTheme: () => ({
        currentThemeId: currentThemeIdRef,
        loadCustomThemes: loadCustomThemesMock,
        setTheme: setThemeMock,
      }),
    }))
    vi.doMock('@/composables/useSonner', () => ({
      useSonner: () => ({ sonner: vi.fn() }),
    }))
    vi.doMock('@/electron', () => ({
      i18n: { t: (key: string) => key },
      ipc: {
        invoke: vi.fn(async (channel: string, payload: any) => {
          if (channel === 'theme:community-list') {
            return service.fetchCommunityThemes(payload ?? {})
          }
          if (channel === 'theme:community-install') {
            return service.installCommunityTheme(payload)
          }
          if (channel === 'theme:community-uninstall') {
            return service.uninstallCommunityTheme(payload)
          }
          return null
        }),
      },
    }))

    const { useCommunityThemes } = await import('../useCommunityThemes')
    const gallery = useCommunityThemes()

    // 1. Load catalog and install Theme A -> A becomes active
    await gallery.loadCatalog(true)
    const themeA = gallery.items.value.find(item => item.id === 'theme-a')!
    const themeB = gallery.items.value.find(item => item.id === 'theme-b')!
    await gallery.installTheme(themeA)
    expect(currentThemeIdRef.value).toBe('theme-a')
    expect(readFileSync(path.join(themesDir, 'theme-a.json'), 'utf8')).toBe(
      THEME_A_V1,
    )

    // 2. Install & switch to Theme B -> B becomes active
    await gallery.installTheme(themeB)
    expect(currentThemeIdRef.value).toBe('theme-b')

    // 3. New version of Theme A published -> refresh & update A -> B stays active!
    registryVersion = 2
    await gallery.loadCatalog(true)
    const themeAUpdated = gallery.items.value.find(
      item => item.id === 'theme-a',
    )!
    expect(themeAUpdated.status).toBe('update-available')

    await gallery.updateTheme(themeAUpdated)
    expect(currentThemeIdRef.value).toBe('theme-b')
    expect(readFileSync(path.join(themesDir, 'theme-a.json'), 'utf8')).toBe(
      THEME_A_V2,
    )

    // 4. User manually edits Theme A -> requests uninstall -> cancels -> file is preserved
    const themeAPath = path.join(themesDir, 'theme-a.json')
    const userEditedA = `${THEME_A_V2}\n`
    writeFileSync(themeAPath, userEditedA, 'utf8')

    await gallery.uninstallTheme(themeAUpdated)
    expect(gallery.pendingConflict.value).toEqual({
      action: 'uninstall',
      themeId: 'theme-a',
      themeName: 'Theme A',
      reason: 'locally-modified',
      localSha256: computeSha256(userEditedA),
    })

    gallery.cancelPendingConflict()
    expect(gallery.pendingConflict.value).toBeNull()
    expect(existsSync(themeAPath)).toBe(true)
    expect(readFileSync(themeAPath, 'utf8')).toBe(userEditedA)

    // 5. Request uninstall again and confirm -> file removed and Theme A returns to available
    await gallery.uninstallTheme(themeAUpdated)
    expect(gallery.pendingConflict.value).not.toBeNull()
    await gallery.confirmPendingConflict()
    expect(existsSync(themeAPath)).toBe(false)
    expect(
      gallery.items.value.find(item => item.id === 'theme-a')?.status,
    ).toBe('available')
  })
})
