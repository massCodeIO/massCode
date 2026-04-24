import {
  formatEntryNameValidationChars,
  getEntryNameValidationIssue,
} from '~/shared/entryNameValidation'

type TranslateFn = (key: string, params?: Record<string, unknown>) => string

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
