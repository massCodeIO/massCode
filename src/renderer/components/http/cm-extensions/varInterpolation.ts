import type {
  CompletionContext,
  CompletionResult,
} from '@codemirror/autocomplete'
import type { Extension } from '@codemirror/state'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'
import { autocompletion } from '@codemirror/autocomplete'
import { Annotation, RangeSetBuilder } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view'

export const refreshVariablesAnnotation = Annotation.define<null>()

export function refreshVariables(view: EditorView) {
  view.dispatch({ annotations: refreshVariablesAnnotation.of(null) })
}

const VAR_REGEX = /\{\{([^{}]+)\}\}/g
const TRIGGER_REGEX = /\{\{([^{}]*)$/

const knownVarMark = Decoration.mark({ class: 'cm-var cm-var-known' })
const unknownVarMark = Decoration.mark({ class: 'cm-var cm-var-unknown' })

export interface VarInterpolationOptions {
  getVariables: () => Record<string, string>
}

function buildDecorations(
  view: EditorView,
  variables: Record<string, string>,
): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)
    let match: RegExpExecArray | null
    VAR_REGEX.lastIndex = 0
    // eslint-disable-next-line no-cond-assign
    while ((match = VAR_REGEX.exec(text)) !== null) {
      const start = from + match.index
      const end = start + match[0].length
      const name = match[1].trim()
      const isKnown = Object.prototype.hasOwnProperty.call(variables, name)
      builder.add(start, end, isKnown ? knownVarMark : unknownVarMark)
    }
  }

  return builder.finish()
}

function varDecorationPlugin(opts: VarInterpolationOptions) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, opts.getVariables())
      }

      update(update: ViewUpdate) {
        const refreshed = update.transactions.some(
          tr => tr.annotation(refreshVariablesAnnotation) !== undefined,
        )
        if (update.docChanged || update.viewportChanged || refreshed) {
          this.decorations = buildDecorations(update.view, opts.getVariables())
        }
      }
    },
    {
      decorations: v => v.decorations,
    },
  )
}

function varCompletionSource(opts: VarInterpolationOptions) {
  return (context: CompletionContext): CompletionResult | null => {
    const before = context.state.doc.sliceString(0, context.pos)
    const match = TRIGGER_REGEX.exec(before)
    if (!match)
      return null

    const variables = opts.getVariables()
    const keys = Object.keys(variables)
    if (keys.length === 0)
      return null

    const after = context.state.doc.sliceString(
      context.pos,
      Math.min(context.pos + 2, context.state.doc.length),
    )
    const closingPresent = after.startsWith('}}')

    return {
      from: context.pos - match[1].length,
      options: keys.map(name => ({
        label: name,
        detail: variables[name],
        type: 'variable',
        apply: closingPresent ? name : `${name}}}`,
      })),
      validFor: /^[^{}]*$/,
    }
  }
}

const varInterpolationTheme = EditorView.theme({
  '.cm-var': {
    padding: '0 5px',
    borderRadius: '4px',
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
  },
  '.cm-var-known': {
    color: 'var(--primary)',
    backgroundColor: 'color-mix(in oklch, var(--primary) 16%, transparent)',
  },
  '.cm-var-unknown': {
    color: 'var(--destructive)',
    backgroundColor: 'color-mix(in oklch, var(--destructive) 16%, transparent)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete': {
    backgroundColor: 'var(--popover)',
    color: 'var(--popover-foreground)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    boxShadow:
      '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    fontFamily: 'inherit',
    fontSize: '14px',
    minWidth: '8rem',
    padding: '4px',
    overflow: 'hidden',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': {
    fontFamily: 'inherit',
    maxHeight: '14rem',
    margin: '0',
    padding: '0',
    listStyle: 'none',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
    height: '28px',
    padding: '0 0.5rem',
    borderRadius: '2px',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'default',
    userSelect: 'none',
    color: 'var(--popover-foreground)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--accent)',
    color: 'var(--accent-foreground)',
  },
  '.cm-completionLabel': {
    flex: '1',
    minWidth: '0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  '.cm-completionMatchedText': {
    color: 'var(--primary)',
    textDecoration: 'none',
    fontWeight: '500',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected] .cm-completionMatchedText':
    {
      color: 'inherit',
    },
  '.cm-completionDetail': {
    color: 'var(--muted-foreground)',
    fontStyle: 'normal',
    marginLeft: 'auto',
    fontSize: '12px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '12rem',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected] .cm-completionDetail': {
    color: 'inherit',
    opacity: '0.8',
  },
})

export function varInterpolationExtension(
  opts: VarInterpolationOptions,
): Extension {
  return [
    varDecorationPlugin(opts),
    autocompletion({
      override: [varCompletionSource(opts)],
      activateOnTyping: true,
      icons: false,
    }),
    varInterpolationTheme,
  ]
}
