import type { ThemeFile, ThemeListItem } from '~/main/store/types/theme'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref, watch } from 'vue'

Object.assign(globalThis, { ref, computed, watch })

const LATTE_THEME: ThemeFile = {
  name: 'Catppuccin Latte',
  type: 'light',
  colors: { background: '#eff1f5', primary: '#8839ef' },
  editorColors: { 'editor-keyword': '#8839ef' },
}

const MOCHA_THEME: ThemeFile = {
  name: 'Catppuccin Mocha',
  type: 'dark',
  colors: { background: '#1e1e2e', primary: '#cba6f7' },
  editorColors: { 'editor-keyword': '#cba6f7' },
}

describe('useTheme system light/dark custom theme pairs', () => {
  let styleText: string | null
  let prefState: Record<string, string>
  let installedList: ThemeListItem[]
  let themeFiles: Record<string, ThemeFile>
  let colorModeValue: ReturnType<typeof ref<'light' | 'dark'>>
  let colorModeStore: ReturnType<typeof ref<'light' | 'dark' | 'auto'>>
  let themeChangedHandler: (() => void) | null

  beforeEach(() => {
    vi.resetModules()
    styleText = null
    themeChangedHandler = null
    prefState = {
      'appearance.theme': 'auto',
      'appearance.lightTheme': 'catppuccin-latte',
      'appearance.darkTheme': 'catppuccin-mocha',
    }
    installedList = [
      { id: 'catppuccin-latte', name: 'Catppuccin Latte', type: 'light' },
      { id: 'catppuccin-mocha', name: 'Catppuccin Mocha', type: 'dark' },
    ]
    themeFiles = {
      'catppuccin-latte': LATTE_THEME,
      'catppuccin-mocha': MOCHA_THEME,
    }
    colorModeValue = ref<'light' | 'dark'>('light')
    colorModeStore = ref<'light' | 'dark' | 'auto'>('auto')

    const styleEl = {
      id: '',
      get textContent() {
        return styleText
      },
      set textContent(val: string | null) {
        styleText = val
      },
      remove: () => {
        styleText = null
      },
    }

    vi.stubGlobal('document', {
      getElementById: () => (styleText !== null ? styleEl : null),
      createElement: () => ({ ...styleEl }),
      head: {
        append: (el: { textContent: string | null }) => {
          styleText = el.textContent
        },
      },
    })

    vi.doMock('@vueuse/core', () => ({
      useColorMode: () =>
        Object.assign(colorModeValue, { store: colorModeStore }),
    }))

    vi.doMock('@/electron', () => ({
      store: {
        preferences: {
          get: (key: string) => prefState[key],
          set: (key: string, value: string) => {
            prefState[key] = value
          },
        },
      },
      ipc: {
        on: (channel: string, cb: () => void) => {
          if (channel === 'theme:changed') {
            themeChangedHandler = cb
          }
        },
        invoke: vi.fn(async (channel: string, payload: unknown) => {
          if (channel === 'theme:list') {
            return installedList
          }
          if (channel === 'theme:get') {
            return themeFiles[String(payload)] ?? null
          }
          return null
        }),
      },
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('switches between configured custom light and dark themes when OS color mode changes', async () => {
    const { useTheme } = await import('../useTheme')
    const theme = useTheme()

    // Wait for initTheme() async microtasks
    await vi.waitFor(() => {
      expect(theme.activeThemeId.value).toBe('catppuccin-latte')
    })

    expect(theme.currentThemeId.value).toBe('auto')
    expect(colorModeStore.value).toBe('auto')
    expect(theme.isDark.value).toBe(false)
    expect(theme.editorThemeName.value).toBe('neo masscode-custom')
    expect(styleText).toContain('#eff1f5')

    // Simulate OS switching to dark mode
    colorModeValue.value = 'dark'
    await nextTick()
    await vi.waitFor(() => {
      expect(theme.activeThemeId.value).toBe('catppuccin-mocha')
    })

    expect(theme.currentThemeId.value).toBe('auto')
    expect(colorModeStore.value).toBe('auto')
    expect(theme.isDark.value).toBe(true)
    expect(theme.editorThemeName.value).toBe('oceanic-next masscode-custom')
    expect(styleText).toContain('#1e1e2e')
  })

  it('falls back to built-in light/dark and resets preference when a configured custom theme is removed', async () => {
    colorModeValue.value = 'dark'
    const { useTheme } = await import('../useTheme')
    const theme = useTheme()

    await vi.waitFor(() => {
      expect(theme.activeThemeId.value).toBe('catppuccin-mocha')
    })

    // Remove dark custom theme from disk and fire theme:changed
    installedList = [
      { id: 'catppuccin-latte', name: 'Catppuccin Latte', type: 'light' },
    ]
    delete themeFiles['catppuccin-mocha']
    themeChangedHandler?.()

    await vi.waitFor(() => {
      expect(theme.systemDarkThemeId.value).toBe('dark')
    })

    expect(prefState['appearance.darkTheme']).toBe('dark')
    expect(theme.currentThemeId.value).toBe('auto')
    expect(theme.activeThemeId.value).toBe('dark')
    expect(theme.editorThemeName.value).toBe('oceanic-next')
    expect(styleText).toBeNull()
  })
})
