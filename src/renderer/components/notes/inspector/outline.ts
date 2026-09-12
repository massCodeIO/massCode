import type { TransactionSpec } from '@codemirror/state'
import { isolateHistory } from '@codemirror/commands'
import { GFM, parser } from '@lezer/markdown'

export interface OutlineHeading {
  from: number
  to: number
  end: number
  level: number
  depth: number
  parent: number | null
  title: string
}
export interface OutlineMove {
  content: string
  from: number
  target: number
  after: boolean
  inside?: boolean
}
const markdownParser = parser.configure(GFM)

export function getOutline(content: string): OutlineHeading[] {
  const headings: OutlineHeading[] = []
  const stack: OutlineHeading[] = []
  markdownParser.parse(content).iterate({
    enter(node) {
      // Headings inside quotes and lists are not document sections.
      if (
        [
          'Blockquote',
          'BulletList',
          'OrderedList',
          'FencedCode',
          'CodeBlock',
        ].includes(node.name)
      ) {
        return false
      }
      const match = /^(?:ATX|Setext)Heading([1-6])$/.exec(node.name)
      if (!match)
        return
      const level = Number(match[1])
      while (stack.length && stack.at(-1)!.level >= level)
        stack.pop()!.end = node.from
      const raw = content.slice(node.from, node.to)
      const title = node.name.startsWith('ATX')
        ? raw
            .replace(/^\s*#{1,6}(?:\s+|$)/, '')
            .replace(/\s+#+\s*$/, '')
            .trim()
        : raw.replace(/\n[^\n]+$/, '').trim()
      const heading: OutlineHeading = {
        from: node.from,
        to: node.to,
        end: content.length,
        level,
        depth: stack.length,
        parent: stack.at(-1)?.from ?? null,
        title,
      }
      headings.push(heading)
      stack.push(heading)
      return false
    },
  })
  return headings
}

export function getActiveHeading(headings: OutlineHeading[], cursor: number) {
  return headings.findLast(heading => heading.from <= cursor)?.from
}

export function createOutlineMove(
  content: string,
  move: OutlineMove,
): TransactionSpec | null {
  if (content !== move.content)
    return null
  const headings = getOutline(content)
  const source = headings.find(item => item.from === move.from)
  const target = headings.find(item => item.from === move.target)
  if (
    !source
    || !target
    || source === target
    || (target.from > source.from && target.from < source.end)
  ) {
    return null
  }
  const destination = move.inside || move.after ? target.end : target.from
  const level = target.level + (move.inside ? 1 : 0)
  const delta = level - source.level
  const children = headings.filter(
    item => item.from >= source.from && item.from < source.end,
  )
  if (children.some(item => item.level + delta > 6 || item.level + delta < 1))
    return null
  if (destination > source.from && destination < source.end)
    return null
  let section = content.slice(source.from, source.end)
  if (delta) {
    for (const heading of children.toReversed()) {
      const raw = content.slice(heading.from, heading.to)
      const replacement = /^\s*#/.test(raw)
        ? raw.replace(
            /^(\s*)#{1,6}/,
            (_, indent: string) => indent + '#'.repeat(heading.level + delta),
          )
        : `${'#'.repeat(heading.level + delta)} ${heading.title.replace(/\n/g, ' ')}`
      section
        = section.slice(0, heading.from - source.from)
          + replacement
          + section.slice(heading.to - source.from)
    }
  }
  if (destination === source.from || destination === source.end) {
    if (!delta)
      return null
    return {
      changes: { from: source.from, to: source.end, insert: section },
      selection: { anchor: source.from },
      annotations: isolateHistory.of('full'),
      userEvent: 'input.move',
    }
  }
  const separate = (text: string) =>
    text.endsWith('\n\n') ? text : text + (text.endsWith('\n') ? '\n' : '\n\n')
  if (destination < source.from) {
    const middle = content.slice(destination, source.from)
    return {
      changes: {
        from: destination,
        to: source.end,
        insert: separate(section) + middle,
      },
      selection: { anchor: destination },
      annotations: isolateHistory.of('full'),
      userEvent: 'input.move',
    }
  }
  const middle = content.slice(source.end, destination)
  const before = separate(middle)
  return {
    changes: { from: source.from, to: destination, insert: before + section },
    selection: { anchor: source.from + before.length },
    annotations: isolateHistory.of('full'),
    userEvent: 'input.move',
  }
}
