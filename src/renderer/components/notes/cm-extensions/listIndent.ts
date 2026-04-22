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
  {
    key: 'Enter',
    run(view) {
      const { state } = view

      if (state.selection.ranges.length !== 1)
        return false

      const range = state.selection.main
      if (!range.empty)
        return false

      const currentLine = state.doc.lineAt(range.head)

      let firstLine: { from: number, text: string, number: number } | null
        = null

      if (listRe.test(currentLine.text)) {
        firstLine = currentLine
      }
      else if (/^\s/.test(currentLine.text)) {
        for (let ln = currentLine.number - 1; ln >= 1; ln--) {
          const prevLine = state.doc.line(ln)
          if (listRe.test(prevLine.text)) {
            firstLine = prevLine
            break
          }
          if (!/^\s/.test(prevLine.text) && prevLine.text !== '')
            break
          if (prevLine.text === '')
            break
        }
      }

      if (!firstLine)
        return false

      const match = firstLine.text.match(listRe)!

      if (
        currentLine.number === firstLine.number
        && range.head < firstLine.from + match[0].length
      ) {
        return false
      }

      const [full, indent, marker] = match
      const afterMarker = firstLine.text.slice(full.length)
      const taskMatch = afterMarker.match(/^\[[ x]\]\s/i)
      const hasTask = !!taskMatch
      const taskPrefixLen = hasTask ? taskMatch![0].length : 0

      const contentAfter = afterMarker.slice(taskPrefixLen).trim()
      const onFirstLine = currentLine.number === firstLine.number

      if (onFirstLine && contentAfter === '') {
        view.dispatch({
          changes: {
            from: firstLine.from,
            to: firstLine.from + full.length + taskPrefixLen,
            insert: '',
          },
          selection: { anchor: firstLine.from },
          scrollIntoView: true,
          userEvent: 'input',
        })
        return true
      }

      const orderedMatch = marker.match(/^(\d+)\.$/)
      const nextMarker = orderedMatch
        ? `${Number(orderedMatch[1]) + 1}.`
        : marker
      const taskSuffix = hasTask ? '[ ] ' : ''
      const nextPrefix = `${indent}${nextMarker} ${taskSuffix}`
      const insert = `\n${nextPrefix}`

      view.dispatch({
        changes: { from: range.from, to: range.to, insert },
        selection: { anchor: range.from + insert.length },
        scrollIntoView: true,
        userEvent: 'input',
      })
      return true
    },
  },
  {
    key: 'Shift-Enter',
    run(view) {
      const { state } = view

      if (state.selection.ranges.length !== 1)
        return false

      const range = state.selection.main
      if (!range.empty)
        return false

      const line = state.doc.lineAt(range.head)
      const match = line.text.match(listRe)
      if (!match)
        return false

      if (range.head < line.from + match[0].length)
        return false

      const insert = `\n${' '.repeat(match[0].length)}`

      view.dispatch({
        changes: { from: range.from, to: range.to, insert },
        selection: { anchor: range.from + insert.length },
        scrollIntoView: true,
        userEvent: 'input',
      })
      return true
    },
  },
]
