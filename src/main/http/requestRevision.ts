import type { HttpRequestRecord } from '../storage/providers/markdown/http/runtime/types'
import { createHash } from 'node:crypto'

/** Saved request content only; runtime rules have their own independent revision. */
export function httpRequestRevision(request: HttpRequestRecord): string {
  const {
    id,
    createdAt,
    name,
    folderId,
    method,
    url,
    headers,
    query,
    bodyType,
    body,
    formData,
    auth,
    description,
    isDeleted,
  } = request
  return createHash('sha256')
    .update(
      JSON.stringify(
        {
          id,
          createdAt,
          name,
          folderId,
          protocol: request.protocol ?? 'http',
          method,
          url,
          headers,
          query,
          bodyType,
          body,
          formData,
          auth,
          description,
          isDeleted,
        },
        (_key, value) =>
          value && typeof value === 'object' && !Array.isArray(value)
            ? Object.fromEntries(
                Object.entries(value).sort(([a], [b]) => a.localeCompare(b)),
              )
            : value,
      ),
    )
    .digest('hex')
}
