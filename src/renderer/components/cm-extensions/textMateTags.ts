import { Tag, tags } from '@lezer/highlight'

// These legacy token classes need distinct tags without changing native CM6 tags.
export const textMateVariable2 = Tag.define(tags.variableName)
export const textMateVariable3 = Tag.define(tags.variableName)
export const textMateBracket = Tag.define(tags.punctuation)

// Prefix parser token names: StreamLanguage pre-caches legacy aliases such as
// `string-2`, so a tokenTable entry with that name cannot override its tag.
export const textMateTokenTable = {
  'tm-atom': tags.atom,
  'tm-attribute': tags.attributeName,
  'tm-bracket': textMateBracket,
  'tm-comment': tags.comment,
  'tm-def': tags.definition(tags.variableName),
  'tm-keyword': tags.keyword,
  'tm-link': tags.link,
  'tm-number': tags.number,
  'tm-operator': tags.operator,
  'tm-property': tags.propertyName,
  'tm-string': tags.string,
  'tm-string-2': tags.regexp,
  'tm-tag': tags.tagName,
  'tm-type': tags.typeName,
  'tm-variable': tags.variableName,
  'tm-variable-2': textMateVariable2,
  'tm-variable-3': textMateVariable3,
}
