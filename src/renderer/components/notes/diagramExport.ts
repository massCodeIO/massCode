import type { NoteExportDiagramPreview } from '~/main/types/ipc'
import { getMermaidSources } from '~/shared/notes/exportDiagrams'

export { getMermaidSources }

export async function renderDiagramPreviews(
  sources: string[],
  limit = 50,
): Promise<NoteExportDiagramPreview[]> {
  if (!sources.length)
    return []
  const { renderMermaidSvg } = await import('./mermaidRenderer')
  const previews: NoteExportDiagramPreview[] = []
  for (const code of [...new Set(sources)].slice(0, limit)) {
    try {
      previews.push({
        code,
        svg: await renderMermaidSvg(code, 'default', true),
      })
    }
    catch {
      // The main exporter keeps the source and reports each missing diagram.
    }
  }
  return previews
}
