import type { KeyBinding } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'

interface SelectionRange {
  from: number
  to: number
}

interface InlineMarkdownEdit {
  change: {
    from: number
    insert: string
    to: number
  }
  selection: SelectionRange
}

function createInlineMarkdownEdit(
  text: string,
  from: number,
  to: number,
  marker: string,
): InlineMarkdownEdit {
  const selection = text.slice(from, to)
  const markerLength = marker.length

  if (from === to) {
    return {
      change: {
        from,
        insert: `${marker}${marker}`,
        to,
      },
      selection: {
        from: from + markerLength,
        to: from + markerLength,
      },
    }
  }

  if (
    selection.length >= markerLength * 2
    && selection.startsWith(marker)
    && selection.endsWith(marker)
  ) {
    const unwrapped = selection.slice(
      markerLength,
      selection.length - markerLength,
    )

    return {
      change: {
        from,
        insert: unwrapped,
        to,
      },
      selection: {
        from,
        to: from + unwrapped.length,
      },
    }
  }

  const hasAdjacentMarkers
    = from >= markerLength
      && text.slice(from - markerLength, from) === marker
      && text.slice(to, to + markerLength) === marker

  if (hasAdjacentMarkers) {
    return {
      change: {
        from: from - markerLength,
        insert: selection,
        to: to + markerLength,
      },
      selection: {
        from: from - markerLength,
        to: from - markerLength + selection.length,
      },
    }
  }

  return {
    change: {
      from,
      insert: `${marker}${selection}${marker}`,
      to,
    },
    selection: {
      from: from + markerLength,
      to: to + markerLength,
    },
  }
}

export function toggleInlineMarkdown(
  text: string,
  from: number,
  to: number,
  marker: string,
) {
  const edit = createInlineMarkdownEdit(text, from, to, marker)

  return {
    selection: edit.selection,
    text:
      text.slice(0, edit.change.from)
      + edit.change.insert
      + text.slice(edit.change.to),
  }
}

function createInlineMarkdownCommand(marker: string) {
  return (view: Parameters<NonNullable<KeyBinding['run']>>[0]) => {
    const docText = view.state.doc.toString()
    const change = view.state.changeByRange((range) => {
      const edit = createInlineMarkdownEdit(
        docText,
        range.from,
        range.to,
        marker,
      )

      return {
        changes: edit.change,
        range: EditorSelection.range(edit.selection.from, edit.selection.to),
      }
    })

    view.dispatch(
      view.state.update(change, {
        scrollIntoView: true,
        userEvent: 'input',
      }),
    )

    return true
  }
}

export const markdownShortcuts: KeyBinding[] = [
  {
    key: 'Mod-b',
    run: createInlineMarkdownCommand('**'),
  },
  {
    key: 'Mod-i',
    run: createInlineMarkdownCommand('*'),
  },
  {
    key: 'Mod-Shift-s',
    run: createInlineMarkdownCommand('~~'),
  },
]
