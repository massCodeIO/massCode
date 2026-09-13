import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

globalThis.ref = ref

async function setup() {
  vi.resetModules()
  vi.useFakeTimers()
  const updateSnippet = vi.fn(async () => undefined)
  vi.doMock('../useSnippets', () => ({
    useSnippets: () => ({ updateSnippet, updateSnippetContent: vi.fn() }),
  }))
  vi.doMock('../useStorageMutation', () => ({ markUserEdit: vi.fn() }))
  vi.doMock('@/utils', () => ({ isRetriableSaveError: () => false }))
  const { useSnippetUpdate } = await import('../useSnippetUpdate')
  return { ...useSnippetUpdate(), updateSnippet }
}

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
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
