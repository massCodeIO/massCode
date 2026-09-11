import type { DateFormat } from '~/shared/dateFormat'
import { store } from '@/electron'
import { format, isValid, parseISO } from 'date-fns'
import { resolveLanguage } from '~/main/i18n/language'
import { DATE_FORMATS, DEFAULT_DATE_FORMAT } from '~/shared/dateFormat'

const storedFormat = store.preferences.get<DateFormat>('appearance.dateFormat')
const dateFormat = ref<DateFormat>(
  DATE_FORMATS.includes(storedFormat) ? storedFormat : DEFAULT_DATE_FORMAT,
)

// Language changes take effect after the application reloads.
const locale = resolveLanguage(
  store.preferences.get('localization.locale'),
).replace('_', '-')
const localeDateFormatter = new Intl.DateTimeFormat(locale, {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
})

function setDateFormat(value: unknown) {
  if (!DATE_FORMATS.includes(value as DateFormat))
    return
  dateFormat.value = value as DateFormat
  store.preferences.set('appearance.dateFormat', value)
}

function formatDate(value: Date | string | number) {
  const date = typeof value === 'string' ? parseISO(value) : new Date(value)
  if (!isValid(date))
    return ''
  if (dateFormat.value === 'locale') {
    return localeDateFormatter.format(date)
  }
  return format(date, dateFormat.value)
}

function formatTime(value: Date | string | number) {
  const date = typeof value === 'string' ? parseISO(value) : new Date(value)
  return isValid(date) ? format(date, 'HH:mm:ss') : ''
}

function formatDateTime(value: Date | string | number) {
  return [formatDate(value), formatTime(value)].filter(Boolean).join(' ')
}

export function useDateFormat() {
  return {
    locale,
    dateFormat,
    setDateFormat,
    formatDate,
    formatDateTime,
    formatTime,
  }
}
