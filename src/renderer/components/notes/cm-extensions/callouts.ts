export type CalloutType = 'NOTE' | 'IMPORTANT' | 'WARNING'
export type CalloutTitleMode = 'raw' | 'smart' | 'replace'

export const calloutTitleByType: Record<CalloutType, string> = {
  NOTE: 'Note',
  IMPORTANT: 'Important',
  WARNING: 'Warning',
}

export interface ParsedBlockquoteCallout {
  type: CalloutType
  markerStart: number
  markerEnd: number
  markerText: string
}

const CALLOUT_PATTERN = /^\s*>\s*(\[!(NOTE|IMPORTANT|WARNING)\])/i

export function parseBlockquoteCallout(
  lineText: string,
): ParsedBlockquoteCallout | null {
  const match = CALLOUT_PATTERN.exec(lineText)
  if (!match)
    return null

  const markerText = match[1]
  if (!markerText)
    return null

  const markerStart = lineText.indexOf(markerText)
  if (markerStart === -1)
    return null

  const rawType = match[2]
  if (!rawType)
    return null

  return {
    type: rawType.toUpperCase() as CalloutType,
    markerStart,
    markerEnd: markerStart + markerText.length,
    markerText,
  }
}

export function shouldReplaceCalloutMarker(
  mode: CalloutTitleMode,
  isCursorOnCalloutLine: boolean,
): boolean {
  if (mode === 'replace')
    return true

  if (mode === 'smart')
    return !isCursorOnCalloutLine

  return false
}
