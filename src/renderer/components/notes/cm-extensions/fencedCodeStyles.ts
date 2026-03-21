const fencedCodeBaseStyle = [
  'background:var(--card)',
  'border-left:1px solid var(--border)',
  'border-right:1px solid var(--border)',
  'color:var(--foreground)',
  'font-family:var(--notes-code-font, var(--font-mono))',
  'font-size:13px',
  'line-height:1.2',
  'font-variant-ligatures:none',
  'padding-left:16px',
  'padding-right:16px',
].join(';')

export function buildFencedCodeLineStyle(
  lineNumber: number,
  startLineNumber: number,
  endLineNumber: number,
): string {
  let style = fencedCodeBaseStyle

  if (lineNumber === startLineNumber) {
    style
      += ';border-top:1px solid var(--border);border-top-left-radius:8px;border-top-right-radius:8px;padding-top:10px'
  }

  if (lineNumber === endLineNumber) {
    style
      += ';border-bottom:1px solid var(--border);border-bottom-left-radius:8px;border-bottom-right-radius:8px;padding-bottom:10px'
  }

  return style
}
