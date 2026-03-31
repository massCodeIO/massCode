import type { Extension } from '@codemirror/state'
import { createInternalLinksDecorations } from './decorations'
import { createInternalLinksNavigation } from './navigation'
import { createInternalLinksPreview } from './preview'
import { internalLinksTheme } from './styles'
import { createInternalLinksTrigger } from './trigger'

interface InternalLinksOptions {
  editable: boolean
  mode: 'raw' | 'livePreview' | 'preview'
}

export function createInternalLinks(
  options: InternalLinksOptions,
): Extension[] {
  const extensions: Extension[] = [internalLinksTheme]

  extensions.push(createInternalLinksTrigger(options))

  if (options.mode !== 'raw') {
    extensions.push(
      createInternalLinksDecorations(options.mode),
      createInternalLinksNavigation(),
      createInternalLinksPreview(),
    )
  }

  return extensions
}
