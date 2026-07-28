import { describe, expect, it } from 'vitest'
import { getDrawingUrlsFromMarkdown } from '../drawingExport'

describe('drawing export', () => {
  it('uses Markdown image semantics and deduplicates URLs', () => {
    const urls = getDrawingUrlsFromMarkdown(
      [
        '![first](masscode://drawing/one "Drawing title")',
        '![second](<masscode://drawing/two>)',
        '![duplicate](masscode://drawing/one)',
        '',
        '`![inline code](masscode://drawing/inline)`',
        '',
        '```md',
        '![fenced code](masscode://drawing/fenced)',
        '```',
      ].join('\n'),
    )

    expect(urls).toEqual(['masscode://drawing/one', 'masscode://drawing/two'])
  })
})
