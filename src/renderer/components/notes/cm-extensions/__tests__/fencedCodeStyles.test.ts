import { describe, expect, it } from 'vitest'
import { buildFencedCodeLineStyle } from '../fencedCodeStyles'

describe('buildFencedCodeLineStyle', () => {
  it('does not use margins in line decorations', () => {
    const firstLine = buildFencedCodeLineStyle(3, 3, 6)
    const lastLine = buildFencedCodeLineStyle(6, 3, 6)

    expect(firstLine).not.toContain('margin-top')
    expect(lastLine).not.toContain('margin-bottom')
  })

  it('keeps top and bottom chrome for fenced block container', () => {
    const firstLine = buildFencedCodeLineStyle(3, 3, 6)
    const middleLine = buildFencedCodeLineStyle(4, 3, 6)
    const lastLine = buildFencedCodeLineStyle(6, 3, 6)

    expect(firstLine).toContain('border-top:1px solid var(--border)')
    expect(firstLine).toContain('border-top-left-radius:8px')
    expect(firstLine).toContain('padding-top:10px')

    expect(lastLine).toContain('border-bottom:1px solid var(--border)')
    expect(lastLine).toContain('border-bottom-right-radius:8px')
    expect(lastLine).toContain('padding-bottom:10px')

    expect(middleLine).not.toContain('border-top')
    expect(middleLine).not.toContain('border-bottom')
  })
})
