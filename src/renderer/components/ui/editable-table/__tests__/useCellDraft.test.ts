import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, watch } from 'vue'
import { useCellDraft } from '../useCellDraft'

Object.assign(globalThis, { ref, watch })

function setup(save = vi.fn(async (_value: string) => true)) {
  const source = ref('original')
  const scope = effectScope()
  const cell = scope.run(() => useCellDraft(() => source.value, save))!
  return { source, cell, save, stop: () => scope.stop() }
}
describe('editable table cell draft', () => {
  it('keeps typed input across external refresh, then cancels to the latest source', async () => {
    const { cell, source, save, stop } = setup()
    cell.focus()
    cell.draft.value = 'typing'
    source.value = 'external'
    await nextTick()
    expect(cell.draft.value).toBe('typing')
    cell.cancel()
    expect(cell.draft.value).toBe('external')
    await cell.commit()
    expect(save).not.toHaveBeenCalled()
    stop()
  })
  it('does not duplicate async saves on repeated blur or Enter', async () => {
    let finish!: (value: boolean) => void
    const save = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve
        }),
    )
    const { cell, stop } = setup(save)
    cell.focus()
    cell.draft.value = 'next'
    const pending = cell.commit()
    await cell.commit()
    expect(save).toHaveBeenCalledTimes(1)
    finish(true)
    await pending
    expect(cell.draft.value).toBe('next')
    expect(cell.pending.value).toBe(false)
    stop()
  })
  it('retains the draft after a failed save and retries it', async () => {
    const save = vi.fn(async () => false)
    const { cell, stop } = setup(save)
    cell.focus()
    cell.draft.value = 'unsaved'
    expect(await cell.commit()).toBe(false)
    expect(cell.draft.value).toBe('unsaved')
    expect(cell.editing.value).toBe(true)
    save.mockResolvedValue(true)
    expect(await cell.commit()).toBe(true)
    stop()
  })
  it('keeps independent row drafts and accepts canonical values from the owner', async () => {
    const first = setup()
    const second = setup()
    first.cell.focus()
    first.cell.draft.value = 'first draft'
    second.save.mockImplementation(async (value) => {
      second.source.value = value.trim()
      return true
    })
    second.cell.draft.value = ' normalized '
    await second.cell.commit()
    expect(second.cell.draft.value).toBe('normalized')
    expect(first.cell.draft.value).toBe('first draft')
    first.stop()
    second.stop()
  })
})
