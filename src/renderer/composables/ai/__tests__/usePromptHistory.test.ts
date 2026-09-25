import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref, watch } from 'vue'

const stores = vi.hoisted(() => ({
  app: { get: vi.fn(() => ['first', 'second']), set: vi.fn() },
  preferences: { get: vi.fn(() => 20), set: vi.fn() },
}))
vi.mock('@/electron', () => ({ store: stores }))
Object.assign(globalThis, { ref, watch, nextTick })

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})

function arrow(key: string, value: string, position = 0) {
  return {
    key,
    target: {
      value,
      selectionStart: position,
      selectionEnd: position,
      setSelectionRange: vi.fn(),
    },
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent
}

describe('prompt history', () => {
  it('browses persisted prompts newest first and restores the draft', async () => {
    const { usePromptHistory } = await import('../usePromptHistory')
    const draft = ref('unfinished')
    const history = usePromptHistory(draft)
    history.onKeydown(arrow('ArrowUp', draft.value))
    expect(draft.value).toBe('second')
    history.onKeydown(arrow('ArrowUp', draft.value))
    expect(draft.value).toBe('first')
    history.onKeydown(arrow('ArrowDown', draft.value))
    expect(draft.value).toBe('second')
    history.onKeydown(arrow('ArrowDown', draft.value))
    expect(draft.value).toBe('unfinished')
  })

  it('stops browsing after editing a recalled prompt until the field is cleared', async () => {
    const { usePromptHistory } = await import('../usePromptHistory')
    const draft = ref('')
    const history = usePromptHistory(draft)
    history.onKeydown(arrow('ArrowUp', draft.value))
    draft.value = 'second edited'
    history.onInput()
    for (const key of ['ArrowUp', 'ArrowDown']) {
      const event = arrow(key, draft.value)
      history.onKeydown(event)
      expect(event.preventDefault).not.toHaveBeenCalled()
      expect(draft.value).toBe('second edited')
    }
    draft.value = ''
    history.onInput()
    history.onKeydown(arrow('ArrowUp', ''))
    expect(draft.value).toBe('second')
  })

  it('preserves multiline navigation, selections and IME composition', async () => {
    const { usePromptHistory } = await import('../usePromptHistory')
    const draft = ref('line one\nline two')
    const history = usePromptHistory(draft)
    const events = [
      arrow('ArrowUp', draft.value, 12),
      { ...arrow('ArrowUp', draft.value), isComposing: true },
      { ...arrow('ArrowUp', draft.value), shiftKey: true },
    ]
    for (const event of events) {
      history.onKeydown(event as KeyboardEvent)
      expect(event.preventDefault).not.toHaveBeenCalled()
    }
    expect(draft.value).toBe('line one\nline two')
  })

  it('shares new prompts, skips consecutive duplicates and clears when disabled', async () => {
    const { usePromptHistory } = await import('../usePromptHistory')
    const first = usePromptHistory()
    const draft = ref('')
    const second = usePromptHistory(draft)
    first.remember(' new prompt ')
    first.remember('new prompt')
    expect(stores.app.set).toHaveBeenCalledTimes(1)
    second.onKeydown(arrow('ArrowUp', ''))
    expect(draft.value).toBe('new prompt')
    first.limit.value = 0
    await nextTick()
    expect(stores.app.set).toHaveBeenLastCalledWith('aiPromptHistory', [])
    first.remember('ignored')
    expect(stores.app.set).toHaveBeenCalledTimes(2)
  })
})
