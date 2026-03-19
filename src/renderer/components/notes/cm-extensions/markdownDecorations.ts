import type { Range } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { Decoration, ViewPlugin, WidgetType } from '@codemirror/view'

class HorizontalRuleWidget extends WidgetType {
  toDOM(): HTMLElement {
    const hr = document.createElement('hr')
    hr.style.borderTop = '1px solid var(--border)'
    hr.style.margin = '14px 0'
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
    readonly interactive: boolean,
  ) {
    super()
  }

  eq(other: CheckboxWidget): boolean {
    return (
      this.checked === other.checked
      && this.pos === other.pos
      && this.interactive === other.interactive
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const checkbox = document.createElement('span')
    checkbox.setAttribute('aria-hidden', 'true')
    checkbox.style.display = 'inline-flex'
    checkbox.style.alignItems = 'center'
    checkbox.style.justifyContent = 'center'
    checkbox.style.width = '18px'
    checkbox.style.height = '18px'
    checkbox.style.marginRight = '6px'
    checkbox.style.borderRadius = '4px'
    checkbox.style.border = `1px solid ${this.checked ? 'var(--primary)' : 'var(--border)'}`
    checkbox.style.background = this.checked
      ? 'var(--primary)'
      : 'var(--background)'
    checkbox.style.color = 'var(--primary-foreground)'
    checkbox.style.cursor = this.interactive ? 'pointer' : 'default'
    checkbox.style.verticalAlign = 'middle'

    if (this.checked) {
      const checkmark = document.createElement('span')
      checkmark.textContent = '✓'
      checkmark.style.fontSize = '12px'
      checkmark.style.fontWeight = '700'
      checkmark.style.lineHeight = '1'
      checkbox.append(checkmark)
    }

    if (this.interactive) {
      checkbox.addEventListener('mousedown', (e) => {
        e.preventDefault()
        const replacement = this.checked ? '[ ]' : '[x]'
        view.dispatch({
          changes: { from: this.pos, to: this.pos + 3, insert: replacement },
        })
      })
    }

    return checkbox
  }

  ignoreEvent(): boolean {
    return false
  }
}

const headingStyles: Record<
  string,
  {
    fontSize: string
    fontWeight: string
    lineHeight: string
    paddingTop: string
    paddingBottom: string
  }
> = {
  ATXHeading1: {
    fontSize: '1.95em',
    fontWeight: '700',
    lineHeight: '1.25',
    paddingTop: '0.42em',
    paddingBottom: '0.2em',
  },
  ATXHeading2: {
    fontSize: '1.65em',
    fontWeight: '700',
    lineHeight: '1.28',
    paddingTop: '0.36em',
    paddingBottom: '0.18em',
  },
  ATXHeading3: {
    fontSize: '1.42em',
    fontWeight: '650',
    lineHeight: '1.3',
    paddingTop: '0.3em',
    paddingBottom: '0.15em',
  },
  ATXHeading4: {
    fontSize: '1.22em',
    fontWeight: '650',
    lineHeight: '1.34',
    paddingTop: '0.24em',
    paddingBottom: '0.12em',
  },
  ATXHeading5: {
    fontSize: '1.08em',
    fontWeight: '600',
    lineHeight: '1.4',
    paddingTop: '0.18em',
    paddingBottom: '0.08em',
  },
  ATXHeading6: {
    fontSize: '0.96em',
    fontWeight: '600',
    lineHeight: '1.42',
    paddingTop: '0.14em',
    paddingBottom: '0.06em',
  },
}

const inlineCodeStyle = [
  'background:var(--muted)',
  'border:1px solid var(--border)',
  'color:var(--foreground)',
  'font-family:var(--font-mono)',
  'padding:1px 6px',
  'border-radius:6px',
  'font-size:0.9em',
  'line-height:1.45',
].join(';')

const fencedCodeBaseStyle = [
  'background:var(--card)',
  'border-left:1px solid var(--border)',
  'border-right:1px solid var(--border)',
  'color:var(--foreground)',
  'font-family:var(--font-mono)',
  'font-size:13px',
  'line-height:1.2',
  'font-variant-ligatures:none',
  'padding-left:16px',
  'padding-right:16px',
].join(';')

const blockquoteBaseStyle = [
  'background:var(--muted)',
  'border-left:3px solid var(--primary)',
  'color:var(--muted-foreground)',
  'padding-left:12px',
  'padding-right:12px',
].join(';')

interface MarkdownDecorationsOptions {
  interactiveTaskMarkers?: boolean
}

function buildDecorations(view: EditorView, interactiveTaskMarkers: boolean) {
  const decorations: Range<Decoration>[] = []
  const indentedListLines = new Set<number>()

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        const type = node.name

        // Headings
        if (headingStyles[type]) {
          const {
            fontSize,
            fontWeight,
            lineHeight,
            paddingTop,
            paddingBottom,
          } = headingStyles[type]
          const line = view.state.doc.lineAt(node.from)
          decorations.push(
            Decoration.line({
              attributes: {
                style: `font-size:${fontSize};font-weight:${fontWeight};line-height:${lineHeight};padding-top:${paddingTop};padding-bottom:${paddingBottom}`,
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
                style: inlineCodeStyle,
              },
            }).range(node.from, node.to),
          )
        }

        // Fenced code blocks
        if (type === 'FencedCode') {
          const startLine = view.state.doc.lineAt(node.from)
          const endLine = view.state.doc.lineAt(node.to)

          for (let i = startLine.number; i <= endLine.number; i++) {
            const line = view.state.doc.line(i)
            let style = fencedCodeBaseStyle

            if (i === startLine.number) {
              style
                += ';border-top:1px solid var(--border);border-top-left-radius:8px;border-top-right-radius:8px;padding-top:10px;margin-top:8px'
            }
            if (i === endLine.number) {
              style
                += ';border-bottom:1px solid var(--border);border-bottom-left-radius:8px;border-bottom-right-radius:8px;padding-bottom:10px;margin-bottom:8px'
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
            let style = `${blockquoteBaseStyle};padding-top:2px;padding-bottom:2px`

            if (i === startLine.number) {
              style
                += ';border-top-right-radius:8px;padding-top:8px;margin-top:6px'
            }

            if (i === endLine.number) {
              style
                += ';border-bottom-right-radius:8px;padding-bottom:8px;margin-bottom:6px'
            }

            decorations.push(
              Decoration.line({
                attributes: {
                  style,
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

          const line = view.state.doc.lineAt(node.from)
          if (!indentedListLines.has(line.number)) {
            indentedListLines.add(line.number)
            decorations.push(
              Decoration.line({
                attributes: {
                  style: 'padding-left:14px',
                },
              }).range(line.from),
            )
          }

          decorations.push(
            Decoration.replace({
              widget: new CheckboxWidget(
                checked,
                node.from,
                interactiveTaskMarkers,
              ),
            }).range(node.from, node.to),
          )
        }

        // List marks (bullets, numbers)
        if (type === 'ListMark') {
          const line = view.state.doc.lineAt(node.from)
          if (!indentedListLines.has(line.number)) {
            indentedListLines.add(line.number)
            decorations.push(
              Decoration.line({
                attributes: {
                  style: 'padding-left:14px',
                },
              }).range(line.from),
            )
          }

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

export function createMarkdownDecorations(
  options: MarkdownDecorationsOptions = {},
) {
  const { interactiveTaskMarkers = true } = options

  return ViewPlugin.fromClass(
    class {
      decorations = Decoration.none

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, interactiveTaskMarkers)
      }

      update(update: {
        docChanged: boolean
        viewportChanged: boolean
        view: EditorView
      }) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildDecorations(
            update.view,
            interactiveTaskMarkers,
          )
        }
      }
    },
    {
      decorations: v => v.decorations,
    },
  )
}

export const markdownDecorations = createMarkdownDecorations()
