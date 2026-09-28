export const DATE_FORMATS = [
  'locale',
  'dd.MM.yyyy',
  'MM/dd/yyyy',
  'dd/MM/yyyy',
  'yyyy-MM-dd',
] as const

export type DateFormat = (typeof DATE_FORMATS)[number]

export const DEFAULT_DATE_FORMAT: DateFormat = 'locale'
