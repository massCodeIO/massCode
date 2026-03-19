const WORD_RE = /[\p{L}\p{N}_]+/gu

export function getTextStats(text: string): {
  symbols: number
  words: number
} {
  return {
    symbols: text.length,
    words: text.match(WORD_RE)?.length || 0,
  }
}
