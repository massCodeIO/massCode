import type { SpaceId } from '@/spaceDefinitions'

export interface CommandPaletteScopeOption {
  spaceId: SpaceId
  title: string
}

export interface CommandPaletteTagOption {
  id: number
  name: string
  spaceId: Extract<SpaceId, 'code' | 'notes'>
}

export interface CommandPaletteTagFilter {
  id: number
  name: string
  spaceId: Extract<SpaceId, 'code' | 'notes'>
}

export interface CommandPaletteFolderOption {
  id: number
  name: string
  path: string
  spaceId: Extract<SpaceId, 'code' | 'notes' | 'http'>
}

export interface CommandPaletteFolderFilter {
  id: number
  name: string
  path: string
  spaceId: Extract<SpaceId, 'code' | 'notes' | 'http'>
}

export interface CommandPaletteParsedQuery {
  query: string
  scopeSpaceId?: SpaceId
  tagFilter?: CommandPaletteTagFilter
  folderFilter?: CommandPaletteFolderFilter
}

export interface CommandPaletteQueryParserOptions {
  activeScopeSpaceId?: SpaceId
  folderOptions?: readonly CommandPaletteFolderOption[]
  tagOptions?: readonly CommandPaletteTagOption[]
}

function normalizeScopeToken(value: string) {
  return value.trim().toLowerCase()
}

function getScopeSpaceId(
  token: string,
  scopeOptions: readonly CommandPaletteScopeOption[],
) {
  const normalizedToken = normalizeScopeToken(token)

  return scopeOptions.find((option) => {
    return (
      option.spaceId === normalizedToken
      || normalizeScopeToken(option.title) === normalizedToken
    )
  })?.spaceId
}

function getTagFilter(
  token: string,
  scopeSpaceId: SpaceId | undefined,
  tagOptions: readonly CommandPaletteTagOption[],
) {
  if (scopeSpaceId !== 'code' && scopeSpaceId !== 'notes') {
    return undefined
  }

  const normalizedToken = normalizeScopeToken(token)
  const tag = tagOptions.find((option) => {
    return (
      option.spaceId === scopeSpaceId
      && normalizeScopeToken(option.name) === normalizedToken
    )
  })

  return tag
    ? {
        id: tag.id,
        name: tag.name,
        spaceId: tag.spaceId,
      }
    : undefined
}

function getFolderFilter(
  token: string,
  scopeSpaceId: SpaceId | undefined,
  folderOptions: readonly CommandPaletteFolderOption[],
) {
  if (
    scopeSpaceId !== 'code'
    && scopeSpaceId !== 'notes'
    && scopeSpaceId !== 'http'
  ) {
    return undefined
  }

  const normalizedToken = normalizeScopeToken(token)
  const folder = folderOptions.find((option) => {
    return (
      option.spaceId === scopeSpaceId
      && (normalizeScopeToken(option.name) === normalizedToken
        || normalizeScopeToken(option.path) === normalizedToken)
    )
  })

  return folder
    ? {
        id: folder.id,
        name: folder.name,
        path: folder.path,
        spaceId: folder.spaceId,
      }
    : undefined
}

function parseFilterWords(
  words: string[],
  scopeSpaceId: SpaceId | undefined,
  options: CommandPaletteQueryParserOptions,
) {
  const queryWords: string[] = []
  let tagFilter: CommandPaletteTagFilter | undefined
  let folderFilter: CommandPaletteFolderFilter | undefined

  words.forEach((word) => {
    if (word.startsWith('#') && word.length > 1) {
      const nextTagFilter = getTagFilter(
        word.slice(1),
        scopeSpaceId,
        options.tagOptions ?? [],
      )

      if (nextTagFilter) {
        tagFilter = nextTagFilter
        return
      }
    }

    if (word.startsWith('/') && word.length > 1) {
      const nextFolderFilter = getFolderFilter(
        word.slice(1),
        scopeSpaceId,
        options.folderOptions ?? [],
      )

      if (nextFolderFilter) {
        folderFilter = nextFolderFilter
        return
      }
    }

    queryWords.push(word)
  })

  return {
    folderFilter,
    query: queryWords.join(' '),
    tagFilter,
  }
}

export function parseCommandPaletteQuery(
  value: string,
  scopeOptions: readonly CommandPaletteScopeOption[],
  options: CommandPaletteQueryParserOptions = {},
): CommandPaletteParsedQuery {
  const trimmedValue = value.trim()
  const [firstWord = '', ...restWords] = trimmedValue.split(/\s+/)

  if (!firstWord.startsWith('@') || firstWord.length === 1) {
    const effectiveScopeSpaceId = options.activeScopeSpaceId
    const filterResult = parseFilterWords(
      trimmedValue.split(/\s+/).filter(Boolean),
      effectiveScopeSpaceId,
      options,
    )

    return {
      ...filterResult,
      scopeSpaceId: undefined,
    }
  }

  const scopeSpaceId = getScopeSpaceId(firstWord.slice(1), scopeOptions)
  if (!scopeSpaceId) {
    return {
      query: trimmedValue,
      scopeSpaceId: undefined,
    }
  }

  const filterResult = parseFilterWords(restWords, scopeSpaceId, options)

  return {
    ...filterResult,
    scopeSpaceId,
  }
}
