import { describe, expect, it } from 'vitest'
import {
  emojis,
  getEmojiRows,
  getEmojiSections,
  getFilteredEmojis,
} from './emojis'

describe('emoji filtering', () => {
  it('provides the complete Unicode emoji catalog', () => {
    expect(emojis.length).toBeGreaterThan(1_800)
  })

  it('searches emoji by English keywords', () => {
    const results = getFilteredEmojis('developer')

    expect(results.map(item => item.emoji)).toEqual(['🧑‍💻', '👨‍💻', '👩‍💻'])
  })

  it('keeps compound emoji intact', () => {
    expect(getFilteredEmojis('pride')).toContainEqual(
      expect.objectContaining({ emoji: '🏳️‍🌈' }),
    )
  })

  it('omits empty categories from filtered sections', () => {
    const sections = getEmojiSections('rocket')
    const travelSection = sections.find(
      section => section.category === 'travel',
    )

    expect(sections.every(section => section.items.length > 0)).toBe(true)
    expect(travelSection?.items).toContainEqual(
      expect.objectContaining({ emoji: '🚀' }),
    )
  })

  it('chunks the catalog into virtualized rows of eight emoji', () => {
    const rows = getEmojiRows('developer')
    const itemRows = rows.filter(row => row.type === 'items')

    expect(rows[0]).toMatchObject({ category: 'people', type: 'category' })
    expect(itemRows.every(row => (row.items?.length ?? 0) <= 8)).toBe(true)
    expect(itemRows.flatMap(row => row.items ?? [])).toHaveLength(3)
  })
})
