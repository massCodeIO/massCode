// Индекс прежнего активного результата в обновлённом списке, -1 если его там больше нет.
// Нужен, когда новый ответ поиска заменяет список и выделенный элемент сдвигается.
export function getPreservedActiveIndex(
  previous: readonly { id: string }[] | undefined,
  next: readonly { id: string }[],
  activeIndex: number,
) {
  const activeId = previous?.[activeIndex]?.id
  return activeId === undefined
    ? -1
    : next.findIndex(result => result.id === activeId)
}

// Внутри одного ввода (смена фазы, раскрытие «ещё N») выделение держится за запись: если она осталась
// в новом списке, курсор переезжает на неё, иначе на первую строку. Новый ввод всегда начинает с верха списка.
// keepOnce — раскрытие слабых: на месте строки «ещё N» встаёт следующее слабое совпадение;
// follow — можно ли переносить прежнюю запись (палитра не переносит выбранную не пользователем «Создать...»).
export function getNextActiveIndex(input: {
  keepOnce: boolean
  sameInput: boolean
  follow: boolean
  previous: readonly { id: string }[] | undefined
  next: readonly { id: string }[]
  activeIndex: number
}) {
  const { next, activeIndex } = input
  if (!next.length)
    return 0
  if (input.keepOnce && activeIndex < next.length)
    return activeIndex
  if (!input.sameInput || !input.follow)
    return 0
  const preservedIndex = getPreservedActiveIndex(
    input.previous,
    next,
    activeIndex,
  )
  return preservedIndex === -1 ? 0 : preservedIndex
}

// Цель «Создать...» без запроса: id строки меняется с каждой буквой, а позиция в закреплённой секции нет.
export function getCreateFallbackTarget(result: { id: string } | undefined) {
  return result?.id.match(/^create-[\w-]+-fallback(?=:)/)?.[0]
}

// Выделение после смены списка палитры. settledResultsKey — ключ поиска, для которого показан
// уже устоявшийся список: ручной выбор относится только к своему поиску.
export function resolveActiveSelection<T extends { id: string }>(input: {
  results: readonly T[]
  previous: readonly T[] | undefined
  activeIndex: number
  isSearching: boolean
  resultsKey: string
  settledResultsKey: string | undefined
  hasManualSelection: boolean
  keepOnce: boolean
  isCreateFallback: (result: T | undefined) => boolean
}) {
  const { results, previous, activeIndex, isSearching } = input
  const sameSearch = input.settledResultsKey === input.resultsKey
  const settledResultsKey = isSearching ? undefined : input.resultsKey
  const hasManualSelection
    = isSearching || !sameSearch ? false : input.hasManualSelection

  // «Создать...» активна по умолчанию лишь пока список пуст: пришедшие результаты должны встать под Enter.
  const previousActive = previous?.[activeIndex]
  const createTarget = getCreateFallbackTarget(previousActive)
  const createIndex
    = isSearching && createTarget
      ? results.findIndex(
          result => getCreateFallbackTarget(result) === createTarget,
        )
      : -1
  const nextIndex
    = createIndex !== -1
      ? createIndex
      : getNextActiveIndex({
          keepOnce: input.keepOnce,
          // Пока ответа нового ввода нет, на экране прежний список: подсветка остаётся на своей записи
          // и уходит на верх только с применением первого ответа (тогда sameSearch ещё false).
          sameInput: isSearching || sameSearch,
          follow: hasManualSelection || !input.isCreateFallback(previousActive),
          previous,
          next: results,
          activeIndex,
        })

  return { activeIndex: nextIndex, settledResultsKey, hasManualSelection }
}

// Пока нет ответа фазы слов, нелокальные строки относятся к прошлому вводу.
// После него Enter открывает выделенное, даже если смысловая фаза ещё идёт.
// «Создать...» по Enter до ответа слов дала бы дубль найденной записи; клик и Shift+Enter явные и работают.
export function canRunOnEnter(input: {
  result: unknown
  isSearching: boolean
  isLocal: boolean
  isCreateFallback: boolean
}) {
  if (!input.result)
    return false
  return !input.isSearching || (input.isLocal && !input.isCreateFallback)
}
