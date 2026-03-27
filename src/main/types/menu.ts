export type MainMenuLayoutMode = 'all-panels' | 'list-editor' | 'editor-only'

export type MainMenuPrimaryAction =
  | 'new-snippet'
  | 'new-note'
  | 'new-sheet'
  | null
export type MainMenuSecondaryAction = 'new-folder' | null
export type MainMenuEditorKind = 'code' | 'notes' | null
export type MainMenuNotesEditorMode = 'raw' | 'livePreview' | 'preview' | null

export interface MainMenuFileContext {
  primaryAction: MainMenuPrimaryAction
  secondaryAction: MainMenuSecondaryAction
  canCreateFragment: boolean
}

export interface MainMenuViewContext {
  layoutMode: MainMenuLayoutMode | null
  layoutModes: MainMenuLayoutMode[]
  canToggleMindmap: boolean
  isMindmapShown: boolean
  canTogglePresentation: boolean
  isPresentationShown: boolean
}

export interface MainMenuEditorContext {
  kind: MainMenuEditorKind
  noteMode: MainMenuNotesEditorMode
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
