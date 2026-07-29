import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
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
  translate: vi.fn(),
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

vi.mock('../i18n', () => ({
  default: {
    t: (key: string) => mocks.translate(key),
  },
}))

vi.mock('../storage', () => {
  const rootFolder = {
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
    parentId: 6,
    updatedAt: 1,
  }
  const folders = [
    {
      children: [rootFolder],
      createdAt: 0,
      icon: null,
      id: 6,
      isOpen: 0,
      name: 'Private Parent',
      orderIndex: 0,
      parentId: null,
      updatedAt: 0,
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
  const flatFolders = [
    folders[0],
    rootFolder,
    ...rootFolder.children,
    folders[1],
  ]
  const notes = [
    {
      content: [
        '---',
        'Thematic body remains searchable.',
        '',
        'See [[Private Parent/Root/Child/Second%2FPart|Second visible]] and [[External/Hidden Target|Friendly \\| Alias]]. Bare [[Second%2FPart]].',
        '',
        'Raw Array<SearchTerm> and <mark>VisibleMarkup</mark> with `<InlineType>` & separators \u2028 and \u2029 boundary.',
        '',
        '![asset](masscode://notes-asset/photo.png)',
        '',
        '![drawing](masscode://drawing/diagram)',
        '',
        '```text',
        'const values: Array<FencedType> = []',
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
      content: '# Second\n\nContent-only café searchable phrase for excerpt.',
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
      content: '# External secret',
      createdAt: 3,
      description: null,
      folder: { id: 3, name: 'Other' },
      id: 3,
      isDeleted: 0,
      isFavorites: 0,
      name: 'ExternalOnly',
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
      name: 'Third <Guide>',
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

type FakeEventListener = (event: { key?: string }) => void

class FakeClassList {
  constructor(private readonly getNames: () => string[]) {}

  contains(name: string): boolean {
    return this.getNames().includes(name)
  }
}

class FakeElement {
  readonly children: FakeElement[] = []
  readonly classList: FakeClassList
  className: string
  hidden = false
  href = ''
  textContent: string

  constructor(
    readonly tagName: string,
    classNames: string[] = [],
    textContent = '',
  ) {
    this.className = classNames.join(' ')
    this.classList = new FakeClassList(() =>
      this.className.split(/\s+/).filter(Boolean),
    )
    this.textContent = textContent
  }

  append(...children: FakeElement[]): this {
    this.children.push(...children)
    return this
  }

  replaceChildren(...children: FakeElement[]): void {
    this.children.splice(0, this.children.length, ...children)
  }
}

class FakeInput extends FakeElement {
  private readonly listeners = new Map<string, FakeEventListener[]>()
  value = ''

  constructor() {
    super('INPUT')
  }

  addEventListener(type: string, listener: FakeEventListener): void {
    const listeners = this.listeners.get(type) ?? []
    listeners.push(listener)
    this.listeners.set(type, listeners)
  }

  dispatch(type: string, event: { key?: string } = {}): void {
    this.listeners.get(type)?.forEach(listener => listener(event))
  }
}

function createSearchHarness(
  searchAsset: string,
  prefix = '',
  locationSearch = '',
) {
  const input = new FakeInput()
  const navigation = new FakeElement('NAV', ['site-nav']).append(
    new FakeElement('UL').append(
      new FakeElement('LI', [], 'Original first'),
      new FakeElement('LI', [], 'Original second'),
    ),
  )
  const originalNavigationOrder = [...navigation.children[0].children]
  const results = new FakeElement('DIV', ['site-search-results'])
  results.hidden = true
  const noResults = new FakeElement('DIV', ['site-search-empty'])
  noResults.hidden = true
  const elements = new Map<string, FakeElement>([
    ['[data-site-search]', input],
    ['.site-nav', navigation],
    ['[data-site-search-results]', results],
    ['[data-site-search-empty]', noResults],
  ])

  runInNewContext(searchAsset, {
    document: {
      createElement: (tagName: string) =>
        new FakeElement(tagName.toUpperCase()),
      currentScript: {
        dataset: { searchPrefix: prefix },
      },
      querySelector: (selector: string) => elements.get(selector) ?? null,
    },
    HTMLInputElement: FakeInput,
    URLSearchParams,
    window: {
      location: {
        search: locationSearch,
      },
    },
  })

  return {
    input,
    navigation,
    noResults,
    originalNavigationOrder,
    results,
  }
}

function getResultText(
  result: FakeElement,
  className: string,
): string | undefined {
  return result.children.find(child => child.classList.contains(className))
    ?.textContent
}

describe('notes folder HTML site export', () => {
  beforeEach(async () => {
    mocks.parentPath = await mkdtemp(join(tmpdir(), 'notes-site-export-'))
    mocks.hydrationCloudPlaceholder = false
    mocks.hydrationUnavailable = false
    mocks.pending = false
    mocks.getNotes.mockClear()
    mocks.translate.mockImplementation((key: string) =>
      key === 'placeholder.searchNotes'
        ? 'Search <notes> "now"'
        : 'No <results>',
    )
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
    const searchAsset = await readFile(
      join(result.directoryPath, 'assets', 'search.js'),
      'utf8',
    )
    for (const page of [index, first]) {
      expect(page).toContain('class="site-search-input"')
      expect(page).toContain(
        'placeholder="Search &lt;notes&gt; &quot;now&quot;"',
      )
      expect(page).toContain('No &lt;results&gt;')
      expect(page).toContain('data-site-search')
      expect(page).toContain('data-site-search-results')
      expect(page).toContain('script-src \'self\'')
      expect(page).not.toContain('script-src \'unsafe-inline\'')
      expect(page).not.toContain('<script>')
    }
    expect(mocks.translate).toHaveBeenCalledWith('placeholder.searchNotes')
    expect(mocks.translate).toHaveBeenCalledWith('commandPalette.empty')
    expect(index).toContain(
      '<script src="assets/search.js" data-search-prefix=""></script>',
    )
    expect(first).toContain(
      '<script src="../assets/search.js" data-search-prefix="../"></script>',
    )
    expect(searchAsset).toContain('const SEARCH_INDEX=')
    expect(searchAsset).toContain('normalize(\'NFD\')')
    expect(searchAsset).toContain('document.createElement(\'a\')')
    expect(searchAsset).toContain('.slice(0, 50)')
    expect(searchAsset).not.toContain('innerHTML')
    expect(searchAsset).toContain('"title":"First"')
    expect(searchAsset).toContain('"title":"Second%2FPart"')
    expect(searchAsset).toContain('"title":"Third \\u003cGuide\\u003e"')
    expect(searchAsset).toContain('"folder":""')
    expect(searchAsset).toContain('"folder":"Child"')
    expect(searchAsset).toContain('Content-only café searchable phrase')
    expect(searchAsset).toContain('VisibleMarkup')
    expect(searchAsset).toContain('Thematic body remains searchable')
    expect(searchAsset).toContain('Friendly | Alias')
    expect(searchAsset).toContain('Array\\u003cSearchTerm\\u003e')
    expect(searchAsset).toContain(
      '\\u003cmark\\u003eVisibleMarkup\\u003c/mark\\u003e',
    )
    expect(searchAsset).toContain('\\u003cInlineType\\u003e')
    expect(searchAsset).toContain('Array\\u003cFencedType\\u003e')
    expect(searchAsset).toContain('\\u0026 separator')
    expect(searchAsset).not.toContain('ExternalOnly')
    expect(searchAsset).not.toContain('External secret')
    expect(searchAsset).not.toContain('External/Hidden Target')
    expect(searchAsset).not.toContain('Private Parent')
    expect(searchAsset).not.toContain('masscode://')
    expect(searchAsset).not.toContain('<mark>')
    expect(searchAsset).not.toContain('<Guide>')
    expect(searchAsset).not.toContain('\u2028')
    expect(searchAsset).not.toContain('\u2029')
    expect(index).toContain('Root')
    expect(index).toContain('--site-accent: #52525b')
    expect(index).toContain(
      'blockquote { border-left-color: var(--site-accent); }',
    )
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
      'See <a href="2-Second%252FPart.html">Second visible</a> and Friendly | Alias. Bare Second%2FPart.',
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

  it('runs full-text search from the shared asset with page-relative links', async () => {
    const result = await exportNoteFolderSite({
      drawingPreviews: [
        {
          id: 'diagram',
          svg: '<svg xmlns="http://www.w3.org/2000/svg"/>',
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

    const searchAsset = await readFile(
      join(result.directoryPath, 'assets', 'search.js'),
      'utf8',
    )

    const indexPage = createSearchHarness(searchAsset)
    indexPage.input.value = '  café searchable  '
    indexPage.input.dispatch('input')
    expect(indexPage.navigation.hidden).toBe(true)
    expect(indexPage.results.hidden).toBe(false)
    expect(indexPage.noResults.hidden).toBe(true)
    expect(indexPage.results.children).toHaveLength(1)
    expect(
      getResultText(indexPage.results.children[0], 'site-search-result-title'),
    ).toBe('Second%2FPart')
    expect(
      getResultText(indexPage.results.children[0], 'site-search-result-folder'),
    ).toBe('Child')
    expect(
      getResultText(
        indexPage.results.children[0],
        'site-search-result-excerpt',
      ),
    ).toContain('Content-only café searchable phrase')
    expect(indexPage.results.children[0].href).toBe(
      'notes/2-Second%252FPart.html?q=caf%C3%A9%20searchable',
    )

    indexPage.input.value = 'child'
    indexPage.input.dispatch('input')
    expect(indexPage.results.children).toHaveLength(1)
    expect(
      getResultText(indexPage.results.children[0], 'site-search-result-title'),
    ).toBe('Second%2FPart')
    indexPage.input.value = 'second'
    indexPage.input.dispatch('input')
    expect(
      getResultText(indexPage.results.children[0], 'site-search-result-title'),
    ).toBe('Second%2FPart')
    expect(
      getResultText(indexPage.results.children[1], 'site-search-result-title'),
    ).toBe('First')

    indexPage.input.value = 'friendly alias'
    indexPage.input.dispatch('input')
    expect(indexPage.results.children).toHaveLength(1)
    expect(
      getResultText(indexPage.results.children[0], 'site-search-result-title'),
    ).toBe('First')

    indexPage.input.value = 'hidden target'
    indexPage.input.dispatch('input')
    expect(indexPage.results.children).toHaveLength(0)
    expect(indexPage.noResults.hidden).toBe(false)

    indexPage.input.value = 'searchterm inlinetype fencedtype'
    indexPage.input.dispatch('input')
    expect(indexPage.results.children).toHaveLength(1)
    expect(
      getResultText(indexPage.results.children[0], 'site-search-result-title'),
    ).toBe('First')
    expect(
      getResultText(
        indexPage.results.children[0],
        'site-search-result-excerpt',
      ),
    ).toContain('Array<SearchTerm>')

    indexPage.input.value = 'thematic searchable'
    indexPage.input.dispatch('input')
    expect(indexPage.results.children).toHaveLength(1)
    expect(
      getResultText(indexPage.results.children[0], 'site-search-result-title'),
    ).toBe('First')

    indexPage.input.value = 'externalonly'
    indexPage.input.dispatch('input')
    expect(indexPage.results.children).toHaveLength(0)
    expect(indexPage.noResults.hidden).toBe(false)

    indexPage.input.dispatch('keydown', { key: 'Escape' })
    expect(indexPage.input.value).toBe('')
    expect(indexPage.navigation.hidden).toBe(false)
    expect(indexPage.results.hidden).toBe(true)
    expect(indexPage.results.children).toHaveLength(0)
    expect(indexPage.noResults.hidden).toBe(true)
    expect(indexPage.navigation.children[0].children).toEqual(
      indexPage.originalNavigationOrder,
    )

    indexPage.input.value = 'missing'
    indexPage.input.dispatch('input')
    indexPage.input.value = ''
    indexPage.input.dispatch('input')
    expect(indexPage.navigation.hidden).toBe(false)
    expect(indexPage.results.hidden).toBe(true)
    expect(indexPage.navigation.children[0].children).toEqual(
      indexPage.originalNavigationOrder,
    )

    const notePage = createSearchHarness(
      searchAsset,
      '../',
      '?q=searchable%20phrase',
    )
    expect(notePage.input.value).toBe('searchable phrase')
    expect(notePage.navigation.hidden).toBe(true)
    expect(notePage.results.hidden).toBe(false)
    expect(notePage.results.children).toHaveLength(1)
    expect(notePage.results.children[0].href).toBe(
      '../notes/2-Second%252FPart.html?q=searchable%20phrase',
    )
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
