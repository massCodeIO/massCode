import type { ChokidarOptions, FSWatcher } from 'chokidar'
import type {
  ThemeFile,
  ThemeListItem,
  ThemeType,
} from '../../store/types/theme'
import { homedir } from 'node:os'
import path from 'node:path'
import { BrowserWindow, ipcMain, shell } from 'electron'
import {
  ensureDirSync,
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'fs-extra'
import { importEsm, log } from '../../utils'
import '../../types'

const THEMES_ROOT_DIR = path.join(homedir(), '.massCode')
const THEMES_DIR = path.join(THEMES_ROOT_DIR, 'themes')
const THEME_FILE_EXT = '.json'
const THEME_CHANGED_DEBOUNCE_MS = 250
const THEME_TEMPLATE_BASE_NAME = 'new-theme'
const THEME_TEMPLATE: ThemeFile = {
  name: 'New Theme (Rose Pine)',
  author: '',
  type: 'light',
  colors: {
    'color-primary': 'hsl(277, 22%, 57%)',
    'color-bg': 'hsl(35, 67%, 96%)',
    'color-fg': 'hsl(245, 18%, 40%)',
    'color-text': 'hsl(245, 18%, 40%)',
    'color-text-muted': 'hsl(270, 10%, 53%)',
    'color-border': 'hsl(30, 24%, 88%)',
    'color-button': 'hsl(34, 52%, 91%)',
    'color-button-hover': 'hsl(34, 42%, 88%)',
    'color-list-selection': 'hsl(34, 38%, 89%)',
    'color-list-selection-fg': 'hsl(245, 18%, 40%)',
    'color-scrollbar': 'hsla(270, 14%, 73%, 0.5)',
  },
  editorColors: {
    'editor-keyword': 'hsl(277, 22%, 57%)',
    'editor-string': 'hsl(35, 78%, 56%)',
    'editor-comment': 'hsl(270, 8%, 61%)',
    'editor-number': 'hsl(2, 57%, 66%)',
    'editor-atom': 'hsl(340, 37%, 53%)',
    'editor-variable': 'hsl(245, 18%, 40%)',
    'editor-def': 'hsl(198, 52%, 36%)',
    'editor-property': 'hsl(187, 34%, 47%)',
    'editor-tag': 'hsl(340, 37%, 53%)',
    'editor-attribute': 'hsl(198, 52%, 36%)',
    'editor-operator': 'hsl(277, 22%, 57%)',
    'editor-bracket': 'hsl(245, 18%, 40%)',
  },
}

let themeWatcher: FSWatcher | null = null
let themeWatcherTimer: NodeJS.Timeout | null = null
let watchedThemesDir: string | null = null
let watcherStartToken = 0
let chokidarWatchLoader: Promise<ChokidarWatch> | null = null
const reportedThemeIssues = new Map<string, string>()

type ChokidarWatch = (
  path: string | readonly string[],
  options?: ChokidarOptions,
) => FSWatcher

async function getChokidarWatch(): Promise<ChokidarWatch> {
  if (chokidarWatchLoader) {
    return chokidarWatchLoader
  }

  chokidarWatchLoader = importEsm('chokidar')
    .then((module) => {
      const chokidarModule = module as {
        default?: {
          watch?: unknown
        }
        watch?: unknown
      }
      const watch = chokidarModule.default?.watch || chokidarModule.watch

      if (typeof watch !== 'function') {
        throw new TypeError('chokidar.watch is not available')
      }

      return watch as ChokidarWatch
    })
    .catch((error) => {
      chokidarWatchLoader = null
      throw error
    })

  return chokidarWatchLoader
}

function ensureThemesDir(): string {
  ensureDirSync(THEMES_DIR)
  return THEMES_DIR
}

function reportThemeIssue(
  fileName: string,
  reason: string,
  error?: unknown,
): void {
  const message = `${fileName}: ${reason}`

  if (reportedThemeIssues.get(fileName) === message) {
    return
  }

  reportedThemeIssues.set(fileName, message)

  if (error) {
    console.warn(`[theme] ${message}`, error)
    return
  }

  console.warn(`[theme] ${message}`)
}

function isThemeType(value: unknown): value is ThemeType {
  return value === 'light' || value === 'dark'
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  return Object.values(value).every(v => typeof v === 'string')
}

function parseThemeFile(raw: unknown, fileName: string): ThemeFile | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    reportThemeIssue(fileName, 'Invalid JSON object')
    return null
  }

  const data = raw as {
    name?: unknown
    author?: unknown
    type?: unknown
    colors?: unknown
    editorColors?: unknown
  }

  if (typeof data.name !== 'string' || !data.name.trim()) {
    reportThemeIssue(fileName, 'Invalid name')
    return null
  }

  if (!isThemeType(data.type)) {
    reportThemeIssue(fileName, 'Invalid type')
    return null
  }

  if (data.author !== undefined && typeof data.author !== 'string') {
    reportThemeIssue(fileName, 'Invalid author')
    return null
  }

  if (data.colors !== undefined && !isStringRecord(data.colors)) {
    reportThemeIssue(fileName, 'Invalid colors')
    return null
  }

  if (data.editorColors !== undefined && !isStringRecord(data.editorColors)) {
    reportThemeIssue(fileName, 'Invalid editorColors')
    return null
  }

  reportedThemeIssues.delete(fileName)

  return {
    name: data.name.trim(),
    author: data.author,
    type: data.type,
    colors: data.colors,
    editorColors: data.editorColors,
  }
}

function normalizeThemeId(id: string): string | null {
  const normalized = id.trim()

  if (!normalized) {
    return null
  }

  if (normalized.includes('\0')) {
    return null
  }

  if (normalized.includes('/') || normalized.includes('\\')) {
    return null
  }

  if (normalized === '.' || normalized === '..') {
    return null
  }

  return normalized
}

function resolveThemeFilePath(id: string): string | null {
  const normalizedId = normalizeThemeId(id)

  if (!normalizedId) {
    return null
  }

  const themesDir = ensureThemesDir()
  const filePath = path.resolve(themesDir, `${normalizedId}${THEME_FILE_EXT}`)
  const relative = path.relative(themesDir, filePath)

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null
  }

  return filePath
}

function readThemeFromFile(
  filePath: string,
  fileName: string,
): ThemeFile | null {
  try {
    const content = readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(content) as unknown

    return parseThemeFile(parsed, fileName)
  }
  catch (error) {
    reportThemeIssue(fileName, 'Failed to read or parse JSON', error)
    return null
  }
}

function listThemes(): ThemeListItem[] {
  const themesDir = ensureThemesDir()
  const entries = readdirSync(themesDir, { withFileTypes: true })
  const themes: ThemeListItem[] = []

  entries.forEach((entry) => {
    if (!entry.isFile()) {
      return
    }

    if (path.extname(entry.name).toLowerCase() !== THEME_FILE_EXT) {
      return
    }

    const filePath = path.join(themesDir, entry.name)
    const theme = readThemeFromFile(filePath, entry.name)

    if (!theme) {
      return
    }

    const id = path.parse(entry.name).name

    themes.push({
      id,
      name: theme.name,
      author: theme.author,
      type: theme.type,
    })
  })

  themes.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {
      sensitivity: 'base',
    }),
  )

  return themes
}

function getTheme(id: string): ThemeFile | null {
  const filePath = resolveThemeFilePath(id)

  if (!filePath || !existsSync(filePath)) {
    return null
  }

  return readThemeFromFile(filePath, path.basename(filePath))
}

async function openThemesDir(): Promise<void> {
  const themesDir = ensureThemesDir()
  const openError = await shell.openPath(themesDir)

  if (openError) {
    log('theme:open-dir', new Error(openError))
  }
}

function resolveThemeTemplatePath(): string {
  const themesDir = ensureThemesDir()
  const maxAttempts = 1000

  for (let index = 0; index < maxAttempts; index++) {
    const suffix = index === 0 ? '' : `-${index}`
    const fileName = `${THEME_TEMPLATE_BASE_NAME}${suffix}${THEME_FILE_EXT}`
    const filePath = path.join(themesDir, fileName)

    if (!existsSync(filePath)) {
      return filePath
    }
  }

  throw new Error(
    `Could not find available theme template name after ${maxAttempts} attempts`,
  )
}

function createThemeTemplate(): string {
  const templatePath = resolveThemeTemplatePath()
  const templateContent = `${JSON.stringify(THEME_TEMPLATE, null, 2)}\n`

  writeFileSync(templatePath, templateContent, 'utf8')

  return templatePath
}

function scheduleThemeChanged(): void {
  if (themeWatcherTimer) {
    clearTimeout(themeWatcherTimer)
    themeWatcherTimer = null
  }

  themeWatcherTimer = setTimeout(() => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('theme:changed')
    })
  }, THEME_CHANGED_DEBOUNCE_MS)
}

export function stopThemeWatcher(): void {
  watcherStartToken += 1

  if (themeWatcherTimer) {
    clearTimeout(themeWatcherTimer)
    themeWatcherTimer = null
  }

  if (themeWatcher) {
    void themeWatcher.close()
    themeWatcher = null
  }

  watchedThemesDir = null
}

export function startThemeWatcher(): void {
  const themesDir = ensureThemesDir()

  if (themeWatcher && watchedThemesDir === themesDir) {
    return
  }

  stopThemeWatcher()

  const startToken = ++watcherStartToken

  void getChokidarWatch()
    .then((watch) => {
      if (startToken !== watcherStartToken) {
        return
      }

      const watcher = watch(themesDir, {
        awaitWriteFinish: {
          pollInterval: 100,
          stabilityThreshold: 200,
        },
        ignoreInitial: true,
        persistent: true,
      })

      watcher
        .on('add', scheduleThemeChanged)
        .on('change', scheduleThemeChanged)
        .on('unlink', scheduleThemeChanged)
        .on('addDir', scheduleThemeChanged)
        .on('unlinkDir', scheduleThemeChanged)
        .on('error', (error: unknown) => {
          log('theme:watcher-error', error)
        })

      if (startToken !== watcherStartToken) {
        void watcher.close()
        return
      }

      themeWatcher = watcher
      watchedThemesDir = themesDir
    })
    .catch((error) => {
      if (startToken === watcherStartToken) {
        watchedThemesDir = null
      }

      log('theme:watcher-start', error)
    })
}

export function registerThemeHandlers() {
  ipcMain.handle<null, ThemeListItem[]>('theme:list', async () => {
    startThemeWatcher()
    return listThemes()
  })

  ipcMain.handle<string, ThemeFile | null>('theme:get', async (_, payload) => {
    startThemeWatcher()
    return getTheme(payload)
  })

  ipcMain.handle('theme:open-dir', async () => {
    startThemeWatcher()
    await openThemesDir()
  })

  ipcMain.handle<null, string>('theme:create-template', async () => {
    startThemeWatcher()
    return createThemeTemplate()
  })
}
