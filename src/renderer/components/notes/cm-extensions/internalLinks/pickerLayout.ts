export interface InternalLinksPickerAnchor {
  left: number
  top: number
}

export type InternalLinksPickerSide = 'bottom' | 'top'

interface PickerViewport {
  height: number
  width: number
}

interface GetInternalLinksPickerLayoutOptions {
  anchor: InternalLinksPickerAnchor
  viewport: PickerViewport
}

export const INTERNAL_LINKS_PICKER_WIDTH = 320

const VIEWPORT_MARGIN = 12
const CONTENT_GAP = 8
const MAX_RESULTS_HEIGHT = 280
const MIN_PREFERRED_RESULTS_HEIGHT = 96

export function getInternalLinksPickerLayout(
  options: GetInternalLinksPickerLayoutOptions,
) {
  const maxLeft = Math.max(
    VIEWPORT_MARGIN,
    options.viewport.width - INTERNAL_LINKS_PICKER_WIDTH - VIEWPORT_MARGIN,
  )
  const left = Math.min(
    Math.max(options.anchor.left, VIEWPORT_MARGIN),
    maxLeft,
  )
  const spaceAbove = Math.max(
    0,
    options.anchor.top - VIEWPORT_MARGIN - CONTENT_GAP,
  )
  const spaceBelow = Math.max(
    0,
    options.viewport.height
    - options.anchor.top
    - VIEWPORT_MARGIN
    - CONTENT_GAP,
  )
  const side: InternalLinksPickerSide
    = spaceBelow >= MIN_PREFERRED_RESULTS_HEIGHT || spaceBelow >= spaceAbove
      ? 'bottom'
      : 'top'
  const availableHeight = side === 'bottom' ? spaceBelow : spaceAbove

  return {
    left,
    maxHeight: Math.max(0, Math.min(MAX_RESULTS_HEIGHT, availableHeight)),
    side,
  }
}
