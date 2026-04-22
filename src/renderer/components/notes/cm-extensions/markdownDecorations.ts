import type { Range } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { Decoration, ViewPlugin, WidgetType } from '@codemirror/view'
import {
  calloutTitleByType,
  type CalloutTitleMode,
  type CalloutType,
  parseBlockquoteCallout,
  shouldReplaceCalloutMarker,
} from './callouts'
import { buildFencedCodeLineStyle } from './fencedCodeStyles'

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
    checkbox.style.textIndent = '0'

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

const calloutIconPaths: Record<CalloutType, string> = {
  NOTE: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  IMPORTANT:
    '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  WARNING:
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
}

function createCalloutIcon(type: CalloutType, color: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', '14')
  svg.setAttribute('height', '14')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', color)
  svg.setAttribute('stroke-width', '2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.style.marginRight = '5px'
  svg.style.flexShrink = '0'
  svg.innerHTML = calloutIconPaths[type]
  return svg
}

class CalloutTitleWidget extends WidgetType {
  constructor(
    readonly type: CalloutType,
    readonly title: string,
    readonly accent: string,
    readonly markerFrom: number,
  ) {
    super()
  }

  eq(other: CalloutTitleWidget): boolean {
    return (
      this.type === other.type
      && this.title === other.title
      && this.accent === other.accent
      && this.markerFrom === other.markerFrom
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const root = document.createElement('span')
    root.style.color = this.accent
    root.style.fontWeight = '600'
    root.style.display = 'inline-flex'
    root.style.alignItems = 'center'
    root.style.verticalAlign = 'baseline'
    root.style.height = '0'
    root.style.overflow = 'visible'

    root.append(createCalloutIcon(this.type, this.accent))
    root.append(this.title)

    root.addEventListener('mousedown', (event) => {
      event.preventDefault()
      view.dispatch({
        selection: {
          anchor: Math.min(this.markerFrom + 2, view.state.doc.length),
        },
        scrollIntoView: true,
      })
      view.focus()
    })

    return root
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
  'font-family:var(--notes-code-font, var(--font-mono))',
  'padding:1px 6px',
  'border-radius:6px',
  'font-size:0.9em',
  'line-height:1.45',
].join(';')

const blockquoteBaseStyle = [
  'background:var(--muted)',
  'border-left:3px solid var(--primary)',
  'color:var(--foreground)',
  'padding-left:12px',
  'padding-right:12px',
].join(';')

const calloutAccentByType: Record<CalloutType, string> = {
  NOTE: 'var(--primary)',
  IMPORTANT: 'var(--destructive)',
  WARNING: 'var(--warning)',
}

const CALLOUT_BACKGROUND_SATURATION = 10

function createCalloutBackground(baseColor: string): string {
  return `color-mix(in oklch, ${baseColor} ${CALLOUT_BACKGROUND_SATURATION}%, var(--background))`
}

const calloutBackgroundByType: Record<CalloutType, string> = {
  NOTE: createCalloutBackground(calloutAccentByType.NOTE),
  IMPORTANT: createCalloutBackground(calloutAccentByType.IMPORTANT),
  WARNING: createCalloutBackground(calloutAccentByType.WARNING),
}

function getCalloutBlockquoteStyle(type: CalloutType) {
  const accent = calloutAccentByType[type]
  const background = calloutBackgroundByType[type]
  return [
    `background:${background}`,
    `border-left:3px solid ${accent}`,
    'color:var(--foreground)',
    'padding-left:12px',
    'padding-right:12px',
  ].join(';')
}

interface MarkdownDecorationsOptions {
  interactiveTaskMarkers?: boolean
  calloutTitleMode?: CalloutTitleMode
}

interface MarkdownDecorationsUpdateFlags {
  docChanged: boolean
  selectionSet: boolean
  viewportChanged: boolean
  focusChanged: boolean
}

export function shouldRebuildMarkdownDecorations(
  update: MarkdownDecorationsUpdateFlags,
): boolean {
  return (
    update.docChanged
    || update.viewportChanged
    || update.selectionSet
    || update.focusChanged
  )
}

export function shouldReplaceHorizontalRule(
  interactiveTaskMarkers: boolean,
  hasFocus: boolean,
  isCursorOnRuleLine: boolean,
): boolean {
  if (!interactiveTaskMarkers)
    return true

  return !hasFocus || !isCursorOnRuleLine
}

export function shouldReplaceTaskMarker(
  interactive: boolean,
  hasFocus: boolean,
  isCursorOnMarkerLine: boolean,
): boolean {
  if (!interactive)
    return true

  return !hasFocus || !isCursorOnMarkerLine
}

function isCursorOnLine(view: EditorView, lineNumber: number): boolean {
  for (const range of view.state.selection.ranges) {
    const startLine = view.state.doc.lineAt(range.from).number
    const endLine = view.state.doc.lineAt(range.to).number
    if (lineNumber >= startLine && lineNumber <= endLine)
      return true
  }

  return false
}

function buildDecorations(
  view: EditorView,
  interactiveTaskMarkers: boolean,
  calloutTitleMode: CalloutTitleMode,
) {
  const decorations: Range<Decoration>[] = []

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
            const style = buildFencedCodeLineStyle(
              i,
              startLine.number,
              endLine.number,
            )

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
          const callout = parseBlockquoteCallout(startLine.text)
          const blockquoteStyle = callout
            ? getCalloutBlockquoteStyle(callout.type)
            : blockquoteBaseStyle

          if (callout) {
            const markerFrom = startLine.from + callout.markerStart
            const markerTo = startLine.from + callout.markerEnd
            const accent = calloutAccentByType[callout.type]
            const replaceMarker = shouldReplaceCalloutMarker(
              calloutTitleMode,
              isCursorOnLine(view, startLine.number),
              view.hasFocus,
            )

            if (replaceMarker) {
              decorations.push(
                Decoration.replace({
                  widget: new CalloutTitleWidget(
                    callout.type,
                    calloutTitleByType[callout.type],
                    accent,
                    markerFrom,
                  ),
                }).range(markerFrom, markerTo),
              )
            }
            else {
              decorations.push(
                Decoration.mark({
                  attributes: {
                    style: `color:${accent};font-weight:700;letter-spacing:0.01em`,
                  },
                }).range(markerFrom, markerTo),
              )
            }
          }

          for (let i = startLine.number; i <= endLine.number; i++) {
            const line = view.state.doc.line(i)
            let style = `${blockquoteStyle};padding-top:2px;padding-bottom:2px`

            if (i === startLine.number) {
              style += ';border-top-right-radius:8px;padding-top:8px'
            }

            if (i === endLine.number) {
              style += ';border-bottom-right-radius:8px;padding-bottom:8px'
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
          const line = view.state.doc.lineAt(node.from)
          if (
            shouldReplaceHorizontalRule(
              interactiveTaskMarkers,
              view.hasFocus,
              isCursorOnLine(view, line.number),
            )
          ) {
            decorations.push(
              Decoration.replace({
                widget: new HorizontalRuleWidget(),
              }).range(node.from, node.to),
            )
          }
        }

        // Task marker (checkbox)
        if (type === 'TaskMarker') {
          const text = view.state.sliceDoc(node.from, node.to)
          const checked = text.includes('x') || text.includes('X')

          const line = view.state.doc.lineAt(node.from)
          if (
            shouldReplaceTaskMarker(
              interactiveTaskMarkers,
              view.hasFocus,
              isCursorOnLine(view, line.number),
            )
          ) {
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

export function createMarkdownDecorations(
  options: MarkdownDecorationsOptions = {},
) {
  const { interactiveTaskMarkers = true, calloutTitleMode = 'smart' } = options

  return ViewPlugin.fromClass(
    class {
      decorations = Decoration.none

      constructor(view: EditorView) {
        this.decorations = buildDecorations(
          view,
          interactiveTaskMarkers,
          calloutTitleMode,
        )
      }

      update(update: {
        docChanged: boolean
        selectionSet: boolean
        viewportChanged: boolean
        focusChanged: boolean
        view: EditorView
      }) {
        if (shouldRebuildMarkdownDecorations(update)) {
          this.decorations = buildDecorations(
            update.view,
            interactiveTaskMarkers,
            calloutTitleMode,
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
