import { expect, it } from 'vitest'
import { codeLanguages } from '../../../../../shared/codeLanguages'
import { languages } from '../languages'

it('retains the shared native picker names and IDs in the same order with grammar bindings', () => {
  expect(languages.map(({ name, value }) => ({ name, value }))).toEqual(
    codeLanguages,
  )
  expect(languages.find(({ value }) => value === 'rst')).toMatchObject({
    scopeName: 'source.rst',
    grammar: expect.any(Function),
  })
  expect(languages.find(({ value }) => value === 'plain_text')).toMatchObject({
    value: 'plain_text',
  })
})
