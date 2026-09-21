const labels: Record<string, string> = {
  bodyType: 'Body format',
  bodyKind: 'Captured body format',
  durationMs: 'Duration in milliseconds',
  sizeBytes: 'Size in bytes',
  executionTrace: 'Captured outgoing attempts',
  executionInput:
    'Draft used for this execution (before variable interpolation)',
  runtimeResults: 'Executed checks and extractions',
  sessionNames: 'Session variable names',
  environmentId: 'Selected environment ID',
  environmentValues: 'Environment availability',
  folderId: 'Folder ID',
  formData: 'Form fields',
  statusText: 'Status text',
  note: 'Capture details',
}

function valueText(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

function document(record: Record<string, unknown>): string {
  return Object.entries(record)
    .flatMap(([key, value]) => {
      if (key === 'error' && value == null)
        return []
      if (key === 'body' && value == null)
        return ['Body: no body is configured or available.']
      if (
        key === 'executionInput'
        && value
        && typeof value === 'object'
        && !Array.isArray(value)
      ) {
        return [
          `${labels[key]}:\n${document(value as Record<string, unknown>)}`,
        ]
      }
      if (
        key === 'runtimeResults'
        && value
        && typeof value === 'object'
        && !Array.isArray(value)
      ) {
        const results = value as Record<string, unknown>
        return [
          `${labels[key]}:\n${Object.entries(results)
            .map(([name, items]) => {
              const label
                = name === 'assertions'
                  ? 'Check results'
                  : name === 'extractions'
                    ? 'Extraction results'
                    : name
              return `${label}: ${Array.isArray(items) && !items.length ? 'None recorded.' : valueText(items)}`
            })
            .join('\n')}`,
        ]
      }
      // Body, headers, descriptions and other user data are rendered as-is.
      // Never rename/filter fields inside a JSON payload because they resemble metadata.
      return [`${labels[key] ?? key}:\n${valueText(value)}`]
    })
    .join('\n\n')
}

/** A readable view for model consumption; raw snapshots remain the validation source. */
export function httpContextDocument(text: string) {
  try {
    const record = JSON.parse(text)
    if (record && typeof record === 'object' && !Array.isArray(record))
      return document(record)
  }
  catch {}
  // Includes an incomplete capture with an explicit truncation marker.
  return text
}
