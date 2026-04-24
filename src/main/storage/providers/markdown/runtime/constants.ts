export const META_DIR_NAME = '.masscode'
export const STATE_FILE_NAME = 'state.json'
export const INBOX_DIR_NAME = 'inbox'
export const TRASH_DIR_NAME = 'trash'
export const CODE_SPACE_ID = 'code'
export const MATH_SPACE_ID = 'math'
export const NOTES_SPACE_ID = 'notes'
export const META_FILE_NAME = '.meta.yaml'
export const SPACE_STATE_FILE_NAME = '.state.yaml'
export const LEGACY_FOLDER_META_FILE_NAME = '.masscode-folder.yml'
export const PERSISTED_SPACE_IDS = [
  CODE_SPACE_ID,
  MATH_SPACE_ID,
  NOTES_SPACE_ID,
] as const
export const SPACE_IDS = new Set<string>(PERSISTED_SPACE_IDS)

export const INBOX_RELATIVE_PATH = `${META_DIR_NAME}/${INBOX_DIR_NAME}`
export const TRASH_RELATIVE_PATH = `${META_DIR_NAME}/${TRASH_DIR_NAME}`
export const LEGACY_INBOX_RELATIVE_PATH = INBOX_DIR_NAME
export const LEGACY_TRASH_RELATIVE_PATH = TRASH_DIR_NAME

export const RESERVED_ROOT_NAMES = new Set([
  INBOX_DIR_NAME,
  TRASH_DIR_NAME,
  CODE_SPACE_ID,
  MATH_SPACE_ID,
  NOTES_SPACE_ID,
])
export const NEW_LINE_SPLIT_RE = /\r?\n/
export const SEARCH_DIACRITICS_RE = /[\u0300-\u036F]/g
export const SEARCH_WORD_RE = /[\p{L}\p{N}_]+/gu
export const STATE_WRITE_DEBOUNCE_MS = 100
export const INVALID_NAME_CHARS_RE = /[<>:"/\\|?*]/g
export const INVALID_NAME_CHARS = new Set([
  '#',
  '<',
  '>',
  ':',
  '"',
  '/',
  '\\',
  '[',
  ']',
  '^',
  '|',
  '?',
  '*',
])
export const WINDOWS_RESERVED_NAME_RE
  = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i
