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

interface HttpMenuState {
  layoutMode: LayoutMode
  canSendRequest: boolean
}

interface CreateMainMenuContextOptions {
  activeSpaceId: SpaceId | null
  compactListMode: boolean
  code: CodeMenuState
  notes: NotesMenuState
  http: HttpMenuState
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
        canToggleCompactMode: true,
        canToggleMindmap: false,
        isCompactMode: options.compactListMode,
        isMindmapShown: false,
        canTogglePresentation: false,
        isPresentationShown: false,
      },
      editor: {
        kind: 'code',
        noteMode: null,
        canSendRequest: false,
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
        canToggleCompactMode: true,
        canToggleMindmap: options.notes.hasSelectedNote,
        isCompactMode: options.compactListMode,
        isMindmapShown: options.notes.isMindmapShown,
        canTogglePresentation: options.notes.hasSelectedNote,
        isPresentationShown: options.notes.isPresentationShown,
      },
      editor: {
        kind: 'notes',
        noteMode: options.notes.mode,
        canSendRequest: false,
        canFormat: false,
        canPreviewCode: false,
        isCodePreviewShown: false,
        canPreviewJson: false,
        isJsonPreviewShown: false,
        canAdjustFontSize: true,
      },
    }
  }

  if (options.activeSpaceId === 'http') {
    return {
      file: {
        primaryAction: null,
        secondaryAction: null,
        canCreateFragment: false,
      },
      view: {
        layoutMode: options.http.layoutMode,
        layoutModes: sharedLayoutModes,
        canToggleCompactMode: false,
        canToggleMindmap: false,
        isCompactMode: false,
        isMindmapShown: false,
        canTogglePresentation: false,
        isPresentationShown: false,
      },
      editor: {
        kind: 'http',
        noteMode: null,
        canSendRequest: options.http.canSendRequest,
        canFormat: false,
        canPreviewCode: false,
        isCodePreviewShown: false,
        canPreviewJson: false,
        isJsonPreviewShown: false,
        canAdjustFontSize: false,
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
        canToggleCompactMode: true,
        canToggleMindmap: false,
        isCompactMode: options.compactListMode,
        isMindmapShown: false,
        canTogglePresentation: false,
        isPresentationShown: false,
      },
      editor: {
        kind: null,
        noteMode: null,
        canSendRequest: false,
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
      canToggleCompactMode: false,
      canToggleMindmap: false,
      isCompactMode: false,
      isMindmapShown: false,
      canTogglePresentation: false,
      isPresentationShown: false,
    },
    editor: {
      kind: null,
      noteMode: null,
      canSendRequest: false,
      canFormat: false,
      canPreviewCode: false,
      isCodePreviewShown: false,
      canPreviewJson: false,
      isJsonPreviewShown: false,
      canAdjustFontSize: false,
    },
  }
}
