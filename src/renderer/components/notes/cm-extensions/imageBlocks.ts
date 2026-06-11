import type { EditorState } from '@codemirror/state'
import { i18n } from '@/electron'
import { isMac } from '@/utils'
import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, StateField } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
} from '@codemirror/view'
import {
  getDrawingIdFromUrl,
  openDrawingInSpace,
  renderDrawingEmbed,
} from './drawingEmbed'
import { editorFocusField, setEditorFocusEffect } from './editorFocus'
import { isSelectionInsideRangeWithFocus } from './selectionRange'

interface ImageBlocksOptions {
  enabled?: boolean
  isDark?: boolean
  showSourceWhenSelectionInside?: boolean
}

function extractImageUrl(
  state: EditorState,
  from: number,
  to: number,
): string | null {
  const text = state.sliceDoc(from, to)
  const match = /!\[[^\]]*\]\(([^)]+)\)/.exec(text)
  return match?.[1] ?? null
}

function isSelectionInsideRange(
  state: EditorState,
  from: number,
  to: number,
): boolean {
  const hasFocus = state.field(editorFocusField, false) ?? false

  for (const range of state.selection.ranges) {
    if (
      isSelectionInsideRangeWithFocus(
        hasFocus,
        range.from,
        range.to,
        from,
        to,
        range.empty,
      )
    ) {
      return true
    }
  }

  return false
}

class ImageWidget extends WidgetType {
  constructor(
    readonly url: string,
    readonly isDark: boolean,
    readonly activateSourceOnClick: boolean,
  ) {
    super()
  }

  eq(other: ImageWidget): boolean {
    return (
      this.url === other.url
      && this.isDark === other.isDark
      && this.activateSourceOnClick === other.activateSourceOnClick
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const root = document.createElement('div')
    root.style.maxWidth = '100%'
    root.style.padding = '4px 0'

    if (this.activateSourceOnClick) {
      root.style.cursor = 'text'
    }

    const drawingId = getDrawingIdFromUrl(this.url)

    if (drawingId) {
      const container = document.createElement('div')
      container.className
        = 'my-1 overflow-auto rounded-md border border-border p-4'
      container.title = `${i18n.t('spaces.drawings.openInSpace')} (${
        isMac ? '⌘' : 'Ctrl'
      }+Click)`
      root.append(container)
      void renderDrawingEmbed(container, drawingId, this.isDark)

      if (!this.activateSourceOnClick) {
        root.style.cursor = 'pointer'
      }

      // Like internal links: Cmd/Ctrl+Click opens the drawing in the
      // Drawings space; in preview mode a plain click works too.
      root.addEventListener('mousedown', (event) => {
        const isNavigationClick = isMac ? event.metaKey : event.ctrlKey

        if (isNavigationClick || !this.activateSourceOnClick) {
          event.preventDefault()
          // Also blocks the activate-source handler on the same element.
          event.stopImmediatePropagation()
          openDrawingInSpace(drawingId)
        }
      })
    }
    else {
      const img = document.createElement('img')
      img.src = this.url
      img.style.maxWidth = '100%'
      img.style.borderRadius = '8px'
      img.style.border = '1px solid var(--border)'
      img.style.display = 'block'
      img.setAttribute('draggable', 'false')

      root.append(img)
    }

    if (this.activateSourceOnClick) {
      root.addEventListener('mousedown', (event) => {
        event.preventDefault()
        const blockFrom = view.posAtDOM(root, 0)
        view.dispatch({
          selection: { anchor: blockFrom },
          effects: setEditorFocusEffect.of(true),
          scrollIntoView: true,
        })
        view.focus()
      })
    }

    return root
  }
}

function buildDecorations(
  state: EditorState,
  enabled: boolean,
  isDark: boolean,
  showSourceWhenSelectionInside: boolean,
) {
  if (!enabled)
    return Decoration.none

  const builder = new RangeSetBuilder<Decoration>()

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'Image')
        return

      if (
        showSourceWhenSelectionInside
        && isSelectionInsideRange(state, node.from, node.to)
      ) {
        return
      }

      const url = extractImageUrl(state, node.from, node.to)
      if (!url)
        return

      builder.add(
        node.from,
        node.to,
        Decoration.replace({
          block: true,
          widget: new ImageWidget(url, isDark, showSourceWhenSelectionInside),
        }),
      )
    },
  })

  return builder.finish()
}

export function getImageBlockRanges(
  state: EditorState,
): { from: number, to: number }[] {
  const ranges: { from: number, to: number }[] = []

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'Image')
        return

      const url = extractImageUrl(state, node.from, node.to)
      if (url)
        ranges.push({ from: node.from, to: node.to })
    },
  })

  return ranges
}

export function createImageBlocks(options: ImageBlocksOptions = {}) {
  const {
    enabled = true,
    isDark = false,
    showSourceWhenSelectionInside = false,
  } = options

  return StateField.define<DecorationSet>({
    create(state) {
      return buildDecorations(
        state,
        enabled,
        isDark,
        showSourceWhenSelectionInside,
      )
    },
    update(decorations, transaction) {
      const selectionChanged = !transaction.startState.selection.eq(
        transaction.state.selection,
      )
      const focusChanged = transaction.effects.some(e =>
        e.is(setEditorFocusEffect),
      )

      if (transaction.docChanged || selectionChanged || focusChanged) {
        return buildDecorations(
          transaction.state,
          enabled,
          isDark,
          showSourceWhenSelectionInside,
        )
      }

      return decorations.map(transaction.changes)
    },
    provide: field => EditorView.decorations.from(field),
  })
}
