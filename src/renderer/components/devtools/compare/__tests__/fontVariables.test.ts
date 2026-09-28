import { describe, expect, it } from 'vitest'
import { getJsonDiffFontVariables } from '../fontVariables'

describe('getJsonDiffFontVariables', () => {
  it('maps code editor font settings to json diff css variables', () => {
    expect(
      getJsonDiffFontVariables({
        fontSize: 16,
        fontFamily: 'Fira Code, monospace',
      }),
    ).toEqual({
      '--json-diff-font-size': '16px',
      '--json-diff-font-family': 'Fira Code, monospace',
      '--json-diff-line-height': '1.54',
    })
  })
})
