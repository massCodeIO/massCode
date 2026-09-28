import { StateEffect, StateField } from '@codemirror/state'

export const trackImageUpload = StateEffect.define<{
  id: string
  from: number
  text: string
}>()
export const forgetImageUpload = StateEffect.define<string>()
export const imageUploadRanges = StateField.define<
  Map<string, { from: number, to: number, text: string }>
>({
  create: () => new Map(),
  update(value, transaction) {
    const next = new Map<string, { from: number, to: number, text: string }>()
    for (const [id, range] of value) {
      let touched = false
      transaction.changes.iterChangedRanges((from, to) => {
        if (
          range.from === range.to
            ? from < to && from <= range.from && to >= range.to
            : from < range.to && to > range.from
        ) {
          touched = true
        }
      })
      if (touched)
        continue
      const from = transaction.changes.mapPos(range.from, 1)
      const to
        = range.from === range.to
          ? from
          : transaction.changes.mapPos(range.to, -1)
      if (to >= from && transaction.newDoc.sliceString(from, to) === range.text)
        next.set(id, { ...range, from, to })
    }
    for (const effect of transaction.effects) {
      if (effect.is(trackImageUpload)) {
        next.set(effect.value.id, {
          from: effect.value.from,
          to: effect.value.from + effect.value.text.length,
          text: effect.value.text,
        })
      }
      if (effect.is(forgetImageUpload))
        next.delete(effect.value)
    }
    return next
  },
})
