import type { EditorSelection, EditorState } from '@codemirror/state'
import { Prec, StateEffect, StateField } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

// Пока идёт выделение зажатой левой кнопкой, контент не должен переключаться
// в raw-markdown (как в Obsidian): раскрытие пересчитывается только после
// отпускания кнопки. Для этого selection, по которому декорации решают,
// показывать ли разметку, «замораживается» состоянием на момент нажатия.
const setRevealSelectionFrozenEffect = StateEffect.define<{
  hasFocus: boolean
} | null>()

const revealSelectionField = StateField.define<{
  selection: EditorSelection
  hasFocus: boolean
} | null>({
  create() {
    return null
  },
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setRevealSelectionFrozenEffect)) {
        return effect.value
          ? {
              selection: transaction.startState.selection,
              hasFocus: effect.value.hasFocus,
            }
          : null
      }
    }

    // Документ может измениться прямо во время drag (например, асинхронная
    // замена placeholder'а картинки): без маппинга замороженные позиции
    // указали бы за конец документа и уронили билдеры декораций.
    if (value && transaction.docChanged)
      return { ...value, selection: value.selection.map(transaction.changes) }

    return value
  },
})

// Selection, по которому декорации решают, раскрывать ли raw-markdown.
export function getRevealSelection(state: EditorState): EditorSelection {
  return state.field(revealSelectionField, false)?.selection ?? state.selection
}

export function getRevealHasFocus(
  state: EditorState,
  hasFocus: boolean,
): boolean {
  return state.field(revealSelectionField, false)?.hasFocus ?? hasFocus
}

// Заморозка/разморозка приходит транзакцией без docChanged/selectionSet,
// поэтому плагинам нужен отдельный признак, что пора перестроить декорации.
// Сравниваем эффективный selection по содержимому: в момент заморозки он
// совпадает с текущим, и ребилд не нужен — иначе каждый клик мышью дважды
// пересобирал бы декорации всех reveal-плагинов без визуальных изменений.
export function revealSelectionChanged(update: {
  startState: EditorState
  state: EditorState
}): boolean {
  const wasUnfocused
    = update.startState.field(revealSelectionField, false)?.hasFocus === false
  const isUnfrozen = update.state.field(revealSelectionField, false) === null
  return (
    (wasUnfocused && isUnfrozen)
    || !getRevealSelection(update.startState).eq(getRevealSelection(update.state))
  )
}

// Замораживает reveal-selection до ближайшего mouseup. Вызывается и из
// обработчиков виджетов (например, таблиц), чьи mousedown не доходят до
// domEventHandlers из-за ignoreEvent.
export function freezeRevealSelectionUntilMouseup(view: EditorView) {
  const unfreeze = () => {
    window.removeEventListener('mouseup', unfreeze)
    if (view.dom.isConnected)
      view.dispatch({ effects: setRevealSelectionFrozenEffect.of(null) })
  }

  window.addEventListener('mouseup', unfreeze)
  view.dispatch({
    effects: setRevealSelectionFrozenEffect.of({ hasFocus: view.hasFocus }),
  })
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
