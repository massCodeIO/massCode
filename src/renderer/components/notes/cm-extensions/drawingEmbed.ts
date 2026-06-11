import { i18n, ipc } from '@/electron'
import { openDrawingTarget } from '@/ipc/listeners/deepLinks'

export const DRAWING_EMBED_URL_PREFIX = 'masscode://drawing/'

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

export async function renderDrawingEmbed(
  container: HTMLElement,
  drawingId: string,
  isDark: boolean,
) {
  const content = await ipc.invoke('spaces:drawings:read', { id: drawingId })

  if (typeof content !== 'string') {
    renderEmbedFallback(container, drawingId)
    return
  }

  try {
    const { exportToSvg, restore } = await import('@excalidraw/excalidraw')
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

    container.innerHTML = ''
    container.append(svg)
  }
  catch (error) {
    console.error('[notes] Failed to render drawing embed', error)
    renderEmbedFallback(container, drawingId)
  }
}

export function openDrawingInSpace(drawingId: string) {
  void openDrawingTarget(drawingId)
}
