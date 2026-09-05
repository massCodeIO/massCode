import { parse } from 'acorn'
import { expect, it } from 'vitest'
import { generateHttpSnippet } from '~/main/http/preview'
import { HTTP_PREVIEW_FORMATS } from '~/shared/httpPreview'
import { buildHarRequest, buildRequestPreview } from '../requestPreview'
import { base, cases } from './previewCases'

const fileFormats = [
  'curl',
  'http',
  'fetch',
  'axios',
  'node:native',
  'node:axios',
  'node:fetch',
  'swift:nsurlsession',
  'python:requests',
]

for (const [name, override] of Object.entries(cases)) {
  it.each(HTTP_PREVIEW_FORMATS)(
    `${name}: generates %s or reports unsupported file uploads`,
    (format) => {
      const draft = { ...base, ...override }
      const generate = () =>
        format === 'http'
        || format === 'curl'
        || format === 'fetch'
        || format === 'axios'
          ? buildRequestPreview(draft, format)
          : generateHttpSnippet({ request: buildHarRequest(draft), format })
      if (
        (name === 'baseVariable' || name === 'schemeVariable')
        && format === 'python:python3'
      ) {
        expect(generate).toThrow('HTTP_PREVIEW_URL_TEMPLATE_UNSUPPORTED')
        return
      }
      if (
        (name === 'multipartFile' || name === 'multipartQuotes')
        && !fileFormats.includes(format)
      ) {
        expect(generate).toThrow('HTTP_PREVIEW_MULTIPART_FILES_UNSUPPORTED')
        return
      }
      const code = generate()
      expect(code.length).toBeGreaterThan(0)
      expect(code).not.toContain('masscodevariable')
      if (name.endsWith('Variable')) {
        for (const variable of draft.url.match(/\{\{[^}]+\}\}/g) ?? [])
          expect(code).toContain(variable)
      }
      if (
        format.startsWith('node:')
        || format === 'fetch'
        || format === 'axios'
      ) {
        expect(() =>
          parse(code, { ecmaVersion: 'latest', sourceType: 'module' }),
        ).not.toThrow()
      }
    },
  )
}
