import type {
  InternalLinkLookupItem,
  InternalLinkType,
} from '../../../../../../shared/notes/internalLinks'
import {
  normalizeInternalLinkLookupKey,
  splitInternalLinkTarget,
} from '../../../../../../shared/notes/internalLinks'

interface ResolvedInternalLinkTarget {
  id: number
  type: InternalLinkType
}

interface NoteTitleCandidate {
  folderPath: string
  id: number
}

export interface InternalLinkResolver {
  resolve: (
    target: string,
    options?: { linkerFolderPath?: string },
  ) => ResolvedInternalLinkTarget | null
}

function normalizeFolderPath(folderPath: string | undefined): string {
  if (!folderPath) {
    return ''
  }

  return folderPath
    .split('/')
    .map(segment => segment.trim())
    .filter(segment => segment.length > 0)
    .join('/')
}

function buildFolderAncestorWalk(folderPath: string): string[] {
  const normalized = normalizeFolderPath(folderPath)

  if (!normalized) {
    return ['']
  }

  const segments = normalized.split('/')
  const ancestors: string[] = []

  for (let index = segments.length; index >= 0; index -= 1) {
    ancestors.push(segments.slice(0, index).join('/'))
  }

  return ancestors
}

function buildPathLookupKey(pathSegments: string[], basename: string): string {
  return [...pathSegments, basename]
    .map(segment => normalizeInternalLinkLookupKey(segment))
    .join('/')
}

/**
 * Index-backed equivalent of `resolveInternalLinkTargetByTitle`: builds
 * lookup maps once so repeated resolution over the same items is O(1)
 * instead of a linear scan per link.
 */
export function createInternalLinkResolver(
  items: InternalLinkLookupItem[],
): InternalLinkResolver {
  const pathTargetByKey = new Map<string, ResolvedInternalLinkTarget>()
  const snippetByTitle = new Map<string, ResolvedInternalLinkTarget>()
  const httpRequestByTitle = new Map<string, ResolvedInternalLinkTarget>()
  const noteCandidatesByTitle = new Map<string, NoteTitleCandidate[]>()

  for (const item of items) {
    const titleKey = normalizeInternalLinkLookupKey(item.name)
    const target: ResolvedInternalLinkTarget = { id: item.id, type: item.type }

    if (item.type === 'note' || item.type === 'http-request') {
      const folderSegments = normalizeFolderPath(item.folderPath)
        .split('/')
        .filter(segment => segment.length > 0)
      const pathKey = buildPathLookupKey(folderSegments, item.name)

      if (!pathTargetByKey.has(pathKey)) {
        pathTargetByKey.set(pathKey, target)
      }
    }

    if (item.type === 'snippet') {
      if (!snippetByTitle.has(titleKey)) {
        snippetByTitle.set(titleKey, target)
      }
      continue
    }

    if (item.type === 'http-request') {
      if (!httpRequestByTitle.has(titleKey)) {
        httpRequestByTitle.set(titleKey, target)
      }
      continue
    }

    let candidates = noteCandidatesByTitle.get(titleKey)
    if (!candidates) {
      candidates = []
      noteCandidatesByTitle.set(titleKey, candidates)
    }

    candidates.push({
      folderPath: normalizeFolderPath(item.folderPath),
      id: item.id,
    })
  }

  return {
    resolve(target, options) {
      const { basename, pathSegments } = splitInternalLinkTarget(target)

      if (!basename) {
        return null
      }

      if (pathSegments.length > 0) {
        return (
          pathTargetByKey.get(buildPathLookupKey(pathSegments, basename))
          ?? null
        )
      }

      const titleKey = normalizeInternalLinkLookupKey(basename)

      const snippet = snippetByTitle.get(titleKey)
      if (snippet) {
        return snippet
      }

      const noteCandidates = noteCandidatesByTitle.get(titleKey)
      if (!noteCandidates || noteCandidates.length === 0) {
        return httpRequestByTitle.get(titleKey) ?? null
      }

      if (noteCandidates.length === 1) {
        return { id: noteCandidates[0].id, type: 'note' }
      }

      const ancestors = buildFolderAncestorWalk(
        options?.linkerFolderPath ?? '',
      )

      for (const ancestorPath of ancestors) {
        const match = noteCandidates.find(
          candidate => candidate.folderPath === ancestorPath,
        )

        if (match) {
          return { id: match.id, type: 'note' }
        }
      }

      return { id: noteCandidates[0].id, type: 'note' }
    },
  }
}
