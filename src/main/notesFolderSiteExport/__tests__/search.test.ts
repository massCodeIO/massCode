import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import {
  type NoteFolderSiteSearchEntry,
  renderNoteFolderSiteSearchAsset,
} from '../search'

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

const entries: NoteFolderSiteSearchEntry[] = [
  {
    content: [
      '---',
      'Thematic body remains searchable.',
      '',
      'See [[Root/Child/Second|Second visible]] and [[External/Hidden Target|Friendly \\| Alias]].',
      '',
      'Raw Array<SearchTerm> and <mark>VisibleMarkup</mark> with `<InlineType>` & separators \u2028 and \u2029 boundary.',
      '',
      '![asset](masscode://notes-asset/photo.png)',
      '',
      '```text',
      'const values: Array<FencedType> = []',
      'masscode://drawing/example',
      '```',
    ].join('\n'),
    folder: '',
    href: 'notes/1-First.html',
    title: 'First',
  },
  {
    content: '# Second\n\nContent-only café searchable phrase for excerpt.',
    folder: 'Child',
    href: 'notes/2-Second.html',
    title: 'Second',
  },
  {
    content: '',
    folder: '',
    href: 'notes/3-Third.html',
    title: 'Third <Guide>',
  },
]

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

describe('note folder site search', () => {
  it('builds a safe index from searchable Markdown content', () => {
    const searchAsset = renderNoteFolderSiteSearchAsset(entries)

    expect(searchAsset).toContain('const SEARCH_INDEX=')
    expect(searchAsset).toContain('normalize(\'NFD\')')
    expect(searchAsset).toContain('document.createElement(\'a\')')
    expect(searchAsset).toContain('.slice(0, 50)')
    expect(searchAsset).not.toContain('innerHTML')
    expect(searchAsset).toContain('Thematic body remains searchable')
    expect(searchAsset).toContain('Friendly | Alias')
    expect(searchAsset).not.toContain('External/Hidden Target')
    expect(searchAsset).toContain('Array\\u003cSearchTerm\\u003e')
    expect(searchAsset).toContain(
      '\\u003cmark\\u003eVisibleMarkup\\u003c/mark\\u003e',
    )
    expect(searchAsset).toContain('\\u003cInlineType\\u003e')
    expect(searchAsset).toContain('Array\\u003cFencedType\\u003e')
    expect(searchAsset).toContain('\\u0026 separators')
    expect(searchAsset).toContain('"title":"Third \\u003cGuide\\u003e"')
    expect(searchAsset).not.toContain('masscode://')
    expect(searchAsset).not.toContain('<mark>')
    expect(searchAsset).not.toContain('<Guide>')
    expect(searchAsset).not.toContain('\u2028')
    expect(searchAsset).not.toContain('\u2029')
  })

  it('searches with AND matching, ranking, excerpts and UI clearing', () => {
    const page = createSearchHarness(renderNoteFolderSiteSearchAsset(entries))

    page.input.value = '  café searchable  '
    page.input.dispatch('input')
    expect(page.navigation.hidden).toBe(true)
    expect(page.results.hidden).toBe(false)
    expect(page.noResults.hidden).toBe(true)
    expect(page.results.children).toHaveLength(1)
    expect(
      getResultText(page.results.children[0], 'site-search-result-title'),
    ).toBe('Second')
    expect(
      getResultText(page.results.children[0], 'site-search-result-folder'),
    ).toBe('Child')
    expect(
      getResultText(page.results.children[0], 'site-search-result-excerpt'),
    ).toContain('Content-only café searchable phrase')
    expect(page.results.children[0].href).toBe(
      'notes/2-Second.html?q=caf%C3%A9%20searchable',
    )

    page.input.value = 'second'
    page.input.dispatch('input')
    expect(
      getResultText(page.results.children[0], 'site-search-result-title'),
    ).toBe('Second')
    expect(
      getResultText(page.results.children[1], 'site-search-result-title'),
    ).toBe('First')

    page.input.value = 'child'
    page.input.dispatch('input')
    expect(page.results.children).toHaveLength(1)
    expect(
      getResultText(page.results.children[0], 'site-search-result-title'),
    ).toBe('Second')

    page.input.value = 'friendly alias'
    page.input.dispatch('input')
    expect(page.results.children).toHaveLength(1)
    expect(
      getResultText(page.results.children[0], 'site-search-result-title'),
    ).toBe('First')

    page.input.value = 'hidden target'
    page.input.dispatch('input')
    expect(page.results.children).toHaveLength(0)
    expect(page.noResults.hidden).toBe(false)

    page.input.value = 'searchterm inlinetype fencedtype'
    page.input.dispatch('input')
    expect(page.results.children).toHaveLength(1)
    expect(
      getResultText(page.results.children[0], 'site-search-result-excerpt'),
    ).toContain('Array<SearchTerm>')

    page.input.value = 'thematic searchable'
    page.input.dispatch('input')
    expect(page.results.children).toHaveLength(1)

    page.input.dispatch('keydown', { key: 'Escape' })
    expect(page.input.value).toBe('')
    expect(page.navigation.hidden).toBe(false)
    expect(page.results.hidden).toBe(true)
    expect(page.results.children).toHaveLength(0)
    expect(page.noResults.hidden).toBe(true)
    expect(page.navigation.children[0].children).toEqual(
      page.originalNavigationOrder,
    )

    page.input.value = 'missing'
    page.input.dispatch('input')
    page.input.value = ''
    page.input.dispatch('input')
    expect(page.navigation.hidden).toBe(false)
    expect(page.results.hidden).toBe(true)
  })

  it('restores the query and preserves a note-page link prefix', () => {
    const page = createSearchHarness(
      renderNoteFolderSiteSearchAsset(entries),
      '../',
      '?q=searchable%20phrase',
    )

    expect(page.input.value).toBe('searchable phrase')
    expect(page.navigation.hidden).toBe(true)
    expect(page.results.hidden).toBe(false)
    expect(page.results.children).toHaveLength(1)
    expect(page.results.children[0].href).toBe(
      '../notes/2-Second.html?q=searchable%20phrase',
    )
  })
})
