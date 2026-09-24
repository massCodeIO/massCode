import type { AiNativeAction } from '~/shared/aiNativeActions'
import { findInternalLinks } from '~/shared/notes/internalLinks'
import { getAnnotations } from './annotations'
import { groupExternalLinks } from './links'
import { getOutline } from './outline'

/** Derive native positions from current content; callers never supply offsets. */
export function resolveNativeNoteTarget(
  content: string,
  action: Extract<AiNativeAction, { action: 'notesReveal' }>,
) {
  const index = action.occurrence - 1
  if (action.kind === 'heading') {
    const match = getOutline(content).filter(
      item => item.title === action.value,
    )[index]
    return match ? { kind: 'heading' as const, match } : undefined
  }
  if (action.kind === 'annotation') {
    const match = getAnnotations(content).filter(
      item => item.text === action.value,
    )[index]
    return match ? { kind: 'annotation' as const, match } : undefined
  }
  const matches
    = action.kind === 'internalLink'
      ? findInternalLinks(content).filter(
          item => item.target === action.value,
        )
      : (groupExternalLinks(content).find(item => item.url === action.value)?.occurrences ?? [])
  const match = matches[index]
  return match ? { kind: 'link' as const, match } : undefined
}
