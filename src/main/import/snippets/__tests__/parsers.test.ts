import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectImportSource } from '../../detect'
import { parseObsidianMarkdownFiles } from '../../notes/obsidian'
import { fetchGitHubGistImport, parseGitHubGistResponse } from '../githubGists'
import { parseRaycastSnippetFiles } from '../raycast'
import { parseSnippetsLabFiles } from '../snippetsLab'
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
        code: 'vscode.invalidBody',
        source: 'broken.code-snippets/Broken',
      },
    ])
  })

  it('uses plain text for unknown VS Code snippet file names', () => {
    const result = parseVSCodeSnippetFiles([
      {
        content: JSON.stringify({
          Log: {
            body: 'console.log($1)',
          },
        }),
        name: 'my-snippets.json',
      },
    ])

    expect(result.snippets[0].contents[0].language).toBe('plain_text')
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

describe('parseSnippetsLabFiles', () => {
  it('parses SnippetsLab JSON exports with folders, tags, and fragments', () => {
    const result = parseSnippetsLabFiles([
      {
        content: JSON.stringify({
          app: '2.6.4',
          contents: {
            folders: [
              {
                children: [
                  {
                    title: 'Vue',
                    uuid: 'folder-vue',
                  },
                ],
                title: 'Frontend',
                uuid: 'folder-frontend',
              },
            ],
            smartGroups: [
              {
                title: 'Vue snippets',
                uuid: 'smart-vue',
              },
            ],
            snippets: [
              {
                folder: 'folder-vue',
                fragments: [
                  {
                    content: 'export default {}',
                    language: 'JavascriptLexer',
                    title: 'index.js',
                    uuid: 'fragment-js',
                  },
                  {
                    content: '# Notes',
                    language: 'MarkdownLexer',
                    note: 'Keep as markdown',
                    title: 'readme.md',
                    uuid: 'fragment-md',
                  },
                ],
                githubHTMLURL: 'https://gist.github.com/user/abc',
                tags: ['tag-vue'],
                title: 'Vue helper',
                uuid: 'snippet-vue',
              },
            ],
            tags: [
              {
                title: 'vue',
                uuid: 'tag-vue',
              },
            ],
          },
          schema: '2.6',
        }),
        name: 'snippetslab.json',
      },
    ])

    expect(result.warnings).toEqual([
      {
        code: 'snippetslab.smartGroupsSkipped',
        source: 'snippetslab.json',
      },
    ])
    expect(result.snippets).toEqual([
      {
        contents: [
          {
            label: 'index.js',
            language: 'javascript',
            value: 'export default {}',
          },
          {
            label: 'readme.md',
            language: 'markdown',
            value: '# Notes',
          },
        ],
        description:
          'https://gist.github.com/user/abc\n\nreadme.md:\nKeep as markdown',
        folderPath: ['Frontend', 'Vue'],
        name: 'Vue helper',
        sourceId: 'snippet-vue',
        sourceUrl: 'https://gist.github.com/user/abc',
        tags: ['vue'],
      },
    ])
  })

  it('skips SnippetsLab snippets without importable fragments', () => {
    const result = parseSnippetsLabFiles([
      {
        content: JSON.stringify({
          app: '2.6.4',
          contents: {
            snippets: [
              {
                fragments: [
                  {
                    content: '',
                    language: 'TextLexer',
                    title: 'Fragment',
                  },
                ],
                title: 'Empty',
                uuid: 'empty-snippet',
              },
            ],
          },
          schema: '2.6',
        }),
        name: 'snippetslab.json',
      },
    ])

    expect(result.snippets).toEqual([])
    expect(result.warnings).toEqual([
      {
        code: 'snippetslab.emptySnippet',
        source: 'snippetslab.json/empty-snippet',
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

  it('reports GitHub Gist rate limits clearly', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      headers: new Headers({
        'x-ratelimit-remaining': '0',
      }),
      ok: false,
      status: 403,
    } as Response)

    await expect(fetchGitHubGistImport('1234567890abcdef1234')).rejects.toThrow(
      'GitHub Gist rate limit reached. Try again later.',
    )
  })

  it('reports GitHub Gist request timeouts clearly', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      Object.assign(new Error('timeout'), { name: 'TimeoutError' }),
    )

    await expect(fetchGitHubGistImport('1234567890abcdef1234')).rejects.toThrow(
      'GitHub Gist request timed out',
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
        code: 'obsidian.frontmatterIgnored',
        details: {
          fields: 'source',
        },
        source: 'Links.md',
      },
      {
        code: 'obsidian.attachmentsKept',
        source: 'Links.md',
      },
      {
        code: 'obsidian.wikiLinksKept',
        source: 'Links.md',
      },
    ])
    expect(result.notes[0].tags).toEqual(['docs'])
  })

  it('keeps files with malformed frontmatter importable', () => {
    const result = parseObsidianMarkdownFiles([
      {
        content: `---
tags: [docs
---
# Still imported`,
        name: 'Broken.md',
      },
    ])

    expect(result.warnings).toEqual([
      {
        code: 'obsidian.invalidFrontmatter',
        source: 'Broken.md',
      },
    ])
    expect(result.notes).toHaveLength(1)
    expect(result.notes[0].content).toContain('# Still imported')
  })

  it('normalizes Obsidian hierarchical tags to flat tags', () => {
    const result = parseObsidianMarkdownFiles([
      {
        content: `---
tags: vue/component
---
# Component`,
        name: 'Component.md',
      },
    ])

    expect(result.notes[0].tags).toEqual(['vue-component'])
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

  it('detects SnippetsLab exports in Code imports', () => {
    const result = detectImportSource(undefined, {
      files: [
        {
          content: JSON.stringify({
            app: '2.6.4',
            contents: {
              snippets: [
                {
                  fragments: [
                    {
                      content: 'console.log(1)',
                      language: 'JavascriptLexer',
                      title: 'Fragment',
                    },
                  ],
                  title: 'Log',
                  uuid: 'snippet-log',
                },
              ],
            },
            schema: '2.6',
          }),
          name: 'snippetslab.json',
        },
      ],
      space: 'code',
    })

    expect(result).toBe('snippetslab')
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

  it('keeps the current Raycast tie-break for ambiguous snippet imports', () => {
    const result = detectImportSource(undefined, {
      files: [
        {
          content: JSON.stringify([
            {
              name: 'Raycast',
              text: 'console.log($1)',
            },
          ]),
          name: 'raycast.json',
        },
        {
          content: JSON.stringify({
            VSCode: {
              body: 'console.log($1)',
            },
          }),
          name: 'javascript.json',
        },
      ],
      space: 'code',
    })

    expect(result).toBe('raycast-snippets')
  })
})
