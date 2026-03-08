import type {
  ThemeEditorColors,
  ThemeFile,
  ThemeListItem,
  ThemeType,
} from '~/main/store/types/theme'
import { ipc, store } from '@/electron'
import { useColorMode } from '@vueuse/core'

type BuiltInThemeId = 'light' | 'dark' | 'auto'

const BUILT_IN_THEMES = new Set<BuiltInThemeId>(['light', 'dark', 'auto'])
const CUSTOM_STYLE_ID = 'masscode-custom-theme'
const LIGHT_EDITOR_THEME = 'neo'
const DARK_EDITOR_THEME = 'oceanic-next'

const storedThemeId = String(store.preferences.get('theme') || 'auto')

const colorMode = useColorMode()
const colorModeStore = colorMode.store
const currentThemeId = ref(storedThemeId)
const customThemes = ref<ThemeListItem[]>([])
const resolvedThemeType = ref<ThemeType>('light')
const currentCustomTheme = ref<ThemeFile | null>(null)

const isDark = computed(() => resolvedThemeType.value === 'dark')

let isInitialized = false
let isThemeReloadInProgress = false
let hasPendingThemeReload = false

function persistThemePreference(id: string): void {
  if (store.preferences.get('theme') === id) {
    return
  }

  store.preferences.set('theme', id)
}

function isBuiltInTheme(id: string): id is BuiltInThemeId {
  return BUILT_IN_THEMES.has(id as BuiltInThemeId)
}

function getBuiltInThemeType(id: BuiltInThemeId): ThemeType {
  if (id === 'dark') {
    return 'dark'
  }

  if (id === 'light') {
    return 'light'
  }

  return colorMode.value === 'dark' ? 'dark' : 'light'
}

function removeCustomThemeStyle(): void {
  const style = document.getElementById(CUSTOM_STYLE_ID)

  if (style) {
    style.remove()
  }
}

function isValidCssToken(token: string): boolean {
  return /^[a-z0-9-]+$/i.test(token)
}

function hasCustomEditorColors(editorColors?: ThemeEditorColors): boolean {
  if (!editorColors) {
    return false
  }

  return Object.entries(editorColors).some(([key, value]) => {
    if (!key.startsWith('editor-')) {
      return false
    }

    return isValidCssToken(key) && Boolean(value.trim())
  })
}

function buildThemeCss(theme: ThemeFile): string {
  const chunks: string[] = []
  const themeSelector = theme.type === 'dark' ? 'html.dark' : ':root'

  if (theme.colors) {
    const colorVars = Object.entries(theme.colors)
      .filter(([key, value]) => isValidCssToken(key) && Boolean(value.trim()))
      .map(([key, value]) => `  --${key}: ${value};`)

    if (colorVars.length) {
      chunks.push(`${themeSelector} {`)
      chunks.push(...colorVars)
      chunks.push('}')
    }
  }

  if (theme.editorColors) {
    const editorRules = Object.entries(theme.editorColors)
      .filter(([key, value]) => {
        if (!key.startsWith('editor-')) {
          return false
        }

        return isValidCssToken(key) && Boolean(value.trim())
      })
      .map(([key, value]) => {
        const token = key.slice('editor-'.length)

        if (!token) {
          return ''
        }

        return `.cm-s-masscode-custom span.cm-${token} { color: ${value} !important; }`
      })
      .filter(Boolean)

    chunks.push(...editorRules)
  }

  return chunks.join('\n')
}

function applyCustomThemeStyle(theme: ThemeFile): void {
  removeCustomThemeStyle()

  const css = buildThemeCss(theme)

  if (!css) {
    return
  }

  const style = document.createElement('style')
  style.id = CUSTOM_STYLE_ID
  style.textContent = css

  document.head.append(style)
}

function applyBuiltInTheme(id: BuiltInThemeId): void {
  currentCustomTheme.value = null
  removeCustomThemeStyle()

  colorModeStore.value = id
  resolvedThemeType.value = getBuiltInThemeType(id)
  currentThemeId.value = id

  persistThemePreference(id)
}

async function applyCustomTheme(id: string): Promise<boolean> {
  const theme = await ipc.invoke<string, ThemeFile | null>('theme:get', id)

  if (!theme) {
    return false
  }

  colorModeStore.value = theme.type
  resolvedThemeType.value = theme.type
  currentCustomTheme.value = theme
  currentThemeId.value = id

  applyCustomThemeStyle(theme)
  persistThemePreference(id)

  return true
}

function fallbackToAuto(): void {
  applyBuiltInTheme('auto')
}

async function setTheme(id: string): Promise<void> {
  if (isBuiltInTheme(id)) {
    applyBuiltInTheme(id)
    return
  }

  const isApplied = await applyCustomTheme(id)

  if (!isApplied) {
    fallbackToAuto()
  }
}

async function loadCustomThemes(): Promise<void> {
  try {
    customThemes.value = await ipc.invoke<null, ThemeListItem[]>(
      'theme:list',
      null,
    )
  }
  catch (error) {
    customThemes.value = []
    console.error('Failed to load custom themes', error)
  }
}

async function handleThemesChanged(): Promise<void> {
  await loadCustomThemes()

  const selectedId = currentThemeId.value

  if (isBuiltInTheme(selectedId)) {
    return
  }

  const exists = customThemes.value.some(theme => theme.id === selectedId)

  if (!exists) {
    fallbackToAuto()
    return
  }

  await setTheme(selectedId)
}

async function processThemeReloadQueue(): Promise<void> {
  if (isThemeReloadInProgress) {
    hasPendingThemeReload = true
    return
  }

  isThemeReloadInProgress = true

  try {
    do {
      hasPendingThemeReload = false
      await handleThemesChanged()
    } while (hasPendingThemeReload)
  }
  catch (error) {
    console.error('Failed to process theme updates', error)
  }
  finally {
    isThemeReloadInProgress = false
  }
}

const editorThemeName = computed(() => {
  const baseTheme
    = resolvedThemeType.value === 'dark' ? DARK_EDITOR_THEME : LIGHT_EDITOR_THEME

  if (!isBuiltInTheme(currentThemeId.value)) {
    const editorColors = currentCustomTheme.value?.editorColors

    if (hasCustomEditorColors(editorColors)) {
      return `${baseTheme} masscode-custom`
    }
  }

  return baseTheme
})

async function initTheme(): Promise<void> {
  await loadCustomThemes()
  await setTheme(currentThemeId.value)
}

function onThemeChanged() {
  void processThemeReloadQueue()
}

watch(
  () => colorMode.value,
  () => {
    if (isBuiltInTheme(currentThemeId.value)) {
      resolvedThemeType.value = getBuiltInThemeType(currentThemeId.value)
    }
  },
)

export function useTheme() {
  if (!isInitialized) {
    isInitialized = true

    ipc.on('theme:changed', onThemeChanged)
    void initTheme()
  }

  return {
    currentThemeId,
    customThemes,
    resolvedThemeType,
    isDark,
    setTheme,
    loadCustomThemes,
    editorThemeName,
  }
}
