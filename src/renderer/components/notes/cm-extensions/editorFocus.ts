import { StateEffect, StateField } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

const setEditorFocusEffect = StateEffect.define<boolean>()

export const editorFocusField = StateField.define<boolean>({
  create() {
    return false
  },
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setEditorFocusEffect)) {
        return effect.value
      }
    }

    return value
  },
})

export const editorFocusExtension = [
  editorFocusField,
  EditorView.focusChangeEffect.of((_state, hasFocus) =>
    setEditorFocusEffect.of(hasFocus),
  ),
]
