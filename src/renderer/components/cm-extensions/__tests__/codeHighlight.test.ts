import { languages } from '@codemirror/language-data'
import { highlightTree } from '@lezer/highlight'
import { expect, it } from 'vitest'
import { codeHighlighter } from '../codeHighlight'

it('preserves CSS color literals, ID selectors, namespaces and animation names', async () => {
  const support = await languages
    .find(language => language.name === 'CSS')!
    .load()
  const source
    = '@namespace svg url("http://www.w3.org/2000/svg");\n#card { color: #ff8800; }\n@keyframes pulse { from { opacity: 0; } to { opacity: 1; } }'
  const spans: { text: string, classes: string }[] = []
  highlightTree(
    support.language.parser.parse(source),
    codeHighlighter,
    (from, to, classes) => {
      spans.push({ text: source.slice(from, to), classes })
    },
  )
  expect(spans).toEqual(
    expect.arrayContaining([
      { text: 'svg', classes: 'cm-type' },
      { text: 'card', classes: 'cm-def' },
      { text: '#ff8800', classes: 'cm-atom' },
      { text: 'pulse', classes: 'cm-def' },
    ]),
  )
})
