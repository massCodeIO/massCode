import type { Range } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { Decoration, ViewPlugin, WidgetType } from '@codemirror/view'

class HorizontalRuleWidget extends WidgetType {
  toDOM(): HTMLElement {
    const hr = document.createElement('hr')
    hr.style.borderTop = '1px solid var(--border)'
    hr.style.margin = '8px 0'
    hr.style.borderBottom = 'none'
    hr.style.borderLeft = 'none'
    hr.style.borderRight = 'none'
    return hr
  }
}

class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly pos: number,
  ) {
    super()
  }

  eq(other: CheckboxWidget): boolean {
    return this.checked === other.checked && this.pos === other.pos
  }

  toDOM(view: EditorView): HTMLElement {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = this.checked
    input.style.cursor = 'pointer'
    input.style.verticalAlign = 'middle'
    input.style.marginRight = '4px'

    input.addEventListener('mousedown', (e) => {
      e.preventDefault()
      const replacement = this.checked ? '[ ]' : '[x]'
      view.dispatch({
        changes: { from: this.pos, to: this.pos + 3, insert: replacement },
      })
    })

    return input
  }

  ignoreEvent(): boolean {
    return false
  }
}

const headingStyles: Record<string, { fontSize: string, fontWeight: string }>
  = {
    ATXHeading1: { fontSize: '1.8em', fontWeight: '700' },
    ATXHeading2: { fontSize: '1.5em', fontWeight: '700' },
    ATXHeading3: { fontSize: '1.3em', fontWeight: '600' },
    ATXHeading4: { fontSize: '1.1em', fontWeight: '600' },
    ATXHeading5: { fontSize: '1.0em', fontWeight: '600' },
    ATXHeading6: { fontSize: '0.9em', fontWeight: '600' },
  }

function buildDecorations(view: EditorView) {
  const decorations: Range<Decoration>[] = []

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        const type = node.name

        // Headings
        if (headingStyles[type]) {
          const { fontSize, fontWeight } = headingStyles[type]
          const line = view.state.doc.lineAt(node.from)
          decorations.push(
            Decoration.line({
              attributes: {
                style: `font-size:${fontSize};font-weight:${fontWeight};line-height:1.4`,
              },
            }).range(line.from),
          )
        }

        // Strong emphasis (bold)
        if (type === 'StrongEmphasis') {
          decorations.push(
            Decoration.mark({
              attributes: { style: 'font-weight:700' },
            }).range(node.from, node.to),
          )
        }

        // Emphasis (italic)
        if (type === 'Emphasis') {
          decorations.push(
            Decoration.mark({
              attributes: { style: 'font-style:italic' },
            }).range(node.from, node.to),
          )
        }

        // Strikethrough
        if (type === 'Strikethrough') {
          decorations.push(
            Decoration.mark({
              attributes: { style: 'text-decoration:line-through' },
            }).range(node.from, node.to),
          )
        }

        // Inline code
        if (type === 'InlineCode') {
          decorations.push(
            Decoration.mark({
              attributes: {
                style:
                  'background:color-mix(in srgb, var(--background) 80%, var(--foreground));font-family:var(--font-mono);padding:2px 4px;border-radius:3px;font-size:0.9em',
              },
            }).range(node.from, node.to),
          )
        }

        // Fenced code blocks
        if (type === 'FencedCode') {
          const startLine = view.state.doc.lineAt(node.from)
          const endLine = view.state.doc.lineAt(node.to)
          const baseStyle
            = 'background:color-mix(in srgb, var(--background) 90%, var(--foreground));font-family:var(--font-mono);font-size:0.9em;padding-left:16px;padding-right:16px'

          for (let i = startLine.number; i <= endLine.number; i++) {
            const line = view.state.doc.line(i)
            let style = baseStyle

            if (i === startLine.number) {
              style
                += ';border-top-left-radius:6px;border-top-right-radius:6px;padding-top:8px'
            }
            if (i === endLine.number) {
              style
                += ';border-bottom-left-radius:6px;border-bottom-right-radius:6px;padding-bottom:8px'
            }

            decorations.push(
              Decoration.line({
                attributes: { style },
              }).range(line.from),
            )
          }
        }

        // Blockquote
        if (type === 'Blockquote') {
          const startLine = view.state.doc.lineAt(node.from)
          const endLine = view.state.doc.lineAt(node.to)
          for (let i = startLine.number; i <= endLine.number; i++) {
            const line = view.state.doc.line(i)
            decorations.push(
              Decoration.line({
                attributes: {
                  style:
                    'border-left:3px solid var(--accent);padding-left:12px;color:var(--muted-foreground)',
                },
              }).range(line.from),
            )
          }
        }

        // Links
        if (type === 'Link' || type === 'URL') {
          decorations.push(
            Decoration.mark({
              attributes: {
                style:
                  'text-decoration:underline;color:var(--primary);cursor:pointer',
              },
            }).range(node.from, node.to),
          )
        }

        // Horizontal rule
        if (type === 'HorizontalRule') {
          decorations.push(
            Decoration.replace({
              widget: new HorizontalRuleWidget(),
            }).range(node.from, node.to),
          )
        }

        // Task marker (checkbox)
        if (type === 'TaskMarker') {
          const text = view.state.sliceDoc(node.from, node.to)
          const checked = text.includes('x') || text.includes('X')
          decorations.push(
            Decoration.replace({
              widget: new CheckboxWidget(checked, node.from),
            }).range(node.from, node.to),
          )
        }

        // List marks (bullets, numbers)
        if (type === 'ListMark') {
          decorations.push(
            Decoration.mark({
              attributes: { style: 'color:var(--muted-foreground)' },
            }).range(node.from, node.to),
          )
        }
      },
    })
  }

  return Decoration.set(decorations, true)
}

export const markdownDecorations = ViewPlugin.fromClass(
  class {
    decorations = Decoration.none

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }

    update(update: {
      docChanged: boolean
      viewportChanged: boolean
      view: EditorView
    }) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  {
    decorations: v => v.decorations,
  },
)
