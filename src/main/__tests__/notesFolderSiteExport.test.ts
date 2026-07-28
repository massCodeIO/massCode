import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  exportNoteFolderSite,
  parseNoteFolderSiteExportPayload,
  prepareNoteFolderSiteExport,
} from '../notesFolderSiteExport'

const mocks = vi.hoisted(() => ({
  hydrationCloudPlaceholder: false,
  hydrationUnavailable: false,
  parentPath: '',
  pending: false,
  resolveNotesAsset: vi.fn(),
  getNotes: vi.fn(),
  snippets: [{ id: 10, name: 'Second%2FPart' }],
}))

vi.mock('electron', () => ({
  BrowserWindow: {
    getFocusedWindow: () => null,
  },
  dialog: {
    showOpenDialog: vi.fn(async () => ({
      canceled: false,
      filePaths: [mocks.parentPath],
    })),
  },
}))

vi.mock('../storage', () => {
  const folders = [
    {
      children: [
        {
          children: [],
          createdAt: 2,
          icon: null,
          id: 2,
          isOpen: 0,
          name: 'Child',
          orderIndex: 0,
          parentId: 1,
          updatedAt: 2,
        },
        {
          children: [],
          createdAt: 3,
          icon: null,
          id: 4,
          isOpen: 0,
          name: 'Empty',
          orderIndex: 1,
          parentId: 1,
          updatedAt: 3,
        },
      ],
      createdAt: 1,
      icon: null,
      id: 1,
      isOpen: 0,
      name: 'Root',
      orderIndex: 0,
      parentId: null,
      updatedAt: 1,
    },
    {
      children: [],
      createdAt: 3,
      icon: null,
      id: 3,
      isOpen: 0,
      name: 'Other',
      orderIndex: 1,
      parentId: null,
      updatedAt: 3,
    },
  ]
  const flatFolders = folders.flatMap(folder => [folder, ...folder.children])
  const notes = [
    {
      content: [
        'See [[Root/Child/Second%2FPart]] and [[Outside]]. Bare [[Second%2FPart]].',
        '',
        '![asset](masscode://notes-asset/photo.png)',
        '',
        '![drawing](masscode://drawing/diagram)',
        '',
        '```text',
        'masscode://drawing/example',
        'masscode://notes-asset/example.png',
        '```',
      ].join('\n'),
      createdAt: 1,
      description: null,
      folder: { id: 1, name: 'Root' },
      id: 1,
      isDeleted: 0,
      isFavorites: 0,
      name: 'First',
      pendingCloudDownload: false,
      properties: {},
      tags: [],
      updatedAt: 1,
    },
    {
      content: '# Second',
      createdAt: 2,
      description: null,
      folder: { id: 2, name: 'Child' },
      id: 2,
      isDeleted: 0,
      isFavorites: 0,
      name: 'Second%2FPart',
      properties: {},
      tags: [],
      updatedAt: 2,
    },
    {
      content: '# Outside',
      createdAt: 3,
      description: null,
      folder: { id: 3, name: 'Other' },
      id: 3,
      isDeleted: 0,
      isFavorites: 0,
      name: 'Outside',
      properties: {},
      tags: [],
      updatedAt: 3,
    },
    {
      content: '# Third',
      createdAt: 4,
      description: null,
      folder: { id: 1, name: 'Root' },
      id: 5,
      isDeleted: 0,
      isFavorites: 0,
      name: 'Third',
      properties: {},
      tags: [],
      updatedAt: 4,
    },
  ]

  mocks.getNotes.mockImplementation(() =>
    notes.map((note, index) =>
      index === 0 ? { ...note, pendingCloudDownload: mocks.pending } : note,
    ),
  )

  return {
    useHttpStorage: () => ({
      folders: { getFolders: () => [] },
      requests: { getRequests: () => [] },
    }),
    useNotesStorage: () => ({
      folders: {
        getFolders: () => flatFolders,
        getFoldersTree: () => folders,
      },
      notes: {
        getNotes: mocks.getNotes,
      },
    }),
    useStorage: () => ({
      snippets: {
        getSnippets: () => mocks.snippets,
      },
    }),
  }
})

vi.mock('../storage/providers/markdown/notes/runtime', () => ({
  getNotesPaths: vi.fn(() => ({
    notesRoot: '/vault/notes',
  })),
  getNotesRuntimeCache: vi.fn(() => ({
    noteById: new Map(
      mocks
        .getNotes()
        .map(
          (note: {
            content: string
            id: number
            pendingCloudDownload?: boolean
          }) => [
            note.id,
            {
              content: mocks.hydrationUnavailable ? null : note.content,
              filePath: `${note.id}.md`,
              id: note.id,
              pendingCloudDownload: note.pendingCloudDownload,
            },
          ],
        ),
    ),
  })),
  resolveNotesAsset: mocks.resolveNotesAsset,
}))

vi.mock('../storage/providers/markdown/runtime/shared/cloudFiles', () => ({
  getFileAvailability: vi.fn((path: string) => ({
    exists: true,
    isCloudPlaceholder: mocks.hydrationCloudPlaceholder && path.endsWith('.md'),
  })),
}))

vi.mock('../storage/providers/markdown/runtime', () => ({
  DRAWINGS_SPACE_ID: 'drawings',
  getVaultPath: vi.fn(() => '/vault'),
  INVALID_NAME_CHARS_RE: /[<>:"/\\|?*]/g,
  WINDOWS_RESERVED_NAME_RE: /^(?:con|prn|aux|nul)$/i,
}))

describe('notes folder HTML site export', () => {
  beforeEach(async () => {
    mocks.parentPath = await mkdtemp(join(tmpdir(), 'notes-site-export-'))
    mocks.hydrationCloudPlaceholder = false
    mocks.hydrationUnavailable = false
    mocks.pending = false
    mocks.getNotes.mockClear()
    mocks.resolveNotesAsset.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'content-type': 'image/png' },
      }),
    )
  })

  afterEach(async () => {
    await rm(mocks.parentPath, { force: true, recursive: true })
  })

  it('builds a portable recursive site with scoped internal links', async () => {
    const result = await exportNoteFolderSite({
      drawingPreviews: [
        {
          id: 'diagram',
          svg: '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>',
        },
      ],
      folderId: 1,
      order: 'ASC',
      sort: 'name',
    })

    expect(result.status).toBe('exported')
    if (result.status !== 'exported') {
      return
    }

    const index = await readFile(
      join(result.directoryPath, 'index.html'),
      'utf8',
    )
    const first = await readFile(
      join(result.directoryPath, 'notes', '1-First.html'),
      'utf8',
    )
    expect(index).toContain('Root')
    expect(index).toContain('Child')
    expect(index).toContain('class="site-index-folder">Empty')
    expect(index).toContain('class="site-index"')
    expect(index).not.toContain('massCode')
    expect(index).toContain('href="index.html"')
    expect(index.match(/\.site-index-folder\s*\{/g)).toHaveLength(1)
    expect(index).toContain('font-size: 22px')
    expect(index).toContain('notes/1-First.html')
    expect(index).toContain('2-Second%252FPart.html')
    const indexContent = index.slice(
      index.indexOf('<section class="site-index">'),
    )
    expect(indexContent.indexOf('First')).toBeLessThan(
      indexContent.indexOf('Third'),
    )
    expect(indexContent.indexOf('Third')).toBeLessThan(
      indexContent.indexOf('class="site-index-folder">Child'),
    )
    expect(first).toContain('class="site-article"')
    expect(first).toContain('href="../index.html"')
    expect(first).toContain('aria-current="page"')
    expect(first).not.toMatch(
      /\.site-article h2\s*\{[^}]*\b(?:border-top|padding-top)\b/,
    )
    expect(first).toContain(
      'See <a href="2-Second%252FPart.html">Root/Child/Second%2FPart</a> and Outside. Bare Second%2FPart.',
    )
    expect(first).not.toContain('href="3-Outside.html"')
    expect(first).not.toMatch(/\bsrc="masscode:\/\//)
    expect(first).toContain('masscode://drawing/example')
    expect(first).toContain('masscode://notes-asset/example.png')
    expect(first).toContain('../assets/images/')
    expect(first).toContain('../assets/drawings/')
    expect(
      await readdir(join(result.directoryPath, 'assets', 'images')),
    ).toHaveLength(1)
    expect(
      await readdir(join(result.directoryPath, 'assets', 'drawings')),
    ).toHaveLength(1)
    expect(
      mocks.getNotes.mock.calls.some(
        ([query]) => query.sort === 'name' && query.order === 'ASC',
      ),
    ).toBe(true)
    expect(
      (await readdir(mocks.parentPath)).some(name =>
        name.startsWith('.masscode-site-'),
      ),
    ).toBe(false)
  })

  it('reports cloud-unavailable before producing a partial site', () => {
    mocks.pending = true

    expect(prepareNoteFolderSiteExport({ folderId: 1 })).toEqual({
      status: 'cloud-unavailable',
    })
  })

  it('detects a freshly evicted cloud note body', () => {
    mocks.hydrationUnavailable = true
    mocks.hydrationCloudPlaceholder = true

    expect(prepareNoteFolderSiteExport({ folderId: 1 })).toEqual({
      status: 'cloud-unavailable',
    })
  })

  it('reports a cloud-only asset without leaving a partial site', async () => {
    mocks.resolveNotesAsset.mockResolvedValue(
      new Response(null, {
        status: 503,
      }),
    )

    await expect(
      exportNoteFolderSite({
        drawingPreviews: [
          {
            id: 'diagram',
            svg: '<svg xmlns="http://www.w3.org/2000/svg"/>',
          },
        ],
        folderId: 1,
        order: 'DESC',
        sort: 'createdAt',
      }),
    ).resolves.toEqual({
      canceled: false,
      status: 'cloud-unavailable',
    })
    expect(await readdir(mocks.parentPath)).toEqual([])
  })

  it('fails closed when a drawing preview is missing', async () => {
    await expect(
      exportNoteFolderSite({
        drawingPreviews: [],
        folderId: 1,
        order: 'DESC',
        sort: 'createdAt',
      }),
    ).rejects.toThrow('Drawing preview is unavailable')
    expect(await readdir(mocks.parentPath)).toEqual([])
  })

  it('rejects an unsafe managed SVG asset', async () => {
    mocks.resolveNotesAsset.mockResolvedValue(
      new Response('<svg><script>alert(1)</script></svg>', {
        headers: { 'content-type': 'image/svg+xml' },
      }),
    )

    await expect(
      exportNoteFolderSite({
        drawingPreviews: [
          {
            id: 'diagram',
            svg: '<svg xmlns="http://www.w3.org/2000/svg"/>',
          },
        ],
        folderId: 1,
        order: 'DESC',
        sort: 'createdAt',
      }),
    ).rejects.toThrow('not a supported image')
    expect(await readdir(mocks.parentPath)).toEqual([])
  })

  it('rejects malformed final payloads', () => {
    expect(
      parseNoteFolderSiteExportPayload({
        drawingPreviews: [],
        folderId: 1,
        order: 'SIDEWAYS',
        sort: 'name',
      }),
    ).toBeNull()
  })
})
