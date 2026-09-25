import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { workspaceCreationSchema } from '../../main/ai/workspaceCreation'
import { workspaceReviewSchema } from '../../main/ai/workspaceReview'
import { workspaceFieldsSchema } from '../aiWorkspace'
import {
  codeLanguageIds,
  codeLanguages,
  normalizeCodeLanguage,
} from '../codeLanguages'

describe('canonical Code languages', () => {
  it('preserves the native picker order including its two GLSL labels', () => {
    expect(codeLanguages).toHaveLength(166)
    expect(codeLanguageIds).toHaveLength(165)
    expect(
      codeLanguages
        .filter(({ value }) => value === 'glsl')
        .map(({ name }) => name),
    ).toEqual(['Glsl', 'OpenGL'])
  })
  it('accepts every native ID and display name with case and whitespace normalization', () => {
    for (const { name, value } of codeLanguages) {
      for (const input of [value, ` ${name.toUpperCase()} `]) {
        expect(workspaceFieldsSchema.parse({ language: input }).language).toBe(
          value,
        )
        expect(
          workspaceFieldsSchema.parse({ defaultLanguage: input })
            .defaultLanguage,
        ).toBe(value)
      }
    }
  })
  it.each([
    ['js', 'javascript'],
    ['ts', 'typescript'],
    ['cpp', 'c_cpp'],
    ['C++', 'c_cpp'],
    ['cs', 'csharp'],
    ['fs', 'fsharp'],
    ['shell', 'sh'],
    ['md', 'markdown'],
    ['yml', 'yaml'],
    ['text', 'plain_text'],
    ['plaintext', 'plain_text'],
    ['reStructuredText', 'rst'],
    ['jade', 'pug'],
  ])('maps the explicit alias %s to %s', (input, expected) => {
    expect(normalizeCodeLanguage(input)).toBe(expected)
    expect(workspaceFieldsSchema.parse({ language: input }).language).toBe(
      expected,
    )
  })
  it.each(['', ' ', 'java script', 'rusty', 'unknown', '__proto__', null, 1])(
    'rejects non-language %j',
    (language) => {
      expect(workspaceFieldsSchema.safeParse({ language }).success).toBe(false)
    },
  )
  it('allows omission and clearing the folder default, but not unknown defaults', () => {
    expect(workspaceFieldsSchema.parse({})).toEqual({})
    expect(workspaceFieldsSchema.parse({ defaultLanguage: ' ' })).toEqual({
      defaultLanguage: '',
    })
    expect(
      workspaceFieldsSchema.safeParse({ defaultLanguage: 'unknown' }).success,
    ).toBe(false)
  })
  it('publishes canonical enums in both public creation and review JSON schemas', () => {
    for (const schema of [workspaceCreationSchema, workspaceReviewSchema]) {
      const json = JSON.stringify(z.toJSONSchema(schema))
      expect(json).toContain(JSON.stringify(codeLanguageIds))
      expect(json).not.toContain('reStructuredText')
    }
  })
})
