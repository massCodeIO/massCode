import type { ContentSearchMatch } from '@/utils/contentSearch'
import type { Extension } from '@codemirror/state'
import { StateEffect, StateField } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view'

interface ContentSearchDecorations {
  matches: ContentSearchMatch[]
  currentIndex: number
}

const searchMatchDecoration = Decoration.mark({
  class: 'cm-content-search-match',
})
const currentSearchMatchDecoration = Decoration.mark({
  class: 'cm-content-search-match cm-content-search-current',
})

export const setContentSearchMatches
  = StateEffect.define<ContentSearchDecorations>()

const contentSearchField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    decorations = decorations.map(transaction.changes)

    for (const effect of transaction.effects) {
      if (effect.is(setContentSearchMatches)) {
        decorations = Decoration.set(
          effect.value.matches.map((match, index) =>
            (index === effect.value.currentIndex
              ? currentSearchMatchDecoration
              : searchMatchDecoration
            ).range(match.from, match.to),
          ),
        )
      }
    }

    return decorations
  },
  provide: field => EditorView.decorations.from(field),
})

const contentSearchTheme = EditorView.theme({
  '.cm-content-search-match': {
    backgroundColor: 'var(--text-highlight)',
    borderRadius: '2px',
    color: 'black !important',
  },
  '.cm-content-search-current': {
    outline: '1px solid var(--foreground)',
    outlineOffset: '1px',
  },
  '.cm-fenced-code-line .cm-content-search-match': {
    padding: '1px 0',
    boxDecorationBreak: 'clone',
    position: 'relative',
    zIndex: '1',
  },
  '.cm-fenced-code-line:has(.cm-content-search-current)': {
    position: 'relative',
    zIndex: '1',
    overflow: 'visible',
  },
  '.cm-content-search-current-cell': {
    boxShadow: 'inset 0 0 0 1px var(--foreground)',
  },
  '.cm-content-search-current-table': {
    boxShadow: 'inset 0 0 0 1px var(--foreground)',
    borderRadius: '4px',
  },
})

export function createContentSearch(): Extension {
  return [contentSearchField, contentSearchTheme]
}
