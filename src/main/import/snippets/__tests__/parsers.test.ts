import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectImportSource } from '../../detect'
import { parseObsidianMarkdownFiles } from '../../notes/obsidian'
import { fetchGitHubGistImport, parseGitHubGistResponse } from '../githubGists'
import { parseRaycastSnippetFiles } from '../raycast'
import { parseVSCodeSnippetFiles } from '../vscode'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('parseVSCodeSnippetFiles', () => {
  it('parses VS Code snippet JSON files', () => {
    const result = parseVSCodeSnippetFiles([
      {
        content: JSON.stringify({
          'Log value': {
            body: ['console.log($1)', '$0'],
            description: 'Print a value',
            prefix: ['log', 'debug'],
          },
        }),
        name: 'javascript.json',
      },
    ])

    expect(result.warnings).toEqual([])
    expect(result.snippets).toEqual([
      {
        contents: [
          {
            label: 'Fragment 1',
            language: 'javascript',
            value: 'console.log($1)\n$0',
          },
        ],
        description: 'Print a value',
        name: 'Log value',
        sourceId: 'javascript.json:Log value',
        tags: ['log', 'debug'],
      },
    ])
  })

  it('warns about invalid VS Code entries', () => {
    const result = parseVSCodeSnippetFiles([
      {
        content: JSON.stringify({
          Broken: {
            body: 1,
          },
        }),
        name: 'broken.code-snippets',
      },
    ])

    expect(result.snippets).toEqual([])
    expect(result.warnings).toEqual([
      {
        message: 'Snippet body must be a string or string array',
        source: 'broken.code-snippets/Broken',
      },
    ])
  })

  it('normalizes names that are invalid for markdown storage', () => {
    const result = parseVSCodeSnippetFiles([
      {
        content: JSON.stringify({
          '# Debug [helper]': {
            body: 'console.log($1)',
          },
        }),
        name: 'javascript.json',
      },
    ])

    expect(result.snippets[0].name).toBe('- Debug -helper-')
  })
})

describe('parseRaycastSnippetFiles', () => {
  it('parses Raycast snippets arrays', () => {
    const result = parseRaycastSnippetFiles([
      {
        content: JSON.stringify([
          {
            folder: 'Git/Commit',
            keyword: 'gc',
            name: 'Commit',
            text: 'git commit -m "$1"',
          },
        ]),
        name: 'raycast.json',
      },
    ])

    expect(result.warnings).toEqual([])
    expect(result.snippets).toEqual([
      {
        contents: [
          {
            label: 'Fragment 1',
            language: 'plain_text',
            value: 'git commit -m "$1"',
          },
        ],
        description: null,
        folderPath: ['Git', 'Commit'],
        name: 'Commit',
        sourceId: 'raycast.json:1',
        tags: [],
      },
    ])
  })
})

describe('parseGitHubGistResponse', () => {
  it('maps a multi-file Gist to one multi-content snippet', () => {
    const result = parseGitHubGistResponse(
      {
        description: 'Useful helpers',
        files: {
          'copy.ts': {
            content: 'export function copy() {}',
            filename: 'copy.ts',
            language: 'TypeScript',
          },
          'readme.md': {
            content: '# Usage',
            filename: 'readme.md',
            language: 'Markdown',
          },
        },
        html_url: 'https://gist.github.com/user/1234567890abcdef1234',
        id: '1234567890abcdef1234',
      },
      'https://gist.github.com/user/1234567890abcdef1234',
    )

    expect(result.warnings).toEqual([])
    expect(result.snippets).toEqual([
      {
        contents: [
          {
            label: 'copy.ts',
            language: 'typescript',
            value: 'export function copy() {}',
          },
          {
            label: 'readme.md',
            language: 'markdown',
            value: '# Usage',
          },
        ],
        description: 'https://gist.github.com/user/1234567890abcdef1234',
        name: 'Useful helpers',
        sourceId: '1234567890abcdef1234',
        sourceUrl: 'https://gist.github.com/user/1234567890abcdef1234',
        tags: ['gist'],
      },
    ])
  })

  it('reports private or missing Gists clearly', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
    } as Response)

    await expect(fetchGitHubGistImport('1234567890abcdef1234')).rejects.toThrow(
      'GitHub Gist was not found or is not public',
    )
  })
})

describe('parseObsidianMarkdownFiles', () => {
  it('parses markdown files with folder paths and frontmatter tags', () => {
    const content = `---
tags:
  - vue
  - snippets
---
# Component

Use #frontend patterns.`
    const body = `# Component

Use #frontend patterns.`

    const result = parseObsidianMarkdownFiles([
      {
        content,
        name: 'Component.md',
        relativePath: 'Knowledge/Vue/Component.md',
      },
      {
        content: 'ignored',
        name: 'image.png',
        relativePath: 'Assets/image.png',
      },
    ])

    expect(result.warnings).toEqual([])
    expect(result.notes).toEqual([
      {
        content: body,
        folderPath: ['Knowledge', 'Vue'],
        name: 'Component',
        sourceId: 'Knowledge/Vue/Component.md',
        tags: ['vue', 'snippets'],
      },
    ])
  })

  it('warns about Obsidian metadata and link limitations', () => {
    const result = parseObsidianMarkdownFiles([
      {
        content: `---
tags:
  - docs
source: https://example.com
---
See [[Project Plan]].

![[diagram.png]]
![local](attachments/local.png)`,
        name: 'Links.md',
        relativePath: 'Links.md',
      },
    ])

    expect(result.warnings).toEqual([
      {
        message: 'Frontmatter fields ignored: source',
        source: 'Links.md',
      },
      {
        message:
          'Attachment references are kept as text; attachment files are not imported',
        source: 'Links.md',
      },
      {
        message:
          'Obsidian wiki links are imported as text and are not rewritten',
        source: 'Links.md',
      },
    ])
    expect(result.notes[0].tags).toEqual(['docs'])
  })
})

describe('detectImportSource', () => {
  it('detects Raycast snippets in Code imports', () => {
    const result = detectImportSource(undefined, {
      files: [
        {
          content: JSON.stringify([
            {
              name: 'Reply',
              text: 'Thanks!',
            },
          ]),
          name: 'raycast.json',
        },
      ],
      space: 'code',
    })

    expect(result).toBe('raycast-snippets')
  })

  it('detects VS Code snippets in Code imports', () => {
    const result = detectImportSource(undefined, {
      files: [
        {
          content: JSON.stringify({
            Log: {
              body: 'console.log($1)',
            },
          }),
          name: 'javascript.json',
        },
      ],
      space: 'code',
    })

    expect(result).toBe('vscode-snippets')
  })

  it('detects Obsidian markdown folders in Notes imports', () => {
    const result = detectImportSource(undefined, {
      files: [
        {
          content: '# Note',
          name: 'Note.md',
          relativePath: 'Vault/Note.md',
        },
      ],
      space: 'notes',
    })

    expect(result).toBe('obsidian')
  })
})
