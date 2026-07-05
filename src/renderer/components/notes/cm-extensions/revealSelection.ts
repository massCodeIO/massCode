import type { EditorSelection, EditorState } from '@codemirror/state'
import { Prec, StateEffect, StateField } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

// Пока идёт выделение зажатой левой кнопкой, контент не должен переключаться
// в raw-markdown (как в Obsidian): раскрытие пересчитывается только после
// отпускания кнопки. Для этого selection, по которому декорации решают,
// показывать ли разметку, «замораживается» состоянием на момент нажатия.
const setRevealSelectionFrozenEffect = StateEffect.define<boolean>()

const revealSelectionField = StateField.define<EditorSelection | null>({
  create() {
    return null
  },
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setRevealSelectionFrozenEffect)) {
        return effect.value ? transaction.startState.selection : null
      }
    }

    return value
  },
})

// Selection, по которому декорации решают, раскрывать ли raw-markdown.
export function getRevealSelection(state: EditorState): EditorSelection {
  return state.field(revealSelectionField, false) ?? state.selection
}

// Заморозка/разморозка приходит транзакцией без docChanged/selectionSet,
// поэтому плагинам нужен отдельный признак, что пора перестроить декорации.
export function revealSelectionChanged(update: {
  startState: EditorState
  state: EditorState
}): boolean {
  return (
    update.startState.field(revealSelectionField, false)
    !== update.state.field(revealSelectionField, false)
  )
}

// Замораживает reveal-selection до ближайшего mouseup. Вызывается и из
// обработчиков виджетов (например, таблиц), чьи mousedown не доходят до
// domEventHandlers из-за ignoreEvent.
export function freezeRevealSelectionUntilMouseup(view: EditorView) {
  const unfreeze = () => {
    window.removeEventListener('mouseup', unfreeze)
    if (view.dom.isConnected)
      view.dispatch({ effects: setRevealSelectionFrozenEffect.of(false) })
  }

  window.addEventListener('mouseup', unfreeze)
  view.dispatch({ effects: setRevealSelectionFrozenEffect.of(true) })
}

// Prec.highest: обработчики других расширений (например, клик под последней
// таблицей) возвращают true и обрывают цепочку — заморозка должна успеть
// сработать раньше и не потреблять событие.
export const revealSelectionFreeze = [
  revealSelectionField,
  Prec.highest(
    EditorView.domEventHandlers({
      mousedown(event, view) {
        if (event.button === 0)
          freezeRevealSelectionUntilMouseup(view)

        return false
      },
    }),
  ),
]
