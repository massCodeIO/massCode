/**
 * Строка таблицы ключ-значение. Потребители расширяют её своими полями и
 * передают конкретный тип параметром компонента, поэтому слоты и колбэки
 * типизируются точно, а не через индексную сигнатуру.
 */
export interface Entry {
  key: string
  value: string
  description?: string
  enabled?: boolean
  type?: string
  [key: string]: any
}

export function serializeBulkEntries(entries: Entry[]): string {
  return entries
    .map(
      entry =>
        `${entry.enabled === false ? '//' : ''}${entry.key}:${entry.value}`,
    )
    .join('\n')
}

export function parseBulkEntries<T extends Entry>(
  text: string,
  previous: T[],
  createEntry?: () => T,
): T[] {
  const available = [...previous]
  return text
    .split(/\r?\n/)
    .filter(line => line.trim())
    .map((line) => {
      const enabled = !line.startsWith('//')
      const content = enabled ? line : line.slice(2)
      const separator = content.indexOf(':')
      const key = separator === -1 ? content : content.slice(0, separator)
      const value = separator === -1 ? '' : content.slice(separator + 1)
      // Match duplicate keys by value first, then by occurrence, keeping descriptions.
      let index = available.findIndex(
        entry => entry.key === key && entry.value === value,
      )
      if (index === -1)
        index = available.findIndex(entry => entry.key === key)
      const original
        = index === -1 ? createEntry?.() : available.splice(index, 1)[0]
      return { description: '', ...original, key, value, enabled } as T
    })
}
