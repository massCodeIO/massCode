import type { NoteExportDrawingPreview } from '~/main/types/ipc'
import { getDrawingUrlsFromMarkdown } from '../../../shared/notes/drawingExport'

export { getDrawingUrlsFromMarkdown }

const DRAWING_EXPORT_CONCURRENCY = 4

export async function renderDrawingPreviews(
  drawingIds: Iterable<string>,
): Promise<NoteExportDrawingPreview[]> {
  const ids = [...new Set(drawingIds)]
  if (ids.length === 0) {
    return []
  }

  try {
    const { renderDrawingSvg } = await import('./cm-extensions/drawingEmbed')
    const previews: NoteExportDrawingPreview[] = []

    for (
      let offset = 0;
      offset < ids.length;
      offset += DRAWING_EXPORT_CONCURRENCY
    ) {
      const batch = await Promise.all(
        ids
          .slice(offset, offset + DRAWING_EXPORT_CONCURRENCY)
          .map(async (id) => {
            try {
              const svg = await renderDrawingSvg(id, false)
              return svg === null ? null : { id, svg }
            }
            catch (error) {
              console.error(
                '[notes] Failed to render drawing for export',
                error,
              )
              return null
            }
          }),
      )
      previews.push(
        ...batch.filter(
          (preview): preview is NoteExportDrawingPreview => preview !== null,
        ),
      )
    }

    return previews
  }
  catch (error) {
    console.error('[notes] Failed to load drawing export renderer', error)
    return []
  }
}

export async function renderDrawingPreviewsFromMarkdown(
  content: string,
): Promise<NoteExportDrawingPreview[]> {
  const drawingUrls = getDrawingUrlsFromMarkdown(content)
  if (drawingUrls.length === 0) {
    return []
  }

  const { getDrawingIdFromUrl } = await import('./cm-extensions/drawingEmbed')
  return renderDrawingPreviews(
    drawingUrls
      .map(url => getDrawingIdFromUrl(url))
      .filter((id): id is string => Boolean(id)),
  )
}
