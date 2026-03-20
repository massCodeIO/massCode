import type { Extension } from '@codemirror/state'
import {
  defaultHighlightStyle,
  HighlightStyle,
  syntaxHighlighting,
} from '@codemirror/language'
import { tags } from '@lezer/highlight'

const darkHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: 'oklch(72% 0.17 290)' },
  { tag: tags.controlKeyword, color: 'oklch(72% 0.17 290)' },
  { tag: tags.operatorKeyword, color: 'oklch(72% 0.17 290)' },
  { tag: tags.string, color: 'oklch(72% 0.15 150)' },
  { tag: tags.regexp, color: 'oklch(72% 0.18 25)' },
  { tag: tags.number, color: 'oklch(75% 0.16 55)' },
  { tag: tags.bool, color: 'oklch(75% 0.16 55)' },
  { tag: tags.comment, color: 'oklch(50% 0 0)' },
  { tag: tags.lineComment, color: 'oklch(50% 0 0)' },
  { tag: tags.blockComment, color: 'oklch(50% 0 0)' },
  { tag: tags.function(tags.variableName), color: 'oklch(75% 0.16 240)' },
  { tag: tags.definition(tags.variableName), color: 'oklch(75% 0.16 240)' },
  { tag: tags.typeName, color: 'oklch(72% 0.14 190)' },
  { tag: tags.className, color: 'oklch(72% 0.14 190)' },
  { tag: tags.propertyName, color: 'oklch(72% 0.12 30)' },
  { tag: tags.operator, color: 'oklch(65% 0.08 50)' },
  { tag: tags.punctuation, color: 'oklch(60% 0 0)' },
  { tag: tags.meta, color: 'oklch(65% 0.08 50)' },
  { tag: tags.tagName, color: 'oklch(72% 0.17 290)' },
  { tag: tags.attributeName, color: 'oklch(75% 0.16 55)' },
  { tag: tags.attributeValue, color: 'oklch(72% 0.15 150)' },
])

const lightHighlightOverrides = HighlightStyle.define([
  {
    tag: [
      tags.heading,
      tags.heading1,
      tags.heading2,
      tags.heading3,
      tags.heading4,
      tags.heading5,
      tags.heading6,
    ],
    textDecoration: 'none !important',
  },
])

export function createCodeHighlight(isDark: boolean): Extension {
  if (isDark) {
    return syntaxHighlighting(darkHighlightStyle)
  }

  return [
    syntaxHighlighting(defaultHighlightStyle),
    syntaxHighlighting(lightHighlightOverrides),
  ]
}
