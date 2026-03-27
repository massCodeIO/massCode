export type LayoutMode = 'all-panels' | 'list-editor' | 'editor-only'

interface CodePanelsState {
  showSidebar: boolean
  showList: boolean
}

interface NotesPanelsState {
  isSidebarHidden: boolean
  isListHidden: boolean
}

export function getCodeLayoutModeFromLegacyState(
  isSidebarHidden?: boolean,
): LayoutMode {
  return isSidebarHidden ? 'editor-only' : 'all-panels'
}

export function getNextLayoutModeForSidebarToggle(
  layoutMode: LayoutMode,
): LayoutMode {
  if (layoutMode === 'all-panels') {
    return 'list-editor'
  }

  return 'all-panels'
}

export function getCodePanels(layoutMode: LayoutMode): CodePanelsState {
  return {
    showSidebar: layoutMode === 'all-panels',
    showList: layoutMode !== 'editor-only',
  }
}

export function getLayoutModeFromNotesPanels(
  panels: NotesPanelsState,
): LayoutMode {
  if (!panels.isSidebarHidden) {
    return 'all-panels'
  }

  return panels.isListHidden ? 'editor-only' : 'list-editor'
}

export function getNotesPanelsFromLayoutMode(
  layoutMode: LayoutMode,
): NotesPanelsState {
  if (layoutMode === 'all-panels') {
    return {
      isSidebarHidden: false,
      isListHidden: false,
    }
  }

  return {
    isSidebarHidden: true,
    isListHidden: layoutMode === 'editor-only',
  }
}
