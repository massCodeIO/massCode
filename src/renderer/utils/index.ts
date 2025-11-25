import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function scrollToElement(selector: string) {
  const element = document.querySelector(selector)
  if (element) {
    element.scrollIntoView({ block: 'center' })
  }
}

export function getContiguousSelection(
  orderedIds: number[],
  anchorId: number | undefined,
  targetId: number,
): number[] {
  if (!orderedIds.length) {
    return []
  }

  const anchorIndex
    = anchorId !== undefined ? orderedIds.indexOf(anchorId) : -1
  const targetIndex = orderedIds.indexOf(targetId)

  if (targetIndex === -1) {
    return []
  }

  if (anchorIndex === -1) {
    return [targetId]
  }

  const startIndex = Math.min(anchorIndex, targetIndex)
  const endIndex = Math.max(anchorIndex, targetIndex)

  return orderedIds.slice(startIndex, endIndex + 1)
}
