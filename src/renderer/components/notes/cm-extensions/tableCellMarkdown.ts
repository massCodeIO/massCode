import { GFM, parser } from '@lezer/markdown'
import { Highlight } from './markdownHighlight'

// Статичный рендер inline-markdown содержимого ячейки таблицы (спокойное
// состояние, без редактора): маркеры скрыты, стили применены. Ячейка — одна
// строка, поэтому только inline-разметка.

const cellParser = parser.configure([GFM, Highlight])

// Узлы разметки, скрываемые при отрисовке (сами маркеры и url ссылки).
const HIDDEN_NODE_NAMES = new Set([
  'EmphasisMark',
  'StrikethroughMark',
  'HighlightMark',
  'CodeMark',
  'LinkMark',
  'URL',
])

const ELEMENT_BY_NODE: Record<string, string> = {
  StrongEmphasis: 'strong',
  Emphasis: 'em',
  Strikethrough: 'del',
  Highlight: 'mark',
  InlineCode: 'code',
  Link: 'a',
}

function styleRenderedElement(element: HTMLElement, tag: string) {
  if (tag === 'code') {
    element.style.fontFamily = 'var(--font-mono)'
    element.style.fontSize = '0.9em'
    element.style.background = 'var(--muted)'
    element.style.borderRadius = '4px'
    element.style.padding = '1px 4px'
  }

  if (tag === 'a') {
    element.style.color = 'var(--primary)'
    element.style.textDecoration = 'underline'
  }
}

export function renderCellMarkdown(raw: string): DocumentFragment {
  const fragment = document.createDocumentFragment()
  const containers: ParentNode[] = [fragment]
  let pos = 0

  const emitText = (to: number) => {
    if (to > pos) {
      containers[containers.length - 1].append(
        document.createTextNode(raw.slice(pos, to)),
      )
      pos = to
    }
  }

  cellParser.parse(raw).iterate({
    enter(node) {
      if (HIDDEN_NODE_NAMES.has(node.name)) {
        emitText(node.from)
        pos = Math.max(pos, node.to)
        return false
      }

      const tag = ELEMENT_BY_NODE[node.name]
      if (!tag)
        return

      emitText(node.from)
      const element = document.createElement(tag)
      styleRenderedElement(element, tag)
      containers[containers.length - 1].append(element)
      containers.push(element)
    },
    leave(node) {
      if (ELEMENT_BY_NODE[node.name]) {
        emitText(Math.min(node.to, raw.length))
        containers.pop()
      }
    },
  })

  emitText(raw.length)

  return fragment
}
