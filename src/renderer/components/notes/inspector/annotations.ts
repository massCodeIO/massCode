import type { CalloutType } from '../cm-extensions/callouts'
import { GFM, parser } from '@lezer/markdown'
import { parseBlockquoteCallout } from '../cm-extensions/callouts'

export interface NoteAnnotation {
  from: number
  to: number
  raw: string
  type: CalloutType
  text: string
}
const markdownParser = parser.configure(GFM)
export function getAnnotations(content: string): NoteAnnotation[] {
  const result: NoteAnnotation[] = []
  markdownParser.parse(content).iterate({
    enter(node) {
      if (node.name !== 'Blockquote')
        return
      const raw = content.slice(node.from, node.to)
      const line = raw.split('\n')[0]!
      const parsed = parseBlockquoteCallout(line)
      if (!parsed)
        return
      result.push({
        from: node.from,
        to: node.to,
        raw,
        type: parsed.type,
        text: `${line.slice(parsed.markerEnd)}\n${raw
          .split('\n')
          .slice(1)
          .map(line => line.replace(/^\s*>\s?/, ''))
          .join('\n')}`.trim(),
      })
    },
  })
  return result
}
