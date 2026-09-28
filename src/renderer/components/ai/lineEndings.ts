export type LineEndingStyle = 'none' | 'lf' | 'crlf' | 'cr' | 'mixed'

function lineEndings(text: string) {
  const endings = text.match(/\r\n|\r|\n/g) ?? []
  const types = new Set(endings)
  const style: LineEndingStyle
    = types.size > 1
      ? 'mixed'
      : types.has('\r\n')
        ? 'crlf'
        : types.has('\r')
          ? 'cr'
          : types.has('\n')
            ? 'lf'
            : 'none'
  return { style, endings }
}

// CodeMirror normalizes CRLF and CR. Preserve this information outside its document.
export function lineEndingChange(before: string, after: string) {
  const original = lineEndings(before)
  const proposed = lineEndings(after)
  // Adding/removing all line breaks is already visible in the diff; there is
  // no existing newline convention to compare on an empty or one-line side.
  if (original.style === 'none' || proposed.style === 'none')
    return undefined
  const changed
    = original.style !== proposed.style
      || (original.style === 'mixed'
        && JSON.stringify(original.endings) !== JSON.stringify(proposed.endings))
  return changed
    ? { before: original.style, after: proposed.style }
    : undefined
}
