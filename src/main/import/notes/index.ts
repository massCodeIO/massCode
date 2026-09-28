import type {
  ImportApplySummary,
  ImportPayload,
  ImportPreview,
} from '../common/types'
import { parseObsidianMarkdownFiles } from './obsidian'
import { applyNotesImportResult } from './persist'

export function previewObsidianImport(
  payload: ImportPayload = {},
): ImportPreview {
  const result = parseObsidianMarkdownFiles(payload.files || [])
  const folders = new Map<string, number>()
  const tags = new Map<string, string>()

  result.notes.forEach((note) => {
    const folderPath = note.folderPath?.filter(Boolean).join('/')
    if (folderPath) {
      folders.set(folderPath, (folders.get(folderPath) || 0) + 1)
    }

    note.tags?.forEach((tag) => {
      tags.set(tag.toLowerCase(), tag)
    })
  })

  return {
    folders: [...folders.entries()].map(([path, notes]) => ({
      path,
      snippets: notes,
    })),
    groups: [
      {
        name: 'Obsidian',
        snippets: result.notes.length,
      },
    ],
    notes: result.notes.length,
    snippets: 0,
    source: 'obsidian',
    tags: [...tags.values()].sort((a, b) => a.localeCompare(b)),
    warnings: result.warnings,
  }
}

export function applyObsidianImport(
  payload: ImportPayload = {},
): ImportApplySummary {
  return applyNotesImportResult(
    parseObsidianMarkdownFiles(payload.files || []),
  )
}
