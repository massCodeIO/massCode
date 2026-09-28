import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

globalThis.ref = ref

async function setup() {
  vi.resetModules()
  vi.useFakeTimers()
  const updateSnippet = vi.fn(async () => undefined)
  const updateSnippetContent = vi.fn(
    async (..._args: unknown[]): Promise<void> => undefined,
  )
  vi.doMock('../useSnippets', () => ({
    useSnippets: () => ({ updateSnippet, updateSnippetContent }),
  }))
  vi.doMock('../useStorageMutation', () => ({ markUserEdit: vi.fn() }))
  vi.doMock('@/utils', () => ({ isRetriableSaveError: () => false }))
  const { useSnippetUpdate } = await import('../useSnippetUpdate')
  return { ...useSnippetUpdate(), updateSnippet, updateSnippetContent }
}

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('snippet content persistence', () => {
  const content = (value: string) => ({
    label: 'main',
    language: 'javascript',
    value,
  })
  it('flushes only the requested fragment without waiting for debounce', async () => {
    const context = await setup()
    context.addToUpdateContentQueue(1, 11, content('AI edit'))
    context.addToUpdateContentQueue(2, 22, content('Another edit'))
    await context.flushSnippetContent(1, 11)
    expect(context.updateSnippetContent).toHaveBeenCalledExactlyOnceWith(
      1,
      11,
      content('AI edit'),
    )
    expect(context.isContentUpdateBusy(1, 11)).toBe(false)
    expect(context.getPendingContentUpdate(2, 22)).toEqual(
      content('Another edit'),
    )
    await vi.advanceTimersByTimeAsync(500)
    expect(context.updateSnippetContent).toHaveBeenCalledTimes(2)
  })

  it('waits for an in-flight save and drains newer edits without concurrent writes', async () => {
    const context = await setup()
    let finish!: () => void
    context.updateSnippetContent.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    context.addToUpdateContentQueue(1, 11, content('first'))
    await vi.advanceTimersByTimeAsync(500)
    context.addToUpdateContentQueue(1, 11, content('latest'))
    const flushed = vi.fn()
    const first = context.flushSnippetContent(1, 11).then(flushed)
    const duplicate = context.flushSnippetContent(1, 11)
    await Promise.resolve()
    expect(flushed).not.toHaveBeenCalled()
    expect(context.updateSnippetContent).toHaveBeenCalledTimes(1)
    finish()
    await Promise.all([first, duplicate])
    expect(context.updateSnippetContent).toHaveBeenCalledTimes(2)
    expect(context.updateSnippetContent).toHaveBeenLastCalledWith(
      1,
      11,
      content('latest'),
    )
    expect(context.isContentUpdateBusy(1, 11)).toBe(false)
  })

  it('rejects an unsuccessful flush and keeps the latest draft for explicit retry', async () => {
    const context = await setup()
    context.updateSnippetContent.mockRejectedValueOnce(
      new Error('WRITE_DENIED'),
    )
    context.addToUpdateContentQueue(1, 11, content('unsaved'))
    await expect(context.flushSnippetContent(1, 11)).rejects.toThrow(
      'WRITE_DENIED',
    )
    expect(context.getPendingContentUpdate(1, 11)).toEqual(content('unsaved'))
    await vi.advanceTimersByTimeAsync(60_000)
    expect(context.updateSnippetContent).toHaveBeenCalledTimes(1)
    await context.flushSnippetContent(1, 11)
    expect(context.isContentUpdateBusy(1, 11)).toBe(false)
  })
})

describe('snippet metadata debounce', () => {
  it.each([true, false])(
    'preserves both fields when description is first: %s',
    async (descriptionFirst) => {
      const context = await setup()
      const changes = [
        { description: 'New description' },
        { name: 'New name' },
      ]
      if (!descriptionFirst)
        changes.reverse()
      context.addToUpdateQueue(1, changes[0]!)
      await vi.advanceTimersByTimeAsync(200)
      context.addToUpdateQueue(1, changes[1]!)
      await vi.advanceTimersByTimeAsync(499)
      expect(context.updateSnippet).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      expect(context.updateSnippet).toHaveBeenCalledExactlyOnceWith(1, {
        name: 'New name',
        description: 'New description',
      })
    },
  )

  it('keeps the latest field value, including an empty description', async () => {
    const context = await setup()
    context.addToUpdateQueue(1, {
      description: 'Old description',
      name: 'First',
    })
    context.addToUpdateQueue(1, { description: '' })
    context.addToUpdateQueue(1, { name: 'Last' })
    await vi.advanceTimersByTimeAsync(500)
    expect(context.updateSnippet).toHaveBeenCalledExactlyOnceWith(1, {
      name: 'Last',
      description: '',
    })
  })

  it('keeps updates for different snippets separate', async () => {
    const context = await setup()
    context.addToUpdateQueue(1, { description: 'A' })
    context.addToUpdateQueue(2, { name: 'B' })
    context.addToUpdateQueue(1, { name: 'A' })
    await vi.advanceTimersByTimeAsync(500)
    expect(context.updateSnippet).toHaveBeenCalledTimes(2)
    expect(context.updateSnippet).toHaveBeenCalledWith(1, {
      description: 'A',
      name: 'A',
    })
    expect(context.updateSnippet).toHaveBeenCalledWith(2, { name: 'B' })
  })
})
