import MarkdownIt from 'markdown-it'
import { findInternalLinks } from '../../shared/notes/internalLinks'

const MAX_SEARCH_RESULTS = 50
const SEARCH_EXCERPT_LENGTH = 160

export interface NoteFolderSiteSearchEntry {
  content: string
  folder: string
  href: string
  title: string
}

const searchMarkdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
})

searchMarkdown.inline.ruler.before(
  'emphasis',
  'masscode-internal-link',
  (state, silent) => {
    const match = findInternalLinks(state.src.slice(state.pos))[0]
    if (!match || match.from !== 0) {
      return false
    }

    if (!silent) {
      const token = state.push('masscode_internal_link', '', 0)
      token.content = match.label
    }
    state.pos += match.to
    return true
  },
)

const SITE_SEARCH_RUNTIME = `(() => {
  const input = document.querySelector('[data-site-search]')
  const navigation = document.querySelector('.site-nav')
  const results = document.querySelector('[data-site-search-results]')
  const empty = document.querySelector('[data-site-search-empty]')
  const prefix = document.currentScript?.dataset.searchPrefix || ''
  if (!(input instanceof HTMLInputElement) || !navigation || !results || !empty) return

  const normalize = value => value.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase()
  const entries = SEARCH_INDEX.map((entry, order) => ({
    ...entry,
    normalizedContent: normalize(entry.content),
    normalizedFolder: normalize(entry.folder),
    normalizedTitle: normalize(entry.title),
    order,
  }))
  const excerpt = (content, tokens) => {
    const value = content.trim()
    if (!value) return ''
    const normalized = normalize(value)
    const positions = tokens
      .map(token => normalized.indexOf(token))
      .filter(position => position >= 0)
    const match = positions.length ? Math.min(...positions) : 0
    const start = Math.max(0, match - 45)
    const end = Math.min(value.length, start + ${SEARCH_EXCERPT_LENGTH})
    return \`\${start > 0 ? '…' : ''}\${value.slice(start, end).trim()}\${end < value.length ? '…' : ''}\`
  }
  const appendResult = (entry, tokens, query) => {
    const link = document.createElement('a')
    link.className = 'site-search-result'
    link.href = prefix + entry.href + '?q=' + encodeURIComponent(query)

    const title = document.createElement('span')
    title.className = 'site-search-result-title'
    title.textContent = entry.title
    link.append(title)

    if (entry.folder) {
      const folder = document.createElement('span')
      folder.className = 'site-search-result-folder'
      folder.textContent = entry.folder
      link.append(folder)
    }

    const summary = excerpt(entry.content, tokens)
    if (summary) {
      const content = document.createElement('span')
      content.className = 'site-search-result-excerpt'
      content.textContent = summary
      link.append(content)
    }
    results.append(link)
  }
  const update = () => {
    const query = input.value.trim()
    const tokens = normalize(query).split(/\\s+/).filter(Boolean)
    results.replaceChildren()
    if (!tokens.length) {
      navigation.hidden = false
      results.hidden = true
      empty.hidden = true
      return
    }

    const matches = entries
      .map((entry) => {
        let score = 0
        for (const token of tokens) {
          if (entry.normalizedTitle.includes(token)) score += 100
          else if (entry.normalizedFolder.includes(token)) score += 10
          else if (entry.normalizedContent.includes(token)) score += 1
          else return null
        }
        return { entry, score }
      })
      .filter(Boolean)
      .sort((left, right) => right.score - left.score || left.entry.order - right.entry.order)
      .slice(0, ${MAX_SEARCH_RESULTS})

    navigation.hidden = true
    results.hidden = false
    empty.hidden = matches.length > 0
    matches.forEach(match => appendResult(match.entry, tokens, query))
  }

  input.addEventListener('input', update)
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    input.value = ''
    update()
  })
  const initialQuery = new URLSearchParams(window.location.search).get('q')?.trim()
  if (initialQuery) {
    input.value = initialQuery
    update()
  }
})()`

function extractSearchText(content: string): string {
  const parts: string[] = []

  for (const token of searchMarkdown.parse(content, {})) {
    if (token.type === 'fence' || token.type === 'code_block') {
      parts.push(token.content)
      continue
    }
    if (token.type !== 'inline') {
      continue
    }

    for (const child of token.children ?? []) {
      if (
        child.type === 'text'
        || child.type === 'code_inline'
        || child.type === 'image'
        || child.type === 'masscode_internal_link'
      ) {
        parts.push(child.content)
      }
      else if (child.type === 'softbreak' || child.type === 'hardbreak') {
        parts.push(' ')
      }
    }
  }

  return parts
    .join(' ')
    .replace(/\bmasscode:\/\/[^\s)]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function serializeSearchIndex(entries: NoteFolderSiteSearchEntry[]): string {
  return JSON.stringify(
    entries.map(entry => ({
      ...entry,
      content: extractSearchText(entry.content),
    })),
  ).replace(
    /[<>&\u2028\u2029]/g,
    character =>
      ({
        '<': '\\u003c',
        '>': '\\u003e',
        '&': '\\u0026',
        '\u2028': '\\u2028',
        '\u2029': '\\u2029',
      })[character]!,
  )
}

export function renderNoteFolderSiteSearchAsset(
  entries: NoteFolderSiteSearchEntry[],
): string {
  return `const SEARCH_INDEX=${serializeSearchIndex(entries)};\n${SITE_SEARCH_RUNTIME}\n`
}
