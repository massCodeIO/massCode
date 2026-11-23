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

const TOKEN_MIGRATION_MAP: Record<string, string> = {
  'color-primary': 'primary',
  'color-bg': 'background',
  'color-fg': 'foreground',
  'color-text': 'foreground',
  'color-text-muted': 'muted-foreground',
  'color-border': 'border',
  'color-button': 'muted',
  'color-list-selection': 'accent',
  'color-list-selection-fg': 'accent-foreground',
  'color-scrollbar': 'scrollbar',
}

const DROPPED_TOKENS = new Set(['color-button-hover'])

const storedThemeId = String(
  store.preferences.get('appearance.theme') || 'auto',
)
const storedLightThemeId = String(
  store.preferences.get('appearance.lightTheme') || 'light',
)
const storedDarkThemeId = String(
  store.preferences.get('appearance.darkTheme') || 'dark',
)

const colorMode = useColorMode()
const colorModeStore = colorMode.store
const currentThemeId = ref(storedThemeId)
const systemLightThemeId = ref(storedLightThemeId)
const systemDarkThemeId = ref(storedDarkThemeId)
const customThemes = ref<ThemeListItem[]>([])
const resolvedThemeType = ref<ThemeType>('light')
const currentCustomTheme = ref<ThemeFile | null>(null)
const activeCustomThemeId = ref<string | null>(null)

const isDark = computed(() => resolvedThemeType.value === 'dark')

let isInitialized = false
let isThemeReloadInProgress = false
let hasPendingThemeReload = false

function persistThemePreference(id: string): void {
  if (store.preferences.get('appearance.theme') === id) {
    return
  }

  store.preferences.set('appearance.theme', id)
}

function persistSystemSlotPreference(type: ThemeType, id: string): void {
  const key
    = type === 'dark' ? 'appearance.darkTheme' : 'appearance.lightTheme'

  if (store.preferences.get(key) === id) {
    return
  }

  store.preferences.set(key, id)
}

function isBuiltInTheme(id: string): id is BuiltInThemeId {
  return BUILT_IN_THEMES.has(id as BuiltInThemeId)
}

function getSystemThemeType(): ThemeType {
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
      .filter(
        ([key, value]) =>
          !DROPPED_TOKENS.has(key)
          && isValidCssToken(key)
          && Boolean(value.trim()),
      )
      .map(([key, value]) => {
        const resolvedKey = TOKEN_MIGRATION_MAP[key] ?? key
        return `  --${resolvedKey}: ${value};`
      })

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

function resetSystemSlotToBuiltIn(type: ThemeType): void {
  if (type === 'dark') {
    systemDarkThemeId.value = 'dark'
    persistSystemSlotPreference('dark', 'dark')
  }
  else {
    systemLightThemeId.value = 'light'
    persistSystemSlotPreference('light', 'light')
  }
}

function reconcileSystemSlots(): void {
  if (systemLightThemeId.value !== 'light') {
    const exists = customThemes.value.some(
      theme =>
        theme.id === systemLightThemeId.value && theme.type === 'light',
    )
    if (!exists) {
      resetSystemSlotToBuiltIn('light')
    }
  }

  if (systemDarkThemeId.value !== 'dark') {
    const exists = customThemes.value.some(
      theme => theme.id === systemDarkThemeId.value && theme.type === 'dark',
    )
    if (!exists) {
      resetSystemSlotToBuiltIn('dark')
    }
  }
}

async function applySystemTheme(): Promise<void> {
  colorModeStore.value = 'auto'
  currentThemeId.value = 'auto'
  persistThemePreference('auto')

  const systemType = getSystemThemeType()
  resolvedThemeType.value = systemType

  const slotId
    = systemType === 'dark' ? systemDarkThemeId.value : systemLightThemeId.value

  if (slotId === systemType || isBuiltInTheme(slotId)) {
    currentCustomTheme.value = null
    activeCustomThemeId.value = null
    removeCustomThemeStyle()
    return
  }

  const theme = await ipc.invoke<string, ThemeFile | null>('theme:get', slotId)

  if (!theme || theme.type !== systemType) {
    resetSystemSlotToBuiltIn(systemType)
    currentCustomTheme.value = null
    activeCustomThemeId.value = null
    removeCustomThemeStyle()
    return
  }

  currentCustomTheme.value = theme
  activeCustomThemeId.value = slotId
  applyCustomThemeStyle(theme)
}

function applyFixedBuiltInTheme(id: 'light' | 'dark'): void {
  currentCustomTheme.value = null
  activeCustomThemeId.value = null
  removeCustomThemeStyle()

  colorModeStore.value = id
  resolvedThemeType.value = id
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
  activeCustomThemeId.value = id
  currentThemeId.value = id

  applyCustomThemeStyle(theme)
  persistThemePreference(id)

  return true
}

async function fallbackToAuto(): Promise<void> {
  await applySystemTheme()
}

async function setTheme(id: string): Promise<void> {
  if (id === 'auto') {
    await applySystemTheme()
    return
  }

  if (id === 'light' || id === 'dark') {
    applyFixedBuiltInTheme(id)
    return
  }

  const isApplied = await applyCustomTheme(id)

  if (!isApplied) {
    await fallbackToAuto()
  }
}

async function setSystemLightTheme(id: string): Promise<void> {
  const normalized = id.trim()
  const target
    = !normalized || normalized === 'auto' || normalized === 'dark'
      ? 'light'
      : normalized

  systemLightThemeId.value = target
  persistSystemSlotPreference('light', target)

  if (currentThemeId.value === 'auto') {
    await applySystemTheme()
  }
}

async function setSystemDarkTheme(id: string): Promise<void> {
  const normalized = id.trim()
  const target
    = !normalized || normalized === 'auto' || normalized === 'light'
      ? 'dark'
      : normalized

  systemDarkThemeId.value = target
  persistSystemSlotPreference('dark', target)

  if (currentThemeId.value === 'auto') {
    await applySystemTheme()
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
  reconcileSystemSlots()

  const selectedId = currentThemeId.value

  if (selectedId === 'auto') {
    await applySystemTheme()
    return
  }

  if (isBuiltInTheme(selectedId)) {
    return
  }

  const exists = customThemes.value.some(theme => theme.id === selectedId)

  if (!exists) {
    await fallbackToAuto()
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

  const editorColors = currentCustomTheme.value?.editorColors

  if (hasCustomEditorColors(editorColors)) {
    return `${baseTheme} masscode-custom`
  }

  return baseTheme
})

const activeThemeId = computed(() => {
  if (currentThemeId.value === 'auto') {
    return activeCustomThemeId.value ?? resolvedThemeType.value
  }

  return currentThemeId.value
})

async function initTheme(): Promise<void> {
  await loadCustomThemes()
  reconcileSystemSlots()
  await setTheme(currentThemeId.value)
}

function onThemeChanged() {
  void processThemeReloadQueue()
}

watch(
  () => colorMode.value,
  () => {
    if (currentThemeId.value === 'auto') {
      void applySystemTheme()
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
    activeThemeId,
    systemLightThemeId,
    systemDarkThemeId,
    customThemes,
    resolvedThemeType,
    isDark,
    setTheme,
    setSystemLightTheme,
    setSystemDarkTheme,
    loadCustomThemes,
    editorThemeName,
  }
}
