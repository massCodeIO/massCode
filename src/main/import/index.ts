import type {
  ImportApplySummary,
  ImportPayload,
  ImportPreview,
  ImportSource,
} from './common/types'
import { applyObsidianImport, previewObsidianImport } from './notes'
import { applySnippetImport, previewSnippetImport } from './snippets'

export function previewImport(
  source: ImportSource,
  payload: ImportPayload = {},
): Promise<ImportPreview> | ImportPreview {
  if (source === 'obsidian') {
    return previewObsidianImport(payload)
  }

  return previewSnippetImport(source, payload)
}

export function applyImport(
  source: ImportSource,
  payload: ImportPayload = {},
): Promise<ImportApplySummary> | ImportApplySummary {
  if (source === 'obsidian') {
    return applyObsidianImport(payload)
  }

  return applySnippetImport(source, payload)
}
