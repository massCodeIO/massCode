import { describe, expect, it } from 'vitest'
import {
  chunkRecord,
  hasWords,
  keywordDocument,
  splitCode,
  splitText,
  stripLinks,
} from '../chunks'

describe('splitText', () => {
  it('cuts on whitespace with overlap and starts on a whole word', () => {
    const text = Array.from({ length: 200 }, (_, index) => `word${index}`).join(
      ' ',
    )
    const parts = splitText(text, 300, 60)
    expect(parts.length).toBeGreaterThan(3)
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(300)
      expect(part).toMatch(/^word\d+/)
      expect(part).toMatch(/word\d+$/)
    }
    expect(parts[0].includes(parts[1].split(' ')[0])).toBe(true)
  })
  it('cuts text without spaces by size', () => {
    expect(
      splitText('x'.repeat(700), 300, 50).every(part => part.length <= 300),
    ).toBe(true)
  })
})

describe('splitCode', () => {
  it('keeps whole lines and repeats two lines between chunks', () => {
    const code = Array.from(
      { length: 50 },
      (_, index) => `line ${index} ${'x'.repeat(20)}`,
    ).join('\n')
    const parts = splitCode(code, 300)
    expect(parts.length).toBeGreaterThan(1)
    expect(parts[1].split('\n').slice(0, 2)).toEqual(
      parts[0].split('\n').slice(-2),
    )
  })
  it('drops overlap lines rather than exceed the size with lines close to it', () => {
    const code = [100, 150, 280, 290, 120, 299]
      .map((length, index) => String(index).padEnd(length, 'x'))
      .join('\n')
    for (const part of splitCode(code, 300))
      expect(part.length).toBeLessThanOrEqual(300)
  })
  it('hard-splits a single overlong line into pieces of the size', () => {
    expect(splitCode('a'.repeat(700), 300).map(part => part.length)).toEqual([
      300,
      300,
      100,
    ])
  })
})

describe('hasWords', () => {
  it('accepts prose and rejects dumps', () => {
    expect(hasWords('retry the request with backoff')).toBe(true)
    expect(hasWords('12 34 5678 0x1f 99 1')).toBe(false)
    expect(hasWords('')).toBe(false)
    expect(hasWords('Untitled', 12)).toBe(false)
  })
  it('rejects hex dumps, uuid lists and base64', () => {
    const hex = Array.from(
      { length: 20 },
      (_, row) =>
        `${(row * 16).toString(16).padStart(8, '0')}  de ad be ef ca fe ba be 0f 1e 2d 3c 4b 5a 69 78`,
    ).join('\n')
    const uuids = [
      '3f2a9c1e-4b7d-4e2a-9c1f-7d3e2b1a0c9f',
      'bead1e5a-cafe-4bad-8ace-deadbeefcafe',
      '0d1e2f3a-4b5c-4d6e-8f70-81a2b3c4d5e6',
    ].join('\n')
    const base64
      = 'U29tZSBiYXNlNjQgZW5jb2RlZCBwYXlsb2FkIHdpdGggcGFkZGluZw==\nQW5vdGhlckxpbmVPZkJhc2U2NEVuY29kZWRUZXh0SGVyZQ=='
    expect(hasWords(hex)).toBe(false)
    expect(hasWords(uuids)).toBe(false)
    expect(hasWords(base64)).toBe(false)
  })
  it('counts chinese characters as about three letters each', () => {
    expect(hasWords('在服务器上部署应用程序', 4)).toBe(true)
    expect(hasWords('数据库备份脚本', 12)).toBe(true)
  })
})

describe('chunkRecord', () => {
  it('splits a snippet into name chunk and fragments with label titles', () => {
    const chunks = chunkRecord({
      type: 'snippet',
      id: 7,
      name: 'Staging hosts',
      description: null,
      contents: [
        {
          label: 'hosts.ini',
          language: 'ini',
          value: '# Inventory deployment\n[web]',
        },
      ],
    })
    expect(
      chunks.map(chunk => [
        chunk.ref,
        chunk.n,
        chunk.title,
        chunk.text,
        chunk.code,
      ]),
    ).toEqual([
      ['snippet:7', 0, 'Staging hosts', 'Staging hosts', false],
      [
        'snippet:7',
        1,
        'Staging hosts · hosts.ini · ini',
        '# Inventory deployment\n[web]',
        true,
      ],
    ])
  })
  it('splits long notes by size with the note name as title', () => {
    const chunks = chunkRecord({
      type: 'note',
      id: 1,
      name: 'Plan',
      content: 'word '.repeat(1500),
    })
    expect(chunks.length).toBeGreaterThan(2)
    expect(
      chunks.every(
        chunk => chunk.title === 'Plan' && chunk.text.length <= 1800,
      ),
    ).toBe(true)
  })
  it('makes one chunk for an http request without query or host', () => {
    const [chunk] = chunkRecord({
      type: 'http_request',
      id: 2,
      name: 'Refund',
      method: 'POST',
      url: '{{baseUrl}}/api/v2/payments/1/refund?x=1',
      description: 'Issues a refund',
    })
    expect(chunk.text).toBe('POST /api/v2/payments/1/refund\nIssues a refund')
  })
  it('does not embed near-empty records or number dumps', () => {
    expect(
      chunkRecord({ type: 'note', id: 5, name: 'Untitled', content: '...' })[0]
        .hasWords,
    ).toBe(false)
    expect(
      chunkRecord({
        type: 'note',
        id: 4,
        name: 'dump',
        content: '1 2 3\n'.repeat(100),
      })[0].hasWords,
    ).toBe(false)
  })
})

describe('keywordDocument', () => {
  it('keeps the http path without host and query', () => {
    expect(
      keywordDocument({
        type: 'http_request',
        id: 1,
        name: 'Refund',
        method: 'POST',
        url: 'https://api.example.com/v2/refund?token=secret',
        description: 'Refund money',
      }),
    ).toEqual({
      ref: 'http_request:1',
      name: 'Refund',
      body: 'POST /v2/refund\nRefund money',
    })
  })
  it('joins snippet description, labels and bodies', () => {
    expect(
      keywordDocument({
        type: 'snippet',
        id: 2,
        name: 'Hosts',
        description: 'Staging',
        contents: [{ label: 'hosts.ini', language: 'ini', value: '[web]' }],
      }).body,
    ).toBe('Staging\nhosts.ini\n[web]')
  })
})

describe('links and folders', () => {
  it('drops link and image targets from note chunks so an image-only note gets no vector', () => {
    const image = chunkRecord({
      type: 'note',
      id: 1,
      name: 'Untitled note 1',
      content: '![image](masscode://notes-asset/DaVLNScxJrCWI7bm.png)',
    })
    expect(image[0]).toMatchObject({ text: '![image]', hasWords: false })
    const link = chunkRecord({
      type: 'note',
      id: 2,
      name: 'Bug',
      content:
        'See [the issue](https://github.com/org/repo/issues/12) and https://example.test/a?b=c for details',
    })
    expect(link[0].text).toBe('See [the issue] and   for details')
  })
  it('searches the folder name by words but keeps it out of the embedded text', () => {
    const record = {
      type: 'snippet' as const,
      id: 1,
      name: 'Schedule bucket',
      description: null,
      folder: 'Background Jobs',
      contents: [{ label: 'a', language: 'ts', value: 'export const x = 1' }],
    }
    expect(keywordDocument(record)).toMatchObject({
      folder: 'Background Jobs',
    })
    expect(keywordDocument(record).body).not.toContain('Background')
    expect(
      chunkRecord(record)
        .map(chunk => `${chunk.title} ${chunk.text}`)
        .join(' '),
    ).not.toContain('Background')
  })
})

describe('stripLinks', () => {
  it('keeps code spans, fenced code and calls that are not links', () => {
    expect(stripLinks('call obj[key](arg) here')).toBe(
      'call obj[key](arg) here',
    )
    expect(
      stripLinks('`[a](https://x.test)` and\n```\n[b](https://y.test)\n```'),
    ).toBe('`[a](https://x.test)` and\n```\n[b](https://y.test)\n```')
  })
  it('keeps tilde and long backtick fences and drops link titles', () => {
    expect(
      stripLinks('~~~\n[a](https://x.test)\n~~~\nafter [b](https://y.test)'),
    ).toBe('~~~\n[a](https://x.test)\n~~~\nafter [b]')
    expect(
      stripLinks(
        '````md\n```\n[a](https://x.test)\n````\n[c](https://z.test "Title")',
      ),
    ).toBe('````md\n```\n[a](https://x.test)\n````\n[c]')
  })
  it('drops targets with parentheses and relative paths', () => {
    expect(
      stripLinks(
        '[Foo](https://en.wikipedia.org/wiki/Foo_(bar)) and https://en.wikipedia.org/wiki/Foo_(bar) end',
      ),
    ).toBe('[Foo] and   end')
    expect(
      stripLinks('[doc](./docs/readme.md) [up](../a) [anchor](#top)'),
    ).toBe('[doc] [up] [anchor]')
  })
  it('keeps URLs with tokens out of snippet and HTTP descriptions sent to the model', () => {
    const http = chunkRecord({
      type: 'http_request',
      id: 1,
      name: 'Orders',
      method: 'GET',
      url: '/orders',
      description: 'Docs https://api.test/docs?token=secret',
    })
    expect(http[0].text).not.toContain('secret')
    const snippet = chunkRecord({
      type: 'snippet',
      id: 1,
      name: 'Hook',
      description: 'See https://hooks.test/abc?key=secret',
      contents: [],
    })
    expect(snippet[0].text).not.toContain('secret')
  })
})

describe('note name chunk', () => {
  it('adds the note name as the last chunk so text chunk numbers stay stable', () => {
    const chunks = chunkRecord({
      type: 'note',
      id: 1,
      name: 'Orbit roadmap',
      content: '# Checks\n- HTTP checks',
    })
    expect(
      chunks.map(chunk => [chunk.n, chunk.text, chunk.hasWords]),
    ).toEqual([
      [0, '# Checks\n- HTTP checks', true],
      [1, 'Orbit roadmap', true],
    ])
  })
})
