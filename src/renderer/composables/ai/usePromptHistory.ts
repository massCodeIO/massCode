import type { Ref } from 'vue'
import { store } from '@/electron'
import { AI_PROMPT_HISTORY_DEFAULT_LIMIT } from '~/shared/aiPromptHistory'

const history = ref<string[]>(store.app.get('aiPromptHistory') ?? [])
const limit = ref<number>(
  store.preferences.get('aiPromptHistoryLimit')
  ?? AI_PROMPT_HISTORY_DEFAULT_LIMIT,
)

watch(limit, (value) => {
  store.preferences.set('aiPromptHistoryLimit', value)
  history.value = value === 0 ? [] : history.value.slice(-value)
  store.app.set('aiPromptHistory', [...history.value])
})

export function usePromptHistory(draft?: Ref<string>) {
  let index = -1
  let savedDraft = ''
  let edited = false

  function reset() {
    index = -1
    savedDraft = ''
    edited = false
  }

  function onInput() {
    if (!draft?.value) {
      reset()
      return
    }
    if (index !== -1)
      edited = true
  }

  function remember(text: string) {
    const prompt = text.trim()
    if (limit.value && prompt && history.value.at(-1) !== prompt) {
      history.value = [...history.value, prompt].slice(-limit.value)
      store.app.set('aiPromptHistory', [...history.value])
    }
    reset()
  }

  function onKeydown(event: KeyboardEvent) {
    if (
      !draft
      || edited
      || event.isComposing
      || event.shiftKey
      || event.altKey
      || event.ctrlKey
      || event.metaKey
    ) {
      return
    }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')
      return
    const input = event.target as HTMLTextAreaElement
    if (input.selectionStart !== input.selectionEnd)
      return
    const up = event.key === 'ArrowUp'
    const position = input.selectionStart
    if (
      up
        ? draft.value.slice(0, position).includes('\n')
        : draft.value.slice(position).includes('\n')
    ) {
      return
    }
    if (!history.value.length || (!up && index === -1))
      return
    event.preventDefault()
    if (index === -1) {
      savedDraft = draft.value
      index = history.value.length
    }
    index = Math.max(0, Math.min(history.value.length, index + (up ? -1 : 1)))
    draft.value = history.value[index] ?? savedDraft
    if (index === history.value.length)
      reset()
    void nextTick(() => {
      const caret = up ? 0 : input.value.length
      input.setSelectionRange(caret, caret)
    })
  }

  return { limit, remember, reset, onInput, onKeydown }
}
