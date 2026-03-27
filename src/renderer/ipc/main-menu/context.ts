import type { LayoutMode } from '@/composables/layoutModes'
import type { NotesEditorMode } from '@/composables/spaces/notes/useNotesApp'
import type { SpaceId } from '@/spaceDefinitions'
import type { MainMenuContext, MainMenuLayoutMode } from '~/main/types/menu'

interface CodeMenuState {
  layoutMode: LayoutMode
  canPreviewCode: boolean
  isCodePreviewShown: boolean
  canPreviewJson: boolean
  isJsonPreviewShown: boolean
}

interface NotesMenuState {
  layoutMode: LayoutMode
  hasSelectedNote: boolean
  isMindmapShown: boolean
  isPresentationShown: boolean
  mode: NotesEditorMode
}

interface CreateMainMenuContextOptions {
  activeSpaceId: SpaceId | null
  code: CodeMenuState
  notes: NotesMenuState
}

const sharedLayoutModes: MainMenuLayoutMode[] = [
  'all-panels',
  'list-editor',
  'editor-only',
]

export function createMainMenuContext(
  options: CreateMainMenuContextOptions,
): MainMenuContext {
  if (options.activeSpaceId === 'code') {
    return {
      file: {
        primaryAction: 'new-snippet',
        secondaryAction: 'new-folder',
        canCreateFragment: true,
      },
      view: {
        layoutMode: options.code.layoutMode,
        layoutModes: sharedLayoutModes,
        canToggleMindmap: false,
        isMindmapShown: false,
        canTogglePresentation: false,
        isPresentationShown: false,
      },
      editor: {
        kind: 'code',
        noteMode: null,
        canFormat: true,
        canPreviewCode: options.code.canPreviewCode,
        isCodePreviewShown: options.code.isCodePreviewShown,
        canPreviewJson: options.code.canPreviewJson,
        isJsonPreviewShown: options.code.isJsonPreviewShown,
        canAdjustFontSize: true,
      },
    }
  }

  if (options.activeSpaceId === 'notes') {
    return {
      file: {
        primaryAction: 'new-note',
        secondaryAction: 'new-folder',
        canCreateFragment: false,
      },
      view: {
        layoutMode: options.notes.layoutMode,
        layoutModes: sharedLayoutModes,
        canToggleMindmap: options.notes.hasSelectedNote,
        isMindmapShown: options.notes.isMindmapShown,
        canTogglePresentation: options.notes.hasSelectedNote,
        isPresentationShown: options.notes.isPresentationShown,
      },
      editor: {
        kind: 'notes',
        noteMode: options.notes.mode,
        canFormat: false,
        canPreviewCode: false,
        isCodePreviewShown: false,
        canPreviewJson: false,
        isJsonPreviewShown: false,
        canAdjustFontSize: true,
      },
    }
  }

  if (options.activeSpaceId === 'math') {
    return {
      file: {
        primaryAction: 'new-sheet',
        secondaryAction: null,
        canCreateFragment: false,
      },
      view: {
        layoutMode: null,
        layoutModes: [],
        canToggleMindmap: false,
        isMindmapShown: false,
        canTogglePresentation: false,
        isPresentationShown: false,
      },
      editor: {
        kind: null,
        noteMode: null,
        canFormat: false,
        canPreviewCode: false,
        isCodePreviewShown: false,
        canPreviewJson: false,
        isJsonPreviewShown: false,
        canAdjustFontSize: false,
      },
    }
  }

  return {
    file: {
      primaryAction: null,
      secondaryAction: null,
      canCreateFragment: false,
    },
    view: {
      layoutMode: null,
      layoutModes: [],
      canToggleMindmap: false,
      isMindmapShown: false,
      canTogglePresentation: false,
      isPresentationShown: false,
    },
    editor: {
      kind: null,
      noteMode: null,
      canFormat: false,
      canPreviewCode: false,
      isCodePreviewShown: false,
      canPreviewJson: false,
      isJsonPreviewShown: false,
      canAdjustFontSize: false,
    },
  }
}
