import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createRenderer,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  ssrContextKey,
  watch,
} from 'vue'
import InputTags from '../InputTags.vue'

Object.assign(globalThis, { nextTick, onBeforeUnmount, onMounted, ref, watch })
vi.mock('@/electron', () => ({ i18n: { t: () => 'Add Tag' } }))

const cleanup: Array<() => void> = []
afterEach(() => {
  cleanup.splice(0).forEach(dispose => dispose())
  vi.unstubAllGlobals()
})

function setup(suggestions = [{ id: 1, name: '테스트' }]) {
  vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {} })
  const emit = vi.fn()
  let bindings: any
  const renderer = createRenderer({
    patchProp() {},
    insert() {},
    remove() {},
    createElement: () => ({}),
    createText: () => ({}),
    createComment: () => ({}),
    setText() {},
    setElementText() {},
    parentNode: () => null,
    nextSibling: () => null,
  })
  const app = renderer.createApp(
    defineComponent({
      setup() {
        bindings = InputTags.setup!(
          { modelValue: [], suggestions } as never,
          { emit, expose() {} } as never,
        )
        return () => null
      },
    }),
  )
  app.provide(ssrContextKey, {})
  app.mount({})
  cleanup.push(() => app.unmount())
  return { bindings, emit }
}

function key(key: string, composing = false, keyCode = 0) {
  return { key, isComposing: composing, keyCode, preventDefault: vi.fn() }
}

describe('tag input IME composition', () => {
  it.each([
    [true, 13],
    [false, 229],
  ])(
    'does not commit stale text during IME (isComposing=%s, keyCode=%s)',
    (composing, keyCode) => {
      const { bindings, emit } = setup([])
      bindings.inputValue.value = '테스'
      const confirmComposition = key('Enter', composing, keyCode)
      bindings.handleKeydown(confirmComposition)
      expect(emit).not.toHaveBeenCalled()
      expect(confirmComposition.preventDefault).not.toHaveBeenCalled()
      expect(bindings.inputValue.value).toBe('테스')

      // Vue updates v-model with the final text after compositionend.
      bindings.inputValue.value = '테스트'
      bindings.handleKeydown(key('Enter'))
      expect(emit).toHaveBeenCalledExactlyOnceWith(
        'createTag',
        expect.objectContaining({ name: '테스트' }),
      )
      expect(bindings.tags.value).toHaveLength(1)
      expect(bindings.inputValue.value).toBe('')
    },
  )

  it('leaves suggestion navigation and selection to the IME until composition ends', async () => {
    const { bindings, emit } = setup()
    bindings.inputValue.value = '테스'
    bindings.handleInput()
    await nextTick()
    bindings.handleKeydown(key('ArrowDown', true))
    expect(bindings.selectedSuggestionIndex.value).toBe(-1)
    bindings.handleKeydown(key('ArrowDown'))
    expect(bindings.selectedSuggestionIndex.value).toBe(0)
    bindings.handleKeydown(key('Enter', true))
    expect(emit).not.toHaveBeenCalled()
    bindings.handleKeydown(key('Enter'))
    expect(emit).toHaveBeenCalledExactlyOnceWith('addTag', {
      id: 1,
      name: '테스트',
    })
  })

  it('still creates an ordinary tag on Enter', () => {
    const { bindings, emit } = setup([])
    bindings.inputValue.value = ' QA994 '
    bindings.handleKeydown(key('Enter'))
    expect(emit).toHaveBeenCalledExactlyOnceWith(
      'createTag',
      expect.objectContaining({ name: 'QA994' }),
    )
  })
})
