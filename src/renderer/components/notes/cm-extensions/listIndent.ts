import type { ChangeSpec } from '@codemirror/state'
import type { KeyBinding } from '@codemirror/view'

const INDENT = '  '
const orderedRe = /^(\s*)(\d+)(\.)\s/
const listRe = /^(\s*)([-*+]|\d+\.)\s/

function countSiblingsAbove(
  doc: { line: (n: number) => { text: string } },
  lineNumber: number,
  targetIndent: string,
): number {
  let count = 0
  for (let i = lineNumber - 1; i >= 1; i--) {
    const text = doc.line(i).text
    const match = text.match(listRe)
    if (!match)
      break

    const indent = match[1]
    if (indent === targetIndent) {
      count++
    }
    else if (indent.length < targetIndent.length) {
      break
    }
  }
  return count
}

export const listIndent: KeyBinding[] = [
  {
    key: 'Tab',
    run(view) {
      const { state } = view
      const changes: ChangeSpec[] = []

      for (const range of state.selection.ranges) {
        const line = state.doc.lineAt(range.head)
        const ordered = line.text.match(orderedRe)

        if (ordered) {
          const [, indent, , dot] = ordered
          const newIndent = indent + INDENT
          const siblings = countSiblingsAbove(
            state.doc,
            line.number,
            newIndent,
          )
          const newNum = siblings + 1
          const oldPrefix = `${indent}${ordered[2]}${dot} `
          const newPrefix = `${newIndent}${newNum}${dot} `
          changes.push({
            from: line.from,
            to: line.from + oldPrefix.length,
            insert: newPrefix,
          })
        }
        else if (listRe.test(line.text)) {
          changes.push({ from: line.from, insert: INDENT })
        }
        else {
          changes.push({ from: range.from, insert: INDENT })
        }
      }

      view.dispatch({ changes, userEvent: 'input.indent' })
      return true
    },
  },
  {
    key: 'Shift-Tab',
    run(view) {
      const { state } = view
      const changes: ChangeSpec[] = []

      for (const range of state.selection.ranges) {
        const line = state.doc.lineAt(range.head)
        if (!line.text.startsWith(INDENT))
          continue

        const ordered = line.text.match(orderedRe)

        if (ordered) {
          const [, indent, , dot] = ordered
          const newIndent = indent.slice(INDENT.length)
          const siblings = countSiblingsAbove(
            state.doc,
            line.number,
            newIndent,
          )
          const newNum = siblings + 1
          const oldPrefix = `${indent}${ordered[2]}${dot} `
          const newPrefix = `${newIndent}${newNum}${dot} `
          changes.push({
            from: line.from,
            to: line.from + oldPrefix.length,
            insert: newPrefix,
          })
        }
        else if (listRe.test(line.text)) {
          changes.push({ from: line.from, to: line.from + INDENT.length })
        }
      }

      if (changes.length) {
        view.dispatch({ changes, userEvent: 'input.indent' })
      }
      return true
    },
  },
]
