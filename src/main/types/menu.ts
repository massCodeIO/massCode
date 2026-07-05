export type MainMenuLayoutMode = 'all-panels' | 'list-editor' | 'editor-only'
export type MainMenuContentSortField = 'createdAt' | 'updatedAt' | 'name'
export type MainMenuContentSortOrder = 'ASC' | 'DESC'

export type MainMenuPrimaryAction =
  | 'new-snippet'
  | 'new-note'
  | 'new-sheet'
  | null
export type MainMenuSecondaryAction = 'new-folder' | null
export type MainMenuEditorKind = 'code' | 'notes' | 'http' | null
export type MainMenuNotesEditorMode = 'raw' | 'livePreview' | 'preview' | null

export interface MainMenuFileContext {
  primaryAction: MainMenuPrimaryAction
  secondaryAction: MainMenuSecondaryAction
  canCreateFragment: boolean
  canCreateTask: boolean
}

export interface MainMenuViewContext {
  layoutMode: MainMenuLayoutMode | null
  layoutModes: MainMenuLayoutMode[]
  contentSortField: MainMenuContentSortField | null
  contentSortOrder: MainMenuContentSortOrder | null
  canToggleCompactMode: boolean
  isCompactMode: boolean
  canToggleHideCompletedTasks: boolean
  isHideCompletedTasksInFolders: boolean
  canToggleMindmap: boolean
  isMindmapShown: boolean
  canTogglePresentation: boolean
  isPresentationShown: boolean
}

export interface MainMenuEditorContext {
  kind: MainMenuEditorKind
  noteMode: MainMenuNotesEditorMode
  canSendRequest: boolean
  canFormat: boolean
  canPreviewCode: boolean
  isCodePreviewShown: boolean
  canPreviewJson: boolean
  isJsonPreviewShown: boolean
  canAdjustFontSize: boolean
}

export interface MainMenuContext {
  file: MainMenuFileContext
  view: MainMenuViewContext
  editor: MainMenuEditorContext
}
