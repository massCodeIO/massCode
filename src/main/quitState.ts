// Общий флаг «приложение реально завершается». На macOS обработчик 'close'
// прячет окно вместо выхода, поэтому путь установки апдейта (quitAndInstall)
// должен выставить флаг до закрытия окон, иначе выход блокируется.
let quitting = false

export function setQuitting(value: boolean) {
  quitting = value
}

export function isQuitting() {
  return quitting
}
