import type { HttpRequestDraft } from '@/composables'

export const base: HttpRequestDraft = {
  folderId: null,
  method: 'POST',
  url: 'https://example.com/items',
  headers: [],
  query: [],
  bodyType: 'none',
  body: null,
  formData: [],
  auth: { type: 'none' },
  description: '',
}
export const cases: Record<string, Partial<HttpRequestDraft>> = {
  get: { method: 'GET' },
  head: { method: 'HEAD' },
  delete: { method: 'DELETE' },
  patch: { method: 'PATCH', bodyType: 'json', body: '{"x":1}' },
  json: {
    bodyType: 'json',
    body: '{"name":"hello","n":1,"ok":true,"empty":null}',
  },
  jsonArray: { bodyType: 'json', body: '[1,"a",null]' },
  jsonScalar: { bodyType: 'json', body: 'false' },
  jsonInvalid: { bodyType: 'json', body: '{"incomplete":' },
  text: {
    bodyType: 'text',
    body: 'first\n"quote" \'apostrophe\' \\path\nПривет 😀\t$HOME `id` #{1} \\(value)',
  },
  form: {
    bodyType: 'form-urlencoded',
    body: 'tag=a%26b&tag=c+d&empty=&quote=%27%22%5C%0A',
  },
  multipartEmpty: { bodyType: 'multipart', formData: [] },
  multipart: {
    bodyType: 'multipart',
    formData: [
      { key: 'a', value: 'hello', type: 'text' },
      { key: 'a', value: 'second', type: 'text' },
    ],
  },
  multipartFile: {
    bodyType: 'multipart',
    formData: [
      { key: 'file', value: '/tmp/does-not-exist.bin', type: 'file' },
      { key: 'text', value: 'hello', type: 'text' },
    ],
  },
  multipartQuotes: {
    bodyType: 'multipart',
    formData: [
      { key: 'a"b', value: 'line\n\'quote\'\\path', type: 'text' },
      { key: 'file', value: '/tmp/quote\'file.txt', type: 'file' },
    ],
  },
  headers: { headers: [{ key: 'X-Value', value: 'a"b\'c\\d $foo' }] },
  baseVariable: { url: '{{base}}/items' },
  schemeVariable: { url: '{{scheme}}://example.com/items' },
  hostVariable: { url: 'https://{{host}}/items' },
  portVariable: { url: 'https://example.com:{{port}}/items' },
  pathVariable: { url: 'https://example.com/{{id}}?q={{q}}' },
  unicodeUrl: { url: 'https://example.com/путь?q=Привет мир' },
  escapedUrl: { url: 'https://example.com/a%2Fb?q=a%26b&x=1&x=2#fragment' },
  ipv6: { url: 'http://[::1]:8080/items' },
  unicodeBasic: {
    auth: { type: 'basic', username: 'пользователь', password: 'пароль' },
  },
}
