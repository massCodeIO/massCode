import { describe, expect, it } from 'vitest'
import { createMainMenuContext } from '../context'

describe('createMainMenuContext', () => {
  it('builds code-space menu context from layout and editor state', () => {
    const context = createMainMenuContext({
      activeSpaceId: 'code',
      compactListMode: true,
      code: {
        canPreviewCode: true,
        canPreviewJson: true,
        isCodePreviewShown: false,
        isJsonPreviewShown: true,
        layoutMode: 'list-editor',
      },
      notes: {
        hasSelectedNote: false,
        isMindmapShown: false,
        isPresentationShown: false,
        layoutMode: 'all-panels',
        mode: 'livePreview',
      },
    })

    expect(context.file).toEqual({
      canCreateFragment: true,
      primaryAction: 'new-snippet',
      secondaryAction: 'new-folder',
    })
    expect(context.view).toEqual({
      canToggleCompactMode: true,
      canToggleMindmap: false,
      canTogglePresentation: false,
      isCompactMode: true,
      isMindmapShown: false,
      isPresentationShown: false,
      layoutMode: 'list-editor',
      layoutModes: ['all-panels', 'list-editor', 'editor-only'],
    })
    expect(context.editor).toEqual({
      canAdjustFontSize: true,
      canFormat: true,
      canPreviewCode: true,
      canPreviewJson: true,
      isCodePreviewShown: false,
      isJsonPreviewShown: true,
      kind: 'code',
      noteMode: null,
    })
  })

  it('builds notes-space menu context with markdown view actions', () => {
    const context = createMainMenuContext({
      activeSpaceId: 'notes',
      compactListMode: false,
      code: {
        canPreviewCode: false,
        canPreviewJson: false,
        isCodePreviewShown: false,
        isJsonPreviewShown: false,
        layoutMode: 'all-panels',
      },
      notes: {
        hasSelectedNote: true,
        isMindmapShown: true,
        isPresentationShown: false,
        layoutMode: 'editor-only',
        mode: 'preview',
      },
    })

    expect(context.file).toEqual({
      canCreateFragment: false,
      primaryAction: 'new-note',
      secondaryAction: 'new-folder',
    })
    expect(context.view).toEqual({
      canToggleCompactMode: true,
      canToggleMindmap: true,
      canTogglePresentation: true,
      isCompactMode: false,
      isMindmapShown: true,
      isPresentationShown: false,
      layoutMode: 'editor-only',
      layoutModes: ['all-panels', 'list-editor', 'editor-only'],
    })
    expect(context.editor).toEqual({
      canAdjustFontSize: true,
      canFormat: false,
      canPreviewCode: false,
      canPreviewJson: false,
      isCodePreviewShown: false,
      isJsonPreviewShown: false,
      kind: 'notes',
      noteMode: 'preview',
    })
  })

  it('builds math-space menu context with only primary creation action', () => {
    const context = createMainMenuContext({
      activeSpaceId: 'math',
      compactListMode: true,
      code: {
        canPreviewCode: false,
        canPreviewJson: false,
        isCodePreviewShown: false,
        isJsonPreviewShown: false,
        layoutMode: 'all-panels',
      },
      notes: {
        hasSelectedNote: false,
        isMindmapShown: false,
        isPresentationShown: false,
        layoutMode: 'all-panels',
        mode: 'livePreview',
      },
    })

    expect(context.file).toEqual({
      canCreateFragment: false,
      primaryAction: 'new-sheet',
      secondaryAction: null,
    })
    expect(context.view).toEqual({
      canToggleCompactMode: true,
      canToggleMindmap: false,
      canTogglePresentation: false,
      isCompactMode: true,
      isMindmapShown: false,
      isPresentationShown: false,
      layoutMode: null,
      layoutModes: [],
    })
    expect(context.editor).toEqual({
      canAdjustFontSize: false,
      canFormat: false,
      canPreviewCode: false,
      canPreviewJson: false,
      isCodePreviewShown: false,
      isJsonPreviewShown: false,
      kind: null,
      noteMode: null,
    })
  })

  it('disables compact mode for spaces without a list', () => {
    const context = createMainMenuContext({
      activeSpaceId: 'tools',
      compactListMode: true,
      code: {
        canPreviewCode: false,
        canPreviewJson: false,
        isCodePreviewShown: false,
        isJsonPreviewShown: false,
        layoutMode: 'all-panels',
      },
      notes: {
        hasSelectedNote: false,
        isMindmapShown: false,
        isPresentationShown: false,
        layoutMode: 'all-panels',
        mode: 'livePreview',
      },
    })

    expect(context.view).toEqual({
      canToggleCompactMode: false,
      canToggleMindmap: false,
      canTogglePresentation: false,
      isCompactMode: false,
      isMindmapShown: false,
      isPresentationShown: false,
      layoutMode: null,
      layoutModes: [],
    })
  })
})
