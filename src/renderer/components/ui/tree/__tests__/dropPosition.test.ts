import { describe, expect, it } from 'vitest'
import { getDropPosition, isUnchangedDrop } from '../dropPosition'

describe('tree drop position', () => {
  it('keeps an insertion between two collections when the pointer crosses their boundary', () => {
    expect(getDropPosition(121, { top: 100, height: 22 }, true)).toBe('after')
    expect(getDropPosition(123, { top: 122, height: 22 }, true)).toBe('before')
  })

  it('uses the row bounds even when the event target is a nested label or icon', () => {
    const event = { clientY: 121, offsetY: 0 }
    expect(getDropPosition(event.clientY, { top: 100, height: 22 }, true)).toBe(
      'after',
    )
  })

  it('retains the inside zone and supports both sides of a leaf', () => {
    expect(getDropPosition(111, { top: 100, height: 22 }, true)).toBe('center')
    expect(getDropPosition(102, { top: 100, height: 22 }, false)).toBe(
      'before',
    )
    expect(getDropPosition(120, { top: 100, height: 22 }, false)).toBe('after')
  })
})

describe('unchanged tree drops', () => {
  const siblings = ['A', 'B', 'C', 'D', 'E'].map(id => ({ id, label: id }))

  it('rejects the boundaries directly above and below the dragged node', () => {
    const dragged = [siblings[2]!]
    expect(isUnchangedDrop(siblings, dragged, 'B', 'after')).toBe(true)
    expect(isUnchangedDrop(siblings, dragged, 'D', 'before')).toBe(true)
    expect(isUnchangedDrop(siblings, dragged, 'A', 'after')).toBe(false)
    expect(isUnchangedDrop(siblings, dragged, 'E', 'before')).toBe(false)
  })

  it('rejects unchanged group boundaries but allows grouping a disjoint selection', () => {
    expect(
      isUnchangedDrop(siblings, [siblings[1]!, siblings[2]!], 'A', 'after'),
    ).toBe(true)
    expect(
      isUnchangedDrop(siblings, [siblings[1]!, siblings[2]!], 'D', 'before'),
    ).toBe(true)
    expect(
      isUnchangedDrop(siblings, [siblings[1]!, siblings[3]!], 'A', 'after'),
    ).toBe(false)
  })

  it('allows moving from another parent and dropping inside a container', () => {
    expect(
      isUnchangedDrop(
        siblings,
        [{ id: 'nested', label: 'Nested' }],
        'B',
        'before',
      ),
    ).toBe(false)
    expect(isUnchangedDrop(siblings, [siblings[2]!], 'B', 'center')).toBe(
      false,
    )
  })
})
