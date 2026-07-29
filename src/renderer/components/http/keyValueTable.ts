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
