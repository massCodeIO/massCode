import type { Extension } from '@codemirror/state'
import {
  defaultHighlightStyle,
  HighlightStyle,
  syntaxHighlighting,
} from '@codemirror/language'
import { tagHighlighter, tags } from '@lezer/highlight'
import {
  textMateBracket,
  textMateVariable2,
  textMateVariable3,
} from './textMateTags'

const darkHighlightStyle = HighlightStyle.define([
  {
    tag: [
      tags.standard(tags.name),
      tags.standard(tags.variableName),
      tags.special(tags.variableName),
    ],
    color: 'oklch(75% 0.16 240)',
  },
  { tag: tags.annotation, color: 'oklch(75% 0.16 55)' },
  { tag: tags.inserted, color: 'oklch(72% 0.15 150)' },
  { tag: tags.deleted, color: 'oklch(72% 0.18 25)' },
  { tag: tags.keyword, color: 'oklch(72% 0.17 290)' },
  { tag: tags.controlKeyword, color: 'oklch(72% 0.17 290)' },
  { tag: tags.operatorKeyword, color: 'oklch(72% 0.17 290)' },
  { tag: [tags.string, tags.quote], color: 'oklch(72% 0.15 150)' },
  { tag: [tags.regexp, tags.escape], color: 'oklch(72% 0.18 25)' },
  { tag: tags.number, color: 'oklch(75% 0.16 55)' },
  { tag: [tags.bool, tags.atom, tags.color], color: 'oklch(75% 0.16 55)' },
  { tag: tags.comment, color: 'oklch(50% 0 0)' },
  { tag: tags.lineComment, color: 'oklch(50% 0 0)' },
  { tag: tags.blockComment, color: 'oklch(50% 0 0)' },
  { tag: tags.function(tags.variableName), color: 'oklch(75% 0.16 240)' },
  {
    tag: [tags.definition(tags.variableName), tags.labelName],
    color: 'oklch(75% 0.16 240)',
  },
  { tag: [tags.typeName, tags.namespace], color: 'oklch(72% 0.14 190)' },
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

export const codeHighlighter = tagHighlighter([
  { tag: tags.inserted, class: 'cm-positive' },
  { tag: tags.deleted, class: 'cm-negative' },
  { tag: tags.keyword, class: 'cm-keyword' },
  { tag: [tags.string, tags.attributeValue, tags.quote], class: 'cm-string' },
  { tag: [tags.regexp, tags.escape], class: 'cm-string-2' },
  { tag: tags.number, class: 'cm-number' },
  { tag: [tags.bool, tags.atom, tags.color], class: 'cm-atom' },
  { tag: tags.comment, class: 'cm-comment' },
  {
    tag: [
      tags.function(tags.variableName),
      tags.definition(tags.variableName),
      tags.labelName,
    ],
    class: 'cm-def',
  },
  { tag: [tags.typeName, tags.className, tags.namespace], class: 'cm-type' },
  { tag: tags.variableName, class: 'cm-variable' },
  {
    tag: [tags.standard(tags.name), tags.standard(tags.variableName)],
    class: 'cm-builtin',
  },
  { tag: tags.special(tags.variableName), class: 'cm-variable-2' },
  { tag: tags.annotation, class: 'cm-meta' },
  { tag: textMateVariable2, class: 'cm-variable-2' },
  { tag: textMateVariable3, class: 'cm-variable-3' },
  { tag: textMateBracket, class: 'cm-bracket' },
  { tag: tags.propertyName, class: 'cm-property' },
  { tag: tags.operator, class: 'cm-operator' },
  { tag: tags.punctuation, class: 'cm-punctuation' },
  { tag: tags.meta, class: 'cm-meta' },
  { tag: tags.tagName, class: 'cm-tag' },
  { tag: tags.attributeName, class: 'cm-attribute' },
  { tag: tags.heading, class: 'cm-header' },
  { tag: tags.strong, class: 'cm-strong' },
  { tag: tags.emphasis, class: 'cm-em' },
  { tag: [tags.link, tags.url], class: 'cm-link' },
])

export function createCodeHighlight(isDark: boolean): Extension {
  if (isDark) {
    return [
      syntaxHighlighting(darkHighlightStyle),
      syntaxHighlighting(codeHighlighter),
    ]
  }

  return [
    syntaxHighlighting(defaultHighlightStyle),
    syntaxHighlighting(codeHighlighter),
    syntaxHighlighting(lightHighlightOverrides),
  ]
}
