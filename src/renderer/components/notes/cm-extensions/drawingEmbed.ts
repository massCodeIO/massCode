import { DRAWINGS_CHANGED_EVENT } from '@/composables'
import { i18n, ipc } from '@/electron'
import { openDrawingTarget } from '@/ipc/listeners/deepLinks'

export const DRAWING_EMBED_URL_PREFIX = 'masscode://drawing/'

// Rendered SVG markup keyed by `${drawingId}|${theme}`. exportToSvg is
// expensive (font loading, layout) and CodeMirror re-creates widgets every
// time the selection enters/leaves an embed range, so cache aggressively
// and invalidate on drawing changes.
const svgCache = new Map<string, string>()
const inFlightRenders = new Map<string, Promise<string | null>>()

let excalidrawModule: Promise<typeof import('@excalidraw/excalidraw')> | null
  = null

function loadExcalidraw() {
  excalidrawModule ??= import('@excalidraw/excalidraw')
  return excalidrawModule
}

function invalidateDrawingEmbedCache(drawingId?: string) {
  if (!drawingId) {
    svgCache.clear()
    return
  }

  for (const key of svgCache.keys()) {
    if (key.startsWith(`${drawingId}|`)) {
      svgCache.delete(key)
    }
  }
}

// Drawings saved/renamed/deleted inside the app dispatch this event;
// external vault changes arrive via the storage-synced IPC broadcast.
window.addEventListener(DRAWINGS_CHANGED_EVENT, (event) => {
  const id = (event as CustomEvent<{ id?: string }>).detail?.id
  invalidateDrawingEmbedCache(id)
})

ipc.on('system:storage-synced', () => {
  invalidateDrawingEmbedCache()
})

export function getDrawingIdFromUrl(url: string): string | null {
  if (!url.startsWith(DRAWING_EMBED_URL_PREFIX)) {
    return null
  }

  const rawId = url.slice(DRAWING_EMBED_URL_PREFIX.length)

  try {
    return decodeURIComponent(rawId)
  }
  catch {
    return rawId
  }
}

function renderEmbedFallback(container: HTMLElement, drawingId: string) {
  container.innerHTML = ''

  const message = document.createElement('div')
  message.className = 'text-muted-foreground text-[12px]'
  message.textContent = `${i18n.t('spaces.drawings.notFound')}: ${drawingId}`
  container.append(message)
}

async function renderDrawingSvg(
  drawingId: string,
  isDark: boolean,
): Promise<string | null> {
  const content = await ipc.invoke('spaces:drawings:read', { id: drawingId })

  if (typeof content !== 'string') {
    return null
  }

  const { exportToSvg, restore } = await loadExcalidraw()
  const scene = restore(JSON.parse(content), null, null)
  const svg = await exportToSvg({
    appState: {
      ...scene.appState,
      exportBackground: false,
      exportWithDarkMode: isDark,
    },
    elements: scene.elements,
    files: scene.files,
  })

  svg.style.maxWidth = '100%'
  svg.style.height = 'auto'

  return svg.outerHTML
}

export async function renderDrawingEmbed(
  container: HTMLElement,
  drawingId: string,
  isDark: boolean,
) {
  const cacheKey = `${drawingId}|${isDark ? 'dark' : 'light'}`

  try {
    const cached = svgCache.get(cacheKey)

    if (cached !== undefined) {
      container.innerHTML = cached
      return
    }

    let render = inFlightRenders.get(cacheKey)

    if (!render) {
      render = renderDrawingSvg(drawingId, isDark).finally(() => {
        inFlightRenders.delete(cacheKey)
      })
      inFlightRenders.set(cacheKey, render)
    }

    const markup = await render

    if (markup === null) {
      renderEmbedFallback(container, drawingId)
      return
    }

    svgCache.set(cacheKey, markup)
    container.innerHTML = markup
  }
  catch (error) {
    console.error('[notes] Failed to render drawing embed', error)
    renderEmbedFallback(container, drawingId)
  }
}

export function openDrawingInSpace(drawingId: string) {
  void openDrawingTarget(drawingId)
}
