import type { InternalLinksResolveResponse } from '@/services/api/generated'
import type { ExternalLinkMatch } from './externalLinks'
import type {
  InternalLinkMatch,
  InternalLinkType,
} from '~/shared/notes/internalLinks'
import { api } from '@/services/api'
import { buildNoteFolderPathMap } from '~/shared/notes/folderPath'
import { findExternalLinks } from './externalLinks'

export type ResolvedLink = NonNullable<
  InternalLinksResolveResponse[number]['resolved']
> & { path?: string }
export interface LinkRow {
  key: string
  status: 'linked' | 'planned' | 'missing' | 'pending' | 'external'
  type?: InternalLinkType | 'external'
  name: string
  aliases: string[]
  path?: string
  target?: { type: InternalLinkType, id: number }
  url?: string
  occurrences: (InternalLinkMatch | ExternalLinkMatch)[]
}

export function groupLinks(
  matches: InternalLinkMatch[],
  resolved: Map<string, ResolvedLink | null>,
): LinkRow[] {
  const rows = new Map<string, LinkRow>()
  for (const match of matches) {
    const entity = resolved.get(match.target)
    const status = match.plannedTarget
      ? 'planned'
      : entity
        ? 'linked'
        : resolved.has(match.target)
          ? 'missing'
          : 'pending'
    const type
      = match.plannedTarget?.type ?? entity?.type ?? match.legacyTarget?.type
    const key
      = status === 'linked'
        ? `${entity!.type}:${entity!.id}`
        : `${status}:${match.target}:${status === 'planned' ? (match.alias ?? '') : ''}`
    const existing = rows.get(key)
    if (existing) {
      existing.occurrences.push(match)
      continue
    }
    rows.set(key, {
      key,
      status,
      type,
      name:
        entity?.name
        ?? (match.plannedTarget ? match.alias : null)
        ?? match.basename,
      aliases: [],
      path: entity?.path,
      target: entity ? { type: entity.type, id: entity.id } : undefined,
      occurrences: [match],
    })
  }
  return [...rows.values()].map(row => ({
    ...row,
    aliases:
      row.status === 'planned'
        ? []
        : [
            ...new Set(
              row.occurrences.flatMap(match =>
                match.alias && match.alias !== row.name ? [match.alias] : [],
              ),
            ),
          ],
  }))
}

export async function resolveInspectorLinks(
  targets: string[],
): Promise<Map<string, ResolvedLink | null>> {
  const resolved: InternalLinksResolveResponse = []
  for (let offset = 0; offset < targets.length; offset += 500) {
    const { data } = await api.internalLinks.postInternalLinksResolve({
      titles: targets.slice(offset, offset + 500),
    })
    resolved.push(...data)
  }
  const types = new Set(
    resolved.flatMap(item => (item.resolved ? [item.resolved.type] : [])),
  )
  const [notes, snippets, http, requests] = await Promise.all([
    types.has('note')
      ? api.noteFolders.getNoteFolders().then(result => result.data)
      : [],
    types.has('snippet')
      ? api.folders.getFolders().then(result => result.data)
      : [],
    types.has('http-request')
      ? api.httpFolders.getHttpFolders().then(result => result.data)
      : [],
    types.has('http-request')
      ? api.httpRequests.getHttpRequests().then(result => result.data)
      : [],
  ])
  const paths = {
    'note': buildNoteFolderPathMap(notes),
    'snippet': buildNoteFolderPathMap(snippets),
    'http-request': buildNoteFolderPathMap(http),
  }
  const httpFolders = new Map(
    requests.map(request => [request.id, request.folderId]),
  )
  return new Map(
    resolved.map(({ title, resolved: item }) => {
      if (!item || item.isDeleted)
        return [title, null]
      const folderId
        = item.type === 'http-request'
          ? httpFolders.get(item.id)
          : item.folder?.id
      return [
        title,
        {
          ...item,
          path:
            folderId == null
              ? ''
              : (paths[item.type].get(folderId) ?? item.folder?.name ?? ''),
        },
      ]
    }),
  )
}

export function groupExternalLinks(content: string): LinkRow[] {
  const rows = new Map<string, LinkRow>()
  for (const match of findExternalLinks(content)) {
    const existing = rows.get(match.url)
    if (existing) {
      existing.occurrences.push(match)
      if (
        match.alias
        && match.alias !== existing.name
        && !existing.aliases.includes(match.alias)
      ) {
        existing.aliases.push(match.alias)
      }
    }
    else {
      rows.set(match.url, {
        key: `external:${match.url}`,
        status: 'external',
        type: 'external',
        url: match.url,
        name: match.alias || match.url,
        aliases: [],
        occurrences: [match],
      })
    }
  }
  return [...rows.values()]
}
