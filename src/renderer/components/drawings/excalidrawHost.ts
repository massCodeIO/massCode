import type { ComponentProps } from 'react'
import type { Root } from 'react-dom/client'
import {
  CaptureUpdateAction,
  Excalidraw,
  restore,
  serializeAsJSON,
} from '@excalidraw/excalidraw'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import '@excalidraw/excalidraw/index.css'

declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string | string[]
  }
}

// Fonts are copied to the renderer build root (see vite.config.mjs).
// An absolute URL is required: relative paths are resolved against
// window.location.origin, which is unusable for file:// in production.
window.EXCALIDRAW_ASSET_PATH = new URL('./', window.location.href).toString()

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

export interface ExcalidrawHostOptions {
  initialContent: string | null
  initialName: string
  theme: 'light' | 'dark'
  langCode: string
  onChange: () => void
}

export interface ExcalidrawHost {
  destroy: () => void
  loadScene: (content: string | null, name: string) => void
  openImageExportDialog: () => void
  serializeScene: () => string | null
  setTheme: (theme: 'light' | 'dark') => void
}

function parseSceneContent(content: string | null) {
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

  // Restore the saved viewport so a drawing reopens where it was left.
  const rawAppState
    = data && typeof data.appState === 'object' && data.appState !== null
      ? (data.appState as Record<string, unknown>)
      : {}
  const rawZoom
    = typeof rawAppState.zoom === 'number'
      ? rawAppState.zoom
      : (rawAppState.zoom as { value?: unknown } | undefined)?.value
  const hasViewState
    = typeof rawAppState.scrollX === 'number'
      && typeof rawAppState.scrollY === 'number'

  if (hasViewState) {
    scene.appState.scrollX
      = rawAppState.scrollX as typeof scene.appState.scrollX
    scene.appState.scrollY
      = rawAppState.scrollY as typeof scene.appState.scrollY

    if (typeof rawZoom === 'number' && rawZoom > 0) {
      scene.appState.zoom = {
        value: rawZoom,
      } as typeof scene.appState.zoom
    }
  }

  return { hasViewState, scene }
}

export function mountExcalidraw(
  container: HTMLElement,
  options: ExcalidrawHostOptions,
): ExcalidrawHost {
  let root: Root | null = createRoot(container)
  let api: ExcalidrawApi | null = null
  let theme = options.theme
  let isExportDialogOpen = false
  let hasAppliedScene = false
  let latestElements: SceneElements | null = null
  let latestAppState: SceneAppState | null = null
  let latestFiles: SceneFiles | null = null

  // The scene always goes through updateScene (also on mount): the
  // initialData path runs Excalidraw's own appState restore, which
  // drops the persisted viewport.
  let pendingScene: { content: string | null, name: string } | null = {
    content: options.initialContent,
    name: options.initialName,
  }

  function flushPendingScene() {
    if (!api || !pendingScene || !root) {
      return
    }

    const { content, name } = pendingScene
    pendingScene = null

    const { hasViewState, scene } = parseSceneContent(content)

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

    hasAppliedScene = true
  }

  // The excalidrawAPI callback fires before the component finishes
  // mounting, so the scene is applied asynchronously: calling
  // updateScene during the React commit triggers setState warnings.
  function applyScene(content: string | null, name: string) {
    pendingScene = { content, name }
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

          options.onChange()
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
    },
    loadScene(content: string | null, name: string) {
      applyScene(content, name)
    },
    openImageExportDialog() {
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
    },
    serializeScene() {
      if (!hasAppliedScene || !latestElements || !latestAppState) {
        return null
      }

      const json = serializeAsJSON(
        latestElements,
        latestAppState,
        latestFiles ?? {},
        'local',
      )

      // serializeAsJSON drops the viewport. Persist it so a drawing
      // reopens at the position and zoom it was left at.
      const { scrollX, scrollY, zoom } = latestAppState

      if (typeof scrollX !== 'number' || typeof scrollY !== 'number') {
        return json
      }

      const data = JSON.parse(json) as { appState: Record<string, unknown> }
      data.appState.scrollX = scrollX
      data.appState.scrollY = scrollY

      if (typeof zoom?.value === 'number') {
        data.appState.zoom = { value: zoom.value }
      }

      return JSON.stringify(data, null, 2)
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
