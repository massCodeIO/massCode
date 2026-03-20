export function isSelectionInsideRangeWithFocus(
  hasFocus: boolean,
  rangeFrom: number,
  rangeTo: number,
  blockFrom: number,
  blockTo: number,
  isEmpty: boolean,
): boolean {
  if (!hasFocus)
    return false

  if (isEmpty) {
    return rangeFrom >= blockFrom && rangeFrom <= blockTo
  }

  return rangeFrom < blockTo && rangeTo > blockFrom
}
