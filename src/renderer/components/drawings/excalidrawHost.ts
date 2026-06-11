import type { ComponentProps } from 'react'
import type { Root } from 'react-dom/client'
import type { DrawingViewportState } from '~/main/store/types'
import {
  CaptureUpdateAction,
  Excalidraw,
  getSceneVersion,
  restore,
  serializeAsJSON,
} from '@excalidraw/excalidraw'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import '@excalidraw/excalidraw/index.css'

type ExcalidrawProps = ComponentProps<typeof Excalidraw>
type ExcalidrawApi = Parameters<
  NonNullable<ExcalidrawProps['excalidrawAPI']>
>[0]
type SceneElements = Parameters<typeof serializeAsJSON>[0]
type SceneAppState = Parameters<typeof serializeAsJSON>[1]
type SceneFiles = Parameters<typeof serializeAsJSON>[2]

const UI_OPTIONS: ExcalidrawProps['UIOptions'] = {
  canvasActions: {
    changeViewBackgroundColor: false,
    clearCanvas: false,
    export: false,
    loadScene: false,
    saveToActiveFile: false,
    toggleTheme: false,
  },
}

export type ExcalidrawChangeKind = 'scene' | 'viewport'

export interface ExcalidrawHostOptions {
  initialContent: string | null
  initialName: string
  initialViewport: DrawingViewportState | null
  theme: 'light' | 'dark'
  langCode: string
  onChange: (kind: ExcalidrawChangeKind) => void
}

export interface ExcalidrawHost {
  destroy: () => void
  getViewport: () => DrawingViewportState | null
  loadScene: (
    content: string | null,
    name: string,
    viewport: DrawingViewportState | null,
  ) => void
  openImageExportDialog: () => void
  serializeScene: () => string | null
  setTheme: (theme: 'light' | 'dark') => void
}

function readLegacyFileViewport(
  data: Parameters<typeof restore>[0],
): DrawingViewportState | null {
  const rawAppState
    = data && typeof data.appState === 'object' && data.appState !== null
      ? (data.appState as Record<string, unknown>)
      : {}
  const rawZoom
    = typeof rawAppState.zoom === 'number'
      ? rawAppState.zoom
      : (rawAppState.zoom as { value?: unknown } | undefined)?.value

  if (
    typeof rawAppState.scrollX !== 'number'
    || typeof rawAppState.scrollY !== 'number'
  ) {
    return null
  }

  return {
    scrollX: rawAppState.scrollX,
    scrollY: rawAppState.scrollY,
    zoom: typeof rawZoom === 'number' && rawZoom > 0 ? rawZoom : 1,
  }
}

export function parseSceneContent(
  content: string | null,
  viewport: DrawingViewportState | null = null,
) {
  let data: Parameters<typeof restore>[0] = null

  if (content) {
    try {
      data = JSON.parse(content)
    }
    catch (error) {
      console.error('Failed to parse drawing content:', error)
    }
  }

  const scene = restore(data, null, null)
  // The canvas background is transparent so the app background shows
  // through and the drawing surface matches the active app theme.
  scene.appState.viewBackgroundColor = 'transparent'
  // The restored appState always carries a default theme. Drop it so it
  // never overrides the controlled `theme` prop of the component.
  delete (scene.appState as Partial<typeof scene.appState>).theme

  // Viewport lives in store.app; files written by older builds may still
  // carry it inline, so fall back to that.
  const resolvedViewport = viewport ?? readLegacyFileViewport(data)

  if (resolvedViewport) {
    scene.appState.scrollX
      = resolvedViewport.scrollX as typeof scene.appState.scrollX
    scene.appState.scrollY
      = resolvedViewport.scrollY as typeof scene.appState.scrollY
    scene.appState.zoom = {
      value: resolvedViewport.zoom,
    } as typeof scene.appState.zoom
  }

  return { hasViewState: resolvedViewport !== null, scene }
}

export function mountExcalidraw(
  container: HTMLElement,
  options: ExcalidrawHostOptions,
): ExcalidrawHost {
  let root: Root | null = createRoot(container)
  let api: ExcalidrawApi | null = null
  let theme = options.theme
  let isExportDialogOpen = false
  let isExportDialogPending = false
  let hasAppliedScene = false
  let lastSceneVersion = -1
  let lastFilesCount = -1
  let latestElements: SceneElements | null = null
  let latestAppState: SceneAppState | null = null
  let latestFiles: SceneFiles | null = null

  // The scene always goes through updateScene (also on mount): the
  // initialData path runs Excalidraw's own appState restore, which
  // drops the viewport applied in parseSceneContent.
  let pendingScene: {
    content: string | null
    name: string
    viewport: DrawingViewportState | null
  } | null = {
    content: options.initialContent,
    name: options.initialName,
    viewport: options.initialViewport,
  }

  function showExportDialog() {
    if (!api) {
      return
    }

    isExportDialogOpen = true
    // Give the export dialog a real background color to work with:
    // exporting the transparent display background is not useful.
    api.updateScene({
      appState: {
        openDialog: { name: 'imageExport' },
        viewBackgroundColor: '#ffffff',
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    })
  }

  function flushPendingScene() {
    if (!api || !pendingScene || !root) {
      return
    }

    const { content, name, viewport } = pendingScene
    pendingScene = null

    const { hasViewState, scene } = parseSceneContent(content, viewport)

    // Loading a scene implicitly closes any open dialog.
    isExportDialogOpen = false

    api.updateScene({
      appState: { ...scene.appState, name },
      captureUpdate: CaptureUpdateAction.NEVER,
      elements: scene.elements,
    })
    api.addFiles(Object.values(scene.files ?? {}))
    api.history.clear()

    if (!hasViewState) {
      api.scrollToContent(scene.elements, { fitToContent: true })
    }

    lastSceneVersion = getSceneVersion(scene.elements)
    lastFilesCount = Object.keys(scene.files ?? {}).length
    hasAppliedScene = true

    if (isExportDialogPending) {
      isExportDialogPending = false
      showExportDialog()
    }
  }

  // The excalidrawAPI callback fires before the component finishes
  // mounting, so the scene is applied asynchronously: calling
  // updateScene during the React commit triggers setState warnings.
  function applyScene(
    content: string | null,
    name: string,
    viewport: DrawingViewportState | null,
  ) {
    pendingScene = { content, name, viewport }
    setTimeout(flushPendingScene, 0)
  }

  function render() {
    root?.render(
      createElement(Excalidraw, {
        excalidrawAPI: (value) => {
          api = value
          setTimeout(flushPendingScene, 0)
        },
        initialData: {
          appState: {
            name: options.initialName,
            viewBackgroundColor: 'transparent',
          },
        } as unknown as ExcalidrawProps['initialData'],
        langCode: options.langCode,
        onChange: (elements, appState, files) => {
          latestElements = elements
          latestAppState = appState
          latestFiles = files

          // Until the real scene is applied the canvas shows a bootstrap
          // empty scene: never report it as user changes.
          if (!hasAppliedScene) {
            return
          }

          if (isExportDialogOpen) {
            // Restore the transparent canvas once the dialog is closed and
            // skip change notifications while it is open: the temporary
            // white background must not be persisted.
            if (!appState.openDialog) {
              isExportDialogOpen = false
              api?.updateScene({
                appState: { viewBackgroundColor: 'transparent' },
                captureUpdate: CaptureUpdateAction.NEVER,
              })
            }
            return
          }

          // Pure pan/zoom/selection changes do not touch elements or
          // files: report them as viewport-only so the full scene is not
          // serialized and written to disk.
          const sceneVersion = getSceneVersion(elements)
          const filesCount = files ? Object.keys(files).length : 0

          if (
            sceneVersion !== lastSceneVersion
            || filesCount !== lastFilesCount
          ) {
            lastSceneVersion = sceneVersion
            lastFilesCount = filesCount
            options.onChange('scene')
          }
          else {
            options.onChange('viewport')
          }
        },
        theme,
        UIOptions: UI_OPTIONS,
      }),
    )
  }

  render()

  return {
    destroy() {
      root?.unmount()
      root = null
      api = null
      latestElements = null
      latestAppState = null
      latestFiles = null
    },
    getViewport() {
      if (!latestAppState) {
        return null
      }

      const { scrollX, scrollY, zoom } = latestAppState

      if (typeof scrollX !== 'number' || typeof scrollY !== 'number') {
        return null
      }

      return {
        scrollX,
        scrollY,
        zoom: typeof zoom?.value === 'number' ? zoom.value : 1,
      }
    },
    loadScene(content, name, viewport) {
      applyScene(content, name, viewport)
    },
    openImageExportDialog() {
      // Defer until the API is ready and any queued scene is applied,
      // otherwise the scene load would instantly close the dialog.
      if (!api || pendingScene) {
        isExportDialogPending = true
        return
      }

      showExportDialog()
    },
    serializeScene() {
      // While the export dialog is open the appState carries a temporary
      // white background: never persist that snapshot.
      if (
        !hasAppliedScene
        || isExportDialogOpen
        || !latestElements
        || !latestAppState
      ) {
        return null
      }

      return serializeAsJSON(
        latestElements,
        latestAppState,
        latestFiles ?? {},
        'local',
      )
    },
    setTheme(nextTheme: 'light' | 'dark') {
      if (theme === nextTheme) {
        return
      }

      theme = nextTheme
      render()
    },
  }
}
