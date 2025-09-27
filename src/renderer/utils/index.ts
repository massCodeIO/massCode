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
