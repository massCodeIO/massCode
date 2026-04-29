export {
  buildLinkMarkdown,
  escapeLinkPart,
  findInternalLinks,
  normalizeInternalLinkLookupKey,
  parseInternalLink,
  resolveInternalLinkTargetByTitle,
  splitInternalLinkTarget,
} from '../../../../../shared/notes/internalLinks'

export type {
  InternalLink,
  InternalLinkLookupItem,
  InternalLinkMatch,
  InternalLinkType,
} from '../../../../../shared/notes/internalLinks'
