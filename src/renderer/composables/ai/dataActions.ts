import type { ImportReporter } from '@/composables/importResult'
import type { AiContext } from './useAi'
import type {
  NoteExportResponse,
  NoteExportWarnings,
  NoteFolderSiteExportPrepareResponse,
  NoteFolderSiteExportResponse,
} from '~/main/types/ipc'
import type { AiDataAction } from '~/shared/aiDataActions'
import {
  getMermaidSources,
  renderDiagramPreviews,
} from '@/components/notes/diagramExport'
import {
  renderDrawingPreviews,
  renderDrawingPreviewsFromMarkdown,
} from '@/components/notes/drawingExport'
import { showNoteExportWarnings } from '@/components/notes/exportWarnings'
import { useContentSort } from '@/composables/useContentSort'
import { useHttpImportDialog } from '@/composables/useHttpImportDialog'
import { useImportDialog } from '@/composables/useImportDialog'
import { ipc } from '@/electron'
import { router, RouterName } from '@/router'
import { api } from '@/services/api'

export async function executeDataAction(
  action: AiDataAction,
  snapshot: AiContext | undefined,
  current: () => AiContext | undefined,
  report: ImportReporter,
  isCurrent: () => boolean,
) {
  if (!isCurrent())
    return report('cancelled')
  if (action.kind === 'import') {
    if (action.input.space === 'http') {
      await router.push({ name: RouterName.httpSpace })
      await nextTick()
      if (router.currentRoute.value.name !== RouterName.httpSpace)
        return report('cancelled')
      if (!isCurrent())
        return report('cancelled')
      useHttpImportDialog().openHttpImportDialog(report, isCurrent)
    }
    else {
      if (action.input.source === 'http-files')
        throw new Error('INVALID_IMPORT_SOURCE')
      useImportDialog().openImportDialog(
        action.input.source,
        action.input.space,
        report,
        isCurrent,
      )
    }
    report('opened')
    return
  }
  if (action.input.kind === 'notesFolder') {
    const preparation = (await ipc.invoke(
      'fs:prepare-note-folder-site-export',
      { folderId: action.input.id },
    )) as NoteFolderSiteExportPrepareResponse
    if (preparation.status !== 'ready')
      throw new Error('TARGET_UNAVAILABLE')
    const drawingPreviews = await renderDrawingPreviews(preparation.drawingIds)
    const diagramPreviews = await renderDiagramPreviews(
      preparation.mermaidSources ?? [],
      Math.max(0, 500 - drawingPreviews.length),
    )
    if (!isCurrent())
      return report('cancelled')
    report('opened')
    const result = (await ipc.invoke('fs:export-note-folder-site', {
      folderId: action.input.id,
      drawingPreviews,
      diagramPreviews,
      ...useContentSort().getContentSortQuery('notes'),
    })) as NoteFolderSiteExportResponse
    finishExport(
      report,
      result.status === 'exported'
        ? 'applied'
        : result.status === 'canceled'
          ? 'cancelled'
          : 'failed',
      result.status === 'exported' ? result.warnings : undefined,
    )
    return
  }
  let content: string
  let name: string
  if (action.input.source === 'current') {
    const live = current()
    if (
      snapshot?.space !== 'notes'
      || snapshot.noteId !== action.input.id
      || live?.space !== 'notes'
      || live.noteId !== snapshot.noteId
      || live.text !== snapshot.text
    ) {
      throw new Error('EDITOR_CHANGED')
    }
    content = snapshot.text
    name = snapshot.name ?? ''
  }
  else {
    const { data } = await api.notes.getNotesById(String(action.input.id))
    if (data.pendingCloudDownload || data.isDeleted)
      throw new Error('TARGET_UNAVAILABLE')
    content = data.content
    name = data.name
  }
  const drawingPreviews = await renderDrawingPreviewsFromMarkdown(content)
  const diagramPreviews = await renderDiagramPreviews(
    getMermaidSources(content),
    Math.max(0, 50 - drawingPreviews.length),
  )
  if (!isCurrent())
    return report('cancelled')
  report('opened')
  const result = (await ipc.invoke('fs:export-note', {
    content,
    name,
    format: action.input.format,
    drawingPreviews,
    diagramPreviews,
  })) as NoteExportResponse
  finishExport(
    report,
    result.canceled ? 'cancelled' : 'applied',
    result.warnings,
  )
}

function finishExport(
  report: ImportReporter,
  status: 'applied' | 'cancelled' | 'failed',
  warnings?: NoteExportWarnings,
) {
  if (status === 'applied' && warnings && Object.keys(warnings).length) {
    report(
      status,
      Object.fromEntries(
        Object.entries(warnings).map(([kind, count]) => [
          `${kind}Warnings`,
          count,
        ]),
      ),
    )
    showNoteExportWarnings(warnings)
  }
  else {
    report(status)
  }
}
