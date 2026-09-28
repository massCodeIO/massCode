import type { WorkspaceChange } from '~/shared/aiWorkspace'

export function workspaceReviewFields(
  change: WorkspaceChange,
  rootLabel: string,
) {
  const before = JSON.parse(change.before) as Record<string, unknown>
  const after = JSON.parse(change.after) as Record<string, unknown>
  const diffFields = [
    'content',
    'description',
    'body',
    'scripts',
    'properties',
    'headers',
    'query',
    'auth',
  ]
  const format = (value: unknown) =>
    value === undefined || value === null
      ? '—'
      : typeof value === 'string'
        ? value
        : JSON.stringify(value, null, 2)
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter(
      key =>
        key !== 'contentId'
        && !(key === 'folderId' && before[key] == null && after[key] == null)
        && JSON.stringify(before[key]) !== JSON.stringify(after[key]),
    )
    .map(key => ({
      key,
      beforeTags:
        key === 'tags' && Array.isArray(before[key])
          ? (before[key] as string[])
          : [],
      afterTags:
        key === 'tags' && Array.isArray(after[key])
          ? (after[key] as string[])
          : [],
      diff: diffFields.includes(key),
      language:
        key === 'content'
          ? change.operation.space === 'notes'
            ? 'markdown'
            : String(
                after.language
                ?? before.language
                ?? change.operation.fields.language
                ?? 'plain',
              )
          : key === 'body'
            ? String(after.bodyType ?? before.bodyType ?? 'plain')
            : typeof after[key] === 'object'
              ? 'json'
              : 'plain',
      before:
        key === 'folderId' && before[key] == null
          ? rootLabel
          : before[key] == null && diffFields.includes(key)
            ? ''
            : format(before[key]),
      after:
        key === 'folderId' && after[key] == null
          ? rootLabel
          : after[key] == null && diffFields.includes(key)
            ? ''
            : format(after[key]),
    }))
}
