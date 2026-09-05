import { StreamLanguage } from '@codemirror/language'

// Lexical highlighting only. Parsing and operation selection use GraphQL.js.
export const graphqlLanguage = StreamLanguage.define({
  startState: () => ({ blockString: false }),
  token(stream, state) {
    if (state.blockString) {
      while (!stream.eol()) {
        if (stream.match('\\"""'))
          continue
        if (stream.match('"""')) {
          state.blockString = false
          break
        }
        stream.next()
      }
      return 'string'
    }
    if (stream.eatSpace())
      return null
    if (stream.match('#')) {
      stream.skipToEnd()
      return 'comment'
    }
    if (stream.match('"""')) {
      state.blockString = true
      return 'string'
    }
    if (stream.match(/"(?:[^"\\]|\\.)*"?/))
      return 'string'
    if (stream.match(/\$[_A-Z]\w*/i))
      return 'variableName'
    if (stream.match(/@[_A-Z]\w*/i))
      return 'meta'
    if (stream.match(/-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?/i))
      return 'number'
    if (
      stream.match(
        /(?:query|mutation|subscription|fragment|on|true|false|null)\b/,
      )
    ) {
      return 'keyword'
    }
    if (stream.match(/[_A-Z]\w*/i))
      return 'propertyName'
    stream.next()
    return 'punctuation'
  },
})
