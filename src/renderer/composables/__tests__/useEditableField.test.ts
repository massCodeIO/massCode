import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref, watch } from 'vue'

globalThis.ref = ref
globalThis.computed = computed
globalThis.watch = watch

describe('useEditableField', () => {
  it('saves a deferred edit only after blur', async () => {
    const source = ref('Original')
    const onUpdate = vi.fn((value: string) => {
      source.value = value
    })
    const { useEditableField } = await import('../useEditableField')
    const field = useEditableField(() => source.value, onUpdate, true)

    field.onFocus()
    field.model.value = 'New name'
    expect(onUpdate).not.toHaveBeenCalled()
    expect(field.model.value).toBe('New name')

    field.onBlur()
    await nextTick()
    expect(onUpdate).toHaveBeenCalledExactlyOnceWith('New name')
    expect(source.value).toBe('New name')
  })

  it('does not save a reset edit on blur', async () => {
    const source = ref('Original')
    const onUpdate = vi.fn()
    const { useEditableField } = await import('../useEditableField')
    const field = useEditableField(() => source.value, onUpdate, true)

    field.onFocus()
    field.model.value = 'Invalid name'
    field.reset()
    field.onBlur()

    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('does not apply an edit after the source changes', async () => {
    const source = ref('First snippet')
    const onUpdate = vi.fn()
    const { useEditableField } = await import('../useEditableField')
    const field = useEditableField(() => source.value, onUpdate, true)

    field.onFocus()
    field.model.value = 'Edited first snippet'
    source.value = 'Second snippet'
    await nextTick()
    field.onBlur()
    await nextTick()

    expect(onUpdate).not.toHaveBeenCalled()
    expect(field.model.value).toBe('Second snippet')
  })
})
