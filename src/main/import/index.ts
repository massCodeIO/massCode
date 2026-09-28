import type {
  ImportApplySummary,
  ImportPayload,
  ImportPreview,
  ImportSource,
} from './common/types'
import { detectImportSource } from './detect'
import { applyObsidianImport, previewObsidianImport } from './notes'
import { applySnippetImport, previewSnippetImport } from './snippets'

export async function previewImport(
  source: ImportSource | undefined,
  payload: ImportPayload = {},
): Promise<ImportPreview> {
  const resolvedSource = detectImportSource(source, payload)

  if (resolvedSource === 'obsidian') {
    return previewObsidianImport(payload)
  }

  return previewSnippetImport(resolvedSource, payload)
}

export async function applyImport(
  source: ImportSource | undefined,
  payload: ImportPayload = {},
): Promise<ImportApplySummary> {
  const resolvedSource = detectImportSource(source, payload)

  if (resolvedSource === 'obsidian') {
    return applyObsidianImport(payload)
  }

  return applySnippetImport(resolvedSource, payload)
}
