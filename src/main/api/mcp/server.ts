import type { httpMetadata } from './http'
import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { useNotesStorage, useStorage } from '../../storage'
import { registerHttpTools, searchHttpItems } from './http'
import { safely } from './results'
import { registerVaultTools } from './vault'
import { vaultMetadata } from './vaultItems'
import { registerVaultOrganizeTools } from './vaultOrganize'

export function createServer(version: string): McpServer {
  const server = new McpServer({ name: 'massCode', version })

  server.registerTool(
    'search',
    {
      description:
        'Search local snippets and notes by name and full text, and HTTP requests by name or URL. Returns metadata only, excluding trash. Results are sorted by updatedAt descending, type ascending, then id ascending.',
      inputSchema: {
        query: z.string().trim().min(1).max(4096),
        type: z.enum(['snippet', 'note', 'http_request', 'all']).default('all'),
        offset: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
        limit: z.number().int().min(1).max(100).default(20),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ query, type, offset, limit }) =>
      safely(async () => {
        const filter = { search: query, isDeleted: 0 }
        const items: (
          | ReturnType<typeof vaultMetadata>
          | ReturnType<typeof httpMetadata>
        )[] = []
        if (type === 'snippet' || type === 'all') {
          const { snippets } = useStorage()
          const found = snippets.getSnippetsAsync
            ? await snippets.getSnippetsAsync(filter)
            : snippets.getSnippets(filter)
          items.push(
            ...found
              .filter(item => !item.isDeleted)
              .map(item => vaultMetadata('snippet', item)),
          )
        }
        if (type === 'note' || type === 'all') {
          const { notes } = useNotesStorage()
          const found = notes.getNotesAsync
            ? await notes.getNotesAsync(filter)
            : notes.getNotes(filter)
          items.push(
            ...found
              .filter(item => !item.isDeleted)
              .map(item => vaultMetadata('note', item)),
          )
        }
        if (type === 'http_request' || type === 'all') {
          items.push(...searchHttpItems(query))
        }
        items.sort(
          (a, b) =>
            b.updatedAt - a.updatedAt
            || a.type.localeCompare(b.type)
            || a.id - b.id,
        )
        const page = items.slice(offset, offset + limit)
        const hasMore = offset + page.length < items.length
        return {
          items: page,
          hasMore,
          nextOffset: hasMore ? offset + page.length : null,
        }
      }, 'Search result JSON exceeds the 2 MiB limit. Reduce limit and retry; a single oversized item cannot be returned.'),
  )

  registerVaultTools(server)
  registerVaultOrganizeTools(server)
  registerHttpTools(server)

  return server
}
