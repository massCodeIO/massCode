type SourceFn = () => string | undefined

export function useEditableField(
  source: SourceFn,
  onUpdate: (value: string) => void,
  updateOnBlur = false,
) {
  const localValue = ref('')
  const isFocused = ref(false)
  let sourceAtFocus: string | undefined

  watch(
    source,
    (newValue) => {
      if (!isFocused.value) {
        localValue.value = newValue ?? ''
      }
    },
    { immediate: true },
  )

  const model = computed({
    get: () => localValue.value,
    set: (v: string) => {
      localValue.value = v
      if (!updateOnBlur) {
        onUpdate(v)
      }
    },
  })

  function onFocus() {
    isFocused.value = true
    sourceAtFocus = source()
  }

  function onBlur() {
    isFocused.value = false
    if (updateOnBlur && source() !== sourceAtFocus) {
      reset()
      return
    }
    if (
      updateOnBlur
      && localValue.value !== (sourceAtFocus ?? '')
    ) {
      onUpdate(localValue.value)
    }
  }

  function reset() {
    localValue.value = source() ?? ''
  }

  return { model, onFocus, onBlur, reset }
}
