import { Buffer } from 'node:buffer'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  parseNoteExportPayload,
  renderNoteHtml,
  sanitizeNoteExportFileName,
  writeFileAtomically,
} from '../notesExport'

vi.mock('electron', () => ({
  BrowserWindow: {
    getFocusedWindow: () => null,
  },
  dialog: {
    showSaveDialog: vi.fn(),
  },
}))

vi.mock('../storage/providers/markdown/notes/runtime', () => ({
  getNotesPaths: vi.fn(),
  resolveNotesAsset: vi.fn(),
}))

vi.mock('../storage/providers/markdown/runtime', () => ({
  getVaultPath: vi.fn(),
  INVALID_NAME_CHARS_RE: /[<>:"/\\|?*]/g,
  WINDOWS_RESERVED_NAME_RE: /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i,
}))

describe('note export helpers', () => {
  it('renders common Markdown features into a complete document', async () => {
    const html = await renderNoteHtml(
      'Guide',
      [
        '# Heading',
        '',
        '> Quote',
        '',
        '| A | B |',
        '| - | - |',
        '| 1 | 2 |',
        '',
        '```ts',
        'const value = 1',
        '```',
      ].join('\n'),
      vi.fn(),
    )

    expect(html).toContain('<!doctype html>')
    expect(html).toContain('<h1>Heading</h1>')
    expect(html).toContain('<blockquote>')
    expect(html).toContain('<table>')
    expect(html).toContain('<code class="language-ts">')
    expect(html).toContain('img-src data:')
    expect(html).not.toMatch(/img-src[^"]*https?:/)
  })

  it('disables raw HTML and escapes the document title', async () => {
    const html = await renderNoteHtml(
      '<script>alert("title")</script>',
      '<script>alert("body")</script>',
      vi.fn(),
    )

    expect(html).toContain(
      '<title>&lt;script&gt;alert(&quot;title&quot;)&lt;/script&gt;</title>',
    )
    expect(html).toContain(
      '&lt;script&gt;alert(&quot;body&quot;)&lt;/script&gt;',
    )
    expect(html).not.toContain('<script>alert')
  })

  it('wraps long fenced code lines in HTML and PDF', async () => {
    const html = await renderNoteHtml(
      'Code',
      `\`\`\`text\n${'a'.repeat(500)}\n\`\`\``,
      vi.fn(),
    )

    expect(html).toContain('overflow: visible;')
    expect(html).toContain('white-space: pre-wrap;')
    expect(html).toContain('overflow-wrap: anywhere;')
    expect(html).toContain('word-break: break-word;')
    expect(html).not.toContain('overflow: auto;')
  })

  it('frames images like the Notes renderer', async () => {
    const html = await renderNoteHtml(
      'Image',
      '![diagram](https://example.com/diagram.png)',
      vi.fn(),
    )

    expect(html).toContain('display: block;')
    expect(html).toContain('border: 1px solid #d1d9e0;')
    expect(html).toContain('border-radius: 8px;')
  })

  it('embeds managed assets returned by the injected resolver', async () => {
    const resolveAsset = vi.fn(
      async () =>
        new Response(Uint8Array.from([1, 2, 3]), {
          headers: { 'Content-Type': 'image/png' },
        }),
    )
    const html = await renderNoteHtml(
      'Image',
      '![diagram](masscode://notes-asset/abcdefghijklmnop.png)',
      resolveAsset,
    )

    expect(resolveAsset).toHaveBeenCalledWith('abcdefghijklmnop.png')
    expect(html).toContain('src="data:image/png;base64,AQID"')
  })

  it('keeps an unavailable managed asset unchanged', async () => {
    const html = await renderNoteHtml(
      'Image',
      '![diagram](masscode://notes-asset/abcdefghijklmnop.png)',
      async () => new Response('missing', { status: 404 }),
    )

    expect(html).toContain('src="masscode://notes-asset/abcdefghijklmnop.png"')
  })

  it('rejects export while a managed asset is temporarily unavailable', async () => {
    await expect(
      renderNoteHtml(
        'Image',
        '![diagram](masscode://notes-asset/abcdefghijklmnop.png)',
        async () => new Response('pending', { status: 503 }),
      ),
    ).rejects.toThrow('temporarily unavailable')
  })

  it('atomically overwrites a destination without leaving temp files', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'notes-export-test-'))
    const destination = join(directory, 'note.html')

    try {
      await writeFile(destination, 'old', 'utf8')
      await writeFileAtomically(destination, 'new')

      expect(await readFile(destination, 'utf8')).toBe('new')
      expect(await readdir(directory)).toEqual(['note.html'])
    }
    finally {
      await rm(directory, { force: true, recursive: true })
    }
  })

  it('sanitizes export filenames', () => {
    expect(sanitizeNoteExportFileName('  Plan: Q3/2026.  ', 'html')).toBe(
      'Plan- Q3-2026.html',
    )
    expect(sanitizeNoteExportFileName('CON', 'pdf')).toBe('_CON.pdf')
    expect(sanitizeNoteExportFileName(' ... ', 'html')).toBe('note.html')

    const longAsciiName = sanitizeNoteExportFileName('a'.repeat(500), 'html')
    const longEmojiName = sanitizeNoteExportFileName('😀'.repeat(100), 'pdf')
    expect(Buffer.byteLength(longAsciiName)).toBeLessThanOrEqual(240)
    expect(Buffer.byteLength(longEmojiName)).toBeLessThanOrEqual(240)
    expect(longEmojiName).not.toContain('\uFFFD')
  })

  it('validates renderer payloads', () => {
    expect(
      parseNoteExportPayload({
        content: '# Note',
        format: 'pdf',
        name: 'Note',
      }),
    ).toEqual({ content: '# Note', format: 'pdf', name: 'Note' })
    expect(
      parseNoteExportPayload({
        content: '# Note',
        format: 'docx',
        name: 'Note',
      }),
    ).toBeNull()
  })
})
