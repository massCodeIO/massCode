import type { Settings } from './types/editor'

const cursorPosition = reactive({
  row: 0,
  column: 0,
})

const settings = reactive<Settings>({
  fontSize: 13,
  fontFamily: 'SF Mono, Consolas, Menlo, Ubuntu Mono, monospace',
  wrap: false,
  tabSize: 2,
  trailingComma: 'all',
  semi: false,
  singleQuote: false,
  highlightLine: false,
  highlightGutter: true,
  matchBrackets: true,
})

export function useEditor() {
  return {
    cursorPosition,
    settings,
  }
}
