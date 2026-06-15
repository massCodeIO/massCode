import { describe, expect, it } from 'vitest'
import { createMainMenuContext } from '../context'

const contentSort = {
  code: { sort: 'updatedAt', order: 'DESC' },
  notes: { sort: 'name', order: 'ASC' },
  http: { sort: 'createdAt', order: 'DESC' },
} as const

describe('createMainMenuContext', () => {
  it('builds code-space menu context from layout and editor state', () => {
    const context = createMainMenuContext({
      activeSpaceId: 'code',
      compactListMode: true,
      contentSort,
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
      http: {
        layoutMode: 'all-panels',
        canSendRequest: false,
      },
    })

    expect(context.file).toEqual({
      canCreateFragment: true,
      canCreateTask: false,
      primaryAction: 'new-snippet',
      secondaryAction: 'new-folder',
    })
    expect(context.view).toEqual({
      canToggleCompactMode: true,
      canToggleMindmap: false,
      canTogglePresentation: false,
      contentSortField: 'updatedAt',
      contentSortOrder: 'DESC',
      isCompactMode: true,
      isMindmapShown: false,
      isPresentationShown: false,
      layoutMode: 'list-editor',
      layoutModes: ['all-panels', 'list-editor', 'editor-only'],
    })
    expect(context.editor).toEqual({
      canAdjustFontSize: true,
      canSendRequest: false,
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
      contentSort,
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
      http: {
        layoutMode: 'all-panels',
        canSendRequest: false,
      },
    })

    expect(context.file).toEqual({
      canCreateFragment: false,
      canCreateTask: true,
      primaryAction: 'new-note',
      secondaryAction: 'new-folder',
    })
    expect(context.view).toEqual({
      canToggleCompactMode: true,
      canToggleMindmap: true,
      canTogglePresentation: true,
      contentSortField: 'name',
      contentSortOrder: 'ASC',
      isCompactMode: false,
      isMindmapShown: true,
      isPresentationShown: false,
      layoutMode: 'editor-only',
      layoutModes: ['all-panels', 'list-editor', 'editor-only'],
    })
    expect(context.editor).toEqual({
      canAdjustFontSize: true,
      canSendRequest: false,
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
      contentSort,
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
      http: {
        layoutMode: 'all-panels',
        canSendRequest: false,
      },
    })

    expect(context.file).toEqual({
      canCreateFragment: false,
      canCreateTask: false,
      primaryAction: 'new-sheet',
      secondaryAction: null,
    })
    expect(context.view).toEqual({
      canToggleCompactMode: true,
      canToggleMindmap: false,
      canTogglePresentation: false,
      contentSortField: null,
      contentSortOrder: null,
      isCompactMode: true,
      isMindmapShown: false,
      isPresentationShown: false,
      layoutMode: null,
      layoutModes: [],
    })
    expect(context.editor).toEqual({
      canAdjustFontSize: false,
      canSendRequest: false,
      canFormat: false,
      canPreviewCode: false,
      canPreviewJson: false,
      isCodePreviewShown: false,
      isJsonPreviewShown: false,
      kind: null,
      noteMode: null,
    })
  })

  it('builds http-space menu context with layout-only view actions', () => {
    const context = createMainMenuContext({
      activeSpaceId: 'http',
      compactListMode: false,
      contentSort,
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
      http: {
        layoutMode: 'list-editor',
        canSendRequest: true,
      },
    })

    expect(context.file).toEqual({
      canCreateFragment: false,
      canCreateTask: false,
      primaryAction: null,
      secondaryAction: null,
    })
    expect(context.view).toEqual({
      canToggleCompactMode: false,
      canToggleMindmap: false,
      canTogglePresentation: false,
      contentSortField: 'createdAt',
      contentSortOrder: 'DESC',
      isCompactMode: false,
      isMindmapShown: false,
      isPresentationShown: false,
      layoutMode: 'list-editor',
      layoutModes: ['all-panels', 'list-editor', 'editor-only'],
    })
    expect(context.editor).toEqual({
      canAdjustFontSize: false,
      canSendRequest: true,
      canFormat: false,
      canPreviewCode: false,
      canPreviewJson: false,
      isCodePreviewShown: false,
      isJsonPreviewShown: false,
      kind: 'http',
      noteMode: null,
    })
  })

  it('disables compact mode for spaces without a list', () => {
    const context = createMainMenuContext({
      activeSpaceId: 'tools',
      compactListMode: true,
      contentSort,
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
      http: {
        layoutMode: 'all-panels',
        canSendRequest: false,
      },
    })

    expect(context.view).toEqual({
      canToggleCompactMode: false,
      canToggleMindmap: false,
      canTogglePresentation: false,
      contentSortField: null,
      contentSortOrder: null,
      isCompactMode: false,
      isMindmapShown: false,
      isPresentationShown: false,
      layoutMode: null,
      layoutModes: [],
    })
  })
})
