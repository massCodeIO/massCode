import {
  currencySymbols,
  knownUnitTokens,
  NUMI_UNARY_FUNCTIONS,
  timeZoneAliases,
} from '@/composables/math-notebook/math-engine/constants'

const assignmentPattern = /^\s*([A-Z_]\w*)\s*=(?!=)/i
const highlightableTokenPattern = /R\$|[$€£¥₽₴₩₹]|[A-Z_]\w*/gi

const keywordTokens = new Set(['in', 'to', 'as', 'into', 'xor'])

const unitTokens = new Set([
  ...knownUnitTokens,
  'sq',
  'square',
  'cu',
  'cubic',
  'cb',
])

const builtinTokens = new Set([
  ...NUMI_UNARY_FUNCTIONS,
  'fromunix',
  'root',
  'log',
  'now',
  'time',
  'prev',
  'sum',
  'total',
  'avg',
  'average',
  'today',
  'tomorrow',
  'yesterday',
  'bitand',
  'bitor',
  'bitxor',
  'bitnot',
  'unitvalue',
  ...Object.keys(timeZoneAliases),
])

const currencySymbolTokens = new Set(Object.keys(currencySymbols))

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;')
}

function collectAssignedVariables(source: string) {
  const variables = new Set<string>()

  for (const line of source.split('\n')) {
    const match = line.match(assignmentPattern)
    if (!match) {
      continue
    }

    variables.add(match[1])
  }

  return variables
}

function resolveTokenClass(token: string, assignedVariables: Set<string>) {
  if (assignedVariables.has(token)) {
    return 'variable'
  }

  if (currencySymbolTokens.has(token)) {
    return 'unit'
  }

  const normalized = token.toLowerCase()

  if (keywordTokens.has(normalized)) {
    return 'keyword'
  }

  if (unitTokens.has(normalized)) {
    return 'unit'
  }

  if (builtinTokens.has(normalized)) {
    return 'builtin'
  }

  return null
}

function highlightLine(line: string, assignedVariables: Set<string>) {
  let html = ''
  let lastIndex = 0

  for (const match of line.matchAll(highlightableTokenPattern)) {
    const [token] = match
    const index = match.index ?? 0

    if (index > lastIndex) {
      html += escapeHtml(line.slice(lastIndex, index))
    }

    const tokenClass = resolveTokenClass(token, assignedVariables)
    const escapedToken = escapeHtml(token)

    html += tokenClass
      ? `<span class="mn-editor-token mn-editor-token--${tokenClass}">${escapedToken}</span>`
      : escapedToken

    lastIndex = index + token.length
  }

  if (lastIndex < line.length) {
    html += escapeHtml(line.slice(lastIndex))
  }

  return html
}

export function renderMathEditorHighlight(source: string) {
  const assignedVariables = collectAssignedVariables(source)

  return source
    .split('\n')
    .map(line => highlightLine(line, assignedVariables))
    .join('\n')
}
