const commandNames = [
  'git',
  'gh',
  'npm',
  'pnpm',
  'yarn',
  'bun',
  'deno',
  'node',
  'npx',
  'bunx',
  'python',
  'pip',
  'cargo',
  'go',
  'docker',
  'kubectl',
  'xcodebuild',
  'xcodegen',
  'make',
  'cmake',
  'curl',
  'wget',
  'ssh',
  'rsync',
]

const commandNamePattern = new RegExp(
  `^(?:${commandNames.join('|')})(?:\\s|$)`,
)
const listMarkerPattern = /^(\s*)(?:[-+*]|\d+[.)])\s+/
const headingPattern = /^#{1,6}(?:\s+|$)/
const quotePattern = /^>\s?/
const horizontalRulePattern = /^(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/

type SubBlockKind =
  | 'code'
  | 'command'
  | 'list'
  | 'plain'
  | 'quote'
  | 'structure'

interface SubBlock {
  kind: SubBlockKind
  lines: string[]
}

function isCommandBody(line: string) {
  return /^(?:\.{1,2}\/|~\/|\/)\S*/.test(line) || commandNamePattern.test(line)
}

function isShellCommand(line: string) {
  return /^\$\s+/.test(line) || isCommandBody(line)
}

function isTableDelimiter(line: string) {
  const trimmed = line.trim().replace(/^\||\|$/g, '')
  const cells = trimmed.split('|')

  return (
    line.includes('|') && cells.every(cell => /^:?-{3,}:?$/.test(cell.trim()))
  )
}

function getFenceMarker(line: string) {
  return line.match(/^\s*(`{3,}|~{3,})/)?.[1]
}

function isFenceClosingLine(line: string, marker: string) {
  const markerCharacter = marker[0]
  const candidate = line.trim()

  return (
    candidate.length >= marker.length
    && [...candidate].every(character => character === markerCharacter)
  )
}

function pushSubBlock(blocks: SubBlock[], kind: SubBlockKind, line: string) {
  const previous = blocks.at(-1)

  if (previous?.kind === kind && ['code', 'quote'].includes(kind)) {
    previous.lines.push(line)
    return
  }

  blocks.push({ kind, lines: [line] })
}

function normalizeChunk(lines: string[]) {
  if (lines.some(isTableDelimiter))
    return lines.join('\n')

  const blocks: SubBlock[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    const listMatch = rawLine.match(listMarkerPattern)
    const previous = blocks.at(-1)

    if (/^(?:\t| {4,})/.test(rawLine)) {
      if (previous?.kind === 'list') {
        previous.lines.push(rawLine)
      }
      else {
        pushSubBlock(blocks, 'code', rawLine)
      }
      continue
    }

    if (listMatch) {
      const normalizedLine = `${listMatch[1]}${rawLine
        .slice(listMatch[1].length)
        .trim()}`
      if (previous?.kind === 'list') {
        previous.lines.push(normalizedLine)
      }
      else {
        blocks.push({ kind: 'list', lines: [normalizedLine] })
      }
      continue
    }

    if (isShellCommand(line)) {
      blocks.push({ kind: 'command', lines: [line] })
      continue
    }

    if (quotePattern.test(line)) {
      pushSubBlock(blocks, 'quote', line)
      continue
    }

    if (headingPattern.test(line) || horizontalRulePattern.test(line)) {
      blocks.push({ kind: 'structure', lines: [line] })
      continue
    }

    if (previous?.kind === 'list') {
      const lastIndex = previous.lines.length - 1
      previous.lines[lastIndex] = `${previous.lines[lastIndex]} ${line}`
      continue
    }

    if (previous?.kind === 'plain') {
      previous.lines.push(line)
    }
    else {
      blocks.push({ kind: 'plain', lines: [line] })
    }
  }

  return blocks
    .map((block) => {
      if (block.kind === 'plain')
        return block.lines.join(' ')

      return block.lines.join('\n')
    })
    .join('\n\n')
}

export function normalizeTerminalText(value: string) {
  const lines = value.replace(/\r\n?/g, '\n').split('\n')
  const blocks: string[] = []
  let chunk: string[] = []

  function flushChunk() {
    if (!chunk.length)
      return

    blocks.push(normalizeChunk(chunk))
    chunk = []
  }

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index]
    const fenceMarker = getFenceMarker(rawLine)

    if (fenceMarker) {
      flushChunk()
      const fenceLines = [rawLine]

      while (index + 1 < lines.length) {
        index += 1
        const fenceLine = lines[index]
        fenceLines.push(fenceLine)

        if (isFenceClosingLine(fenceLine, fenceMarker))
          break
      }

      blocks.push(fenceLines.join('\n'))
      continue
    }

    if (!rawLine.trim()) {
      flushChunk()
      continue
    }

    chunk.push(rawLine)
  }

  flushChunk()

  return blocks.join('\n\n')
}

export function mapNormalizedCursorIndex(
  value: string,
  cursorIndex: number,
  normalized = normalizeTerminalText(value),
) {
  const index = Math.min(Math.max(cursorIndex, 0), value.length)

  if (value[index] === '\n' || value[index] === '\r') {
    return Math.min(
      normalizeTerminalText(value.slice(0, index)).length,
      normalized.length,
    )
  }

  const normalizedSuffix = normalizeTerminalText(value.slice(index))

  if (!normalizedSuffix)
    return normalized.length

  if (normalized.endsWith(normalizedSuffix))
    return normalized.length - normalizedSuffix.length

  return Math.min(
    normalizeTerminalText(value.slice(0, index)).length,
    normalized.length,
  )
}
