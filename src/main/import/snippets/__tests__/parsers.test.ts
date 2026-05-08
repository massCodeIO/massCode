import { describe, expect, it } from 'vitest'
import { parseGitHubGistResponse } from '../githubGists'
import { parseRaycastSnippetFiles } from '../raycast'
import { parseVSCodeSnippetFiles } from '../vscode'

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
        tags: ['gc'],
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
})
