import { describe, expect, it } from 'vitest'
import {
  getCodeLayoutModeFromLegacyState,
  getCodePanels,
  getLayoutModeFromNotesPanels,
  getNextLayoutModeForSidebarToggle,
  getNotesPanelsFromLayoutMode,
} from '../layoutModes'

describe('layoutModes', () => {
  it('maps legacy code sidebar state to explicit layout mode', () => {
    expect(getCodeLayoutModeFromLegacyState(false)).toBe('all-panels')
    expect(getCodeLayoutModeFromLegacyState(true)).toBe('editor-only')
    expect(getCodeLayoutModeFromLegacyState(undefined)).toBe('all-panels')
  })

  it('toggles sidebar without getting stuck in editor-only mode', () => {
    expect(getNextLayoutModeForSidebarToggle('all-panels')).toBe('list-editor')
    expect(getNextLayoutModeForSidebarToggle('list-editor')).toBe('all-panels')
    expect(getNextLayoutModeForSidebarToggle('editor-only')).toBe('all-panels')
  })

  it('derives code panel visibility from layout mode', () => {
    expect(getCodePanels('all-panels')).toEqual({
      showSidebar: true,
      showList: true,
    })
    expect(getCodePanels('list-editor')).toEqual({
      showSidebar: false,
      showList: true,
    })
    expect(getCodePanels('editor-only')).toEqual({
      showSidebar: false,
      showList: false,
    })
  })

  it('maps notes sidebar and list visibility to layout mode', () => {
    expect(
      getLayoutModeFromNotesPanels({
        isSidebarHidden: false,
        isListHidden: false,
      }),
    ).toBe('all-panels')
    expect(
      getLayoutModeFromNotesPanels({
        isSidebarHidden: true,
        isListHidden: false,
      }),
    ).toBe('list-editor')
    expect(
      getLayoutModeFromNotesPanels({
        isSidebarHidden: true,
        isListHidden: true,
      }),
    ).toBe('editor-only')
  })

  it('maps layout mode back to notes sidebar and list visibility', () => {
    expect(getNotesPanelsFromLayoutMode('all-panels')).toEqual({
      isSidebarHidden: false,
      isListHidden: false,
    })
    expect(getNotesPanelsFromLayoutMode('list-editor')).toEqual({
      isSidebarHidden: true,
      isListHidden: false,
    })
    expect(getNotesPanelsFromLayoutMode('editor-only')).toEqual({
      isSidebarHidden: true,
      isListHidden: true,
    })
  })
})
