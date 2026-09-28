type SourceFn = () => string | undefined

export function useEditableField(
  source: SourceFn,
  onUpdate: (value: string) => void,
) {
  const localValue = ref('')
  const isFocused = ref(false)

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
      onUpdate(v)
    },
  })

  function onFocus() {
    isFocused.value = true
  }

  function onBlur() {
    isFocused.value = false
  }

  function reset() {
    localValue.value = source() ?? ''
  }

  return { model, onFocus, onBlur, reset }
}
