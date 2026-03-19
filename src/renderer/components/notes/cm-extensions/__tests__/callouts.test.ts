import { describe, expect, it } from 'vitest'
import {
  calloutTitleByType,
  parseBlockquoteCallout,
  shouldReplaceCalloutMarker,
} from '../callouts'

describe('parseBlockquoteCallout', () => {
  it('parses NOTE callout marker at blockquote start', () => {
    const result = parseBlockquoteCallout('> [!NOTE]')

    expect(result).toEqual({
      type: 'NOTE',
      markerStart: 2,
      markerEnd: 9,
      markerText: '[!NOTE]',
    })
  })

  it('parses IMPORTANT and WARNING in case-insensitive mode', () => {
    const important = parseBlockquoteCallout('>   [!important]')
    const warning = parseBlockquoteCallout('>[!warning]    ')

    expect(important?.type).toBe('IMPORTANT')
    expect(important?.markerText).toBe('[!important]')
    expect(warning?.type).toBe('WARNING')
    expect(warning?.markerText).toBe('[!warning]')
  })

  it('returns null for plain blockquote lines', () => {
    expect(parseBlockquoteCallout('> just a quote')).toBeNull()
    expect(parseBlockquoteCallout('not a blockquote [!NOTE]')).toBeNull()
  })

  it('returns null when marker is not at blockquote start', () => {
    expect(parseBlockquoteCallout('> text [!NOTE]')).toBeNull()
  })

  it('maps callout titles to user-friendly labels', () => {
    expect(calloutTitleByType.NOTE).toBe('Note')
    expect(calloutTitleByType.IMPORTANT).toBe('Important')
    expect(calloutTitleByType.WARNING).toBe('Warning')
  })

  it('uses smart/replace/raw modes for marker replacement', () => {
    expect(shouldReplaceCalloutMarker('replace', true)).toBe(true)
    expect(shouldReplaceCalloutMarker('replace', false)).toBe(true)

    expect(shouldReplaceCalloutMarker('smart', false)).toBe(true)
    expect(shouldReplaceCalloutMarker('smart', true)).toBe(false)

    expect(shouldReplaceCalloutMarker('raw', false)).toBe(false)
    expect(shouldReplaceCalloutMarker('raw', true)).toBe(false)
  })
})
