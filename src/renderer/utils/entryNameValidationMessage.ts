import {
  formatEntryNameValidationChars,
  getEntryNameValidationIssue,
} from '~/shared/entryNameValidation'

type TranslateFn = (key: string, params?: Record<string, unknown>) => string

export type EntryNameConflictKind = 'note' | 'snippet' | 'folder'

const CONFLICT_MESSAGE_KEYS: Record<EntryNameConflictKind, string> = {
  folder: 'messages:error.entryNameFolderConflict',
  note: 'messages:error.entryNameNoteConflict',
  snippet: 'messages:error.entryNameSnippetConflict',
}

export function getEntryNameValidationMessage(
  name: string,
  translate: TranslateFn,
): string {
  const issue = getEntryNameValidationIssue(name)

  if (!issue) {
    return ''
  }

  if (issue.code === 'invalidChars') {
    return translate('messages:error.entryNameInvalidChars', {
      chars: formatEntryNameValidationChars(issue.chars),
    })
  }

  if (issue.code === 'leadingDot') {
    return translate('messages:error.entryNameLeadingDot')
  }

  if (issue.code === 'trailingDot') {
    return translate('messages:error.entryNameTrailingDot')
  }

  if (issue.code === 'windowsReserved') {
    return translate('messages:error.entryNameWindowsReserved')
  }

  return translate('messages:error.entryNameEmpty')
}

export function getEntryNameConflictMessage(
  kind: EntryNameConflictKind,
  translate: TranslateFn,
): string {
  return translate(CONFLICT_MESSAGE_KEYS[kind])
}
