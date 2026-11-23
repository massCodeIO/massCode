export type ThemeType = 'light' | 'dark'

export type ThemeColors = Record<string, string>

export type ThemeEditorColors = Record<string, string>

export interface ThemeFile {
  name: string
  author?: string
  authorUrl?: string
  type: ThemeType
  colors?: ThemeColors
  editorColors?: ThemeEditorColors
}

export interface ThemeListItem {
  id: string
  name: string
  author?: string
  type: ThemeType
}

export interface CommunityThemePreview {
  background: string
  card: string
  foreground: string
  primary: string
  border: string
  accent?: string
  keyword?: string
  string?: string
  comment?: string
}

export interface CommunityThemeEntry {
  id: string
  name: string
  author?: string
  authorUrl?: string
  type: ThemeType
  file: string
  sha256: string
  preview?: CommunityThemePreview
}

export type CommunityThemeStatus =
  | 'available'
  | 'installed'
  | 'update-available'

export interface CommunityThemeRegistryRef {
  file: string
  sha256: string
}

export interface CommunityThemeItem {
  id: string
  name: string
  author?: string
  authorUrl?: string
  type: ThemeType
  preview?: Partial<CommunityThemePreview>
  status: CommunityThemeStatus
  hasLocalConflict: boolean
  hasLocalModifications: boolean
  isDelisted: boolean
  registry?: CommunityThemeRegistryRef
}

export type CommunityThemesSource = 'live' | 'cache' | 'unavailable'

export interface CommunityThemesCatalogResult {
  items: CommunityThemeItem[]
  fetchedAt: number | null
  source: CommunityThemesSource
  isOfflineFallback: boolean
  error?: string
}

export interface CommunityThemeListPayload {
  forceRefresh?: boolean
}

export interface CommunityThemeInstallPayload {
  id: string
  expectedLocalSha256?: string
}

export type CommunityThemeConflictReason =
  | 'untracked-file'
  | 'locally-modified'

export interface CommunityThemeInstallResult {
  status: 'installed' | 'conflict'
  reason?: CommunityThemeConflictReason
  localSha256?: string
}

export interface CommunityThemeUninstallPayload {
  id: string
  expectedLocalSha256?: string
}

export interface CommunityThemeUninstallResult {
  status: 'uninstalled' | 'conflict' | 'not-managed'
  reason?: 'locally-modified'
  localSha256?: string
}

export type CommunityThemeSubmitResult =
  | {
    ok: true
    fileName: string
    url: string
  }
  | {
    ok: false
    error: string
  }

export interface CommunityThemesCache {
  commit: string
  fetchedAt: number
  themes: CommunityThemeEntry[]
}

export interface CommunityThemeInstalledMeta {
  sha256: string
  installedAt: number
}

export interface CommunityThemesStoreState {
  cache: CommunityThemesCache | null
  installed: Record<string, CommunityThemeInstalledMeta>
}
