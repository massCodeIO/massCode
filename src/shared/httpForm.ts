import type { HttpFormDataEntry } from '../main/types/http'
import {
  interpolateHttpFormBody,
  interpolateHttpVariables,
} from './httpVariables'

/** A non-null body is a legacy raw form; null selects structured formData. */
export function buildHttpFormBody(
  body: string | null,
  entries: HttpFormDataEntry[],
  variables: Record<string, string> = {},
): string {
  if (body !== null)
    return interpolateHttpFormBody(body, variables)
  return entries
    .filter(entry => entry.enabled !== false && entry.key)
    .map(
      entry =>
        `${encodeURIComponent(interpolateHttpVariables(entry.key, variables))}=${encodeURIComponent(interpolateHttpVariables(entry.value, variables))}`,
    )
    .join('&')
}

export function readHttpFormEntries(
  body: string | null,
  entries: HttpFormDataEntry[],
): HttpFormDataEntry[] {
  if (body === null)
    return entries
  return [...new URLSearchParams(body)].map(([key, value]) => ({
    key,
    value,
    type: 'text',
  }))
}
