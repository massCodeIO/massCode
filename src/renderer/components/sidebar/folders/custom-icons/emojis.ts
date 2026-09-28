import type { Category as UnicodeEmojiCategory } from 'unicode-emoji'
import { getEmojis } from 'unicode-emoji'

type EmojiCategory =
  | 'people'
  | 'nature'
  | 'food'
  | 'activities'
  | 'travel'
  | 'objects'
  | 'symbols'
  | 'flags'

interface EmojiOption {
  category: EmojiCategory
  emoji: string
  keywords: string
}

interface EmojiSection {
  category: EmojiCategory
  items: EmojiOption[]
}

interface EmojiRow {
  category: EmojiCategory
  id: string
  items?: EmojiOption[]
  type: 'category' | 'items'
}

const emojiCategories: EmojiCategory[] = [
  'people',
  'nature',
  'food',
  'activities',
  'travel',
  'objects',
  'symbols',
  'flags',
]

const categoryMap: Record<UnicodeEmojiCategory, EmojiCategory> = {
  'face-emotion': 'people',
  'person-people': 'people',
  'animals-nature': 'nature',
  'food-drink': 'food',
  'activities-events': 'activities',
  'travel-places': 'travel',
  'objects': 'objects',
  'symbols': 'symbols',
  'flags': 'flags',
}

const emojis: EmojiOption[] = getEmojis().map(
  ({ category, description, emoji, keywords }) => ({
    category: categoryMap[category],
    emoji,
    keywords: `${description} ${keywords.join(' ')}`.toLowerCase(),
  }),
)

function getFilteredEmojis(search = '') {
  const normalizedSearch = search.trim().toLowerCase()

  if (!normalizedSearch)
    return emojis

  return emojis.filter(
    ({ emoji, keywords }) =>
      emoji.includes(normalizedSearch) || keywords.includes(normalizedSearch),
  )
}

function getEmojiSections(search = ''): EmojiSection[] {
  const filtered = getFilteredEmojis(search)

  return emojiCategories.flatMap((category) => {
    const items = filtered.filter(emoji => emoji.category === category)
    return items.length > 0 ? [{ category, items }] : []
  })
}

function getEmojiRows(search = ''): EmojiRow[] {
  return getEmojiSections(search).flatMap((section) => {
    const rows: EmojiRow[] = [
      {
        category: section.category,
        id: `${section.category}:category`,
        type: 'category',
      },
    ]

    for (let index = 0; index < section.items.length; index += 8) {
      rows.push({
        category: section.category,
        id: `${section.category}:${index / 8}`,
        items: section.items.slice(index, index + 8),
        type: 'items',
      })
    }

    return rows
  })
}

export {
  emojiCategories,
  emojis,
  getEmojiRows,
  getEmojiSections,
  getFilteredEmojis,
}
export type { EmojiCategory, EmojiOption, EmojiRow, EmojiSection }
