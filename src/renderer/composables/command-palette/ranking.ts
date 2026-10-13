export interface CommandPaletteUsageScoreEntry {
  id: string
  openedAt: number
  openCount: number
  lastQuery?: string
}

export interface CommandPaletteRankableResult {
  id: string
  title: string
  subtitle?: string
  keywords?: string[]
}

interface RankOptions {
  query: string
  usageById?: Map<string, CommandPaletteUsageScoreEntry>
  now?: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_RECENCY_SCORE = 1_200
const MAX_FREQUENCY_SCORE = 1_800
const LAST_QUERY_SCORE = 1_200
export const MAX_USAGE_SCORE
  = MAX_RECENCY_SCORE + MAX_FREQUENCY_SCORE + LAST_QUERY_SCORE

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase()
}

function getSearchTokens(value: string) {
  return normalizeSearchValue(value)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

function isFuzzyMatch(value: string, query: string) {
  if (!query) {
    return true
  }

  let queryIndex = 0

  for (const character of value) {
    if (character === query[queryIndex]) {
      queryIndex += 1
      if (queryIndex === query.length) {
        return true
      }
    }
  }

  return false
}

function getTextMatchScore(
  result: CommandPaletteRankableResult,
  query: string,
) {
  const title = normalizeSearchValue(result.title)
  const subtitle = normalizeSearchValue(result.subtitle || '')
  const keywords = result.keywords?.map(normalizeSearchValue) || []

  if (!query) {
    return 0
  }

  if (title === query) {
    return 100_000
  }

  if (title.startsWith(query)) {
    return 90_000
  }

  if (getSearchTokens(title).some(token => token.startsWith(query))) {
    return 80_000
  }

  if (title.includes(query)) {
    return 70_000
  }

  if (isFuzzyMatch(title, query)) {
    return 50_000
  }

  if (keywords.includes(query)) {
    return 40_000
  }

  if (keywords.some(keyword => keyword.startsWith(query))) {
    return 35_000
  }

  if (keywords.some(keyword => keyword.includes(query))) {
    return 30_000
  }

  if (subtitle.includes(query)) {
    return 10_000
  }

  return 0
}

export function getCommandPaletteUsageScore(
  usage: CommandPaletteUsageScoreEntry | undefined,
  rawQuery: string,
  now = Date.now(),
) {
  if (!usage) {
    return 0
  }

  const query = normalizeSearchValue(rawQuery)
  const ageDays = Math.max(0, (now - usage.openedAt) / DAY_MS)
  const recencyScore = Math.max(0, MAX_RECENCY_SCORE - ageDays * 120)
  const frequencyScore = Math.min(
    MAX_FREQUENCY_SCORE,
    Math.log2(usage.openCount + 1) * 450,
  )
  const lastQuery = normalizeSearchValue(usage.lastQuery || '')
  const lastQueryScore
    = query && (lastQuery === query || lastQuery === `>${query}`)
      ? LAST_QUERY_SCORE
      : 0

  return recencyScore + frequencyScore + lastQueryScore
}

export function getCommandPaletteResultScore(
  result: CommandPaletteRankableResult,
  options: RankOptions,
) {
  const query = normalizeSearchValue(options.query)
  const textScore = getTextMatchScore(result, query)

  return (
    textScore
    + getCommandPaletteUsageScore(
      options.usageById?.get(result.id),
      query,
      options.now ?? Date.now(),
    )
  )
}

export function isCommandPaletteSearchMatch(
  result: CommandPaletteRankableResult,
  query: string,
) {
  return getTextMatchScore(result, normalizeSearchValue(query)) > 0
}
