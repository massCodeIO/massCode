import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import {
  getInternalLinkEntityStatus,
  shouldShowInternalLinkWidget,
} from '../decorations'

vi.mock('vue', async (importOriginal) => {
  const vue = await importOriginal<typeof import('vue')>()
  return {
    ...vue,
    render: (vnode: any, container: any) => {
      if (!vnode)
        return
      const tooltip = vnode.children.default()
      const [trigger, content] = tooltip.children.default()
      container.tooltipText = content.children.default()
      trigger.props.onVnodeMounted({ el: container })
    },
  }
})

vi.mock('@/electron', () => ({
  i18n: {
    t: vi.fn((key: string) => key),
  },
  ipc: {
    on: vi.fn(),
  },
  store: {
    preferences: {
      get: vi.fn(() => 4321),
    },
  },
}))

vi.mock('@/services/api', () => ({
  api: {
    httpRequests: { getHttpRequestsById: vi.fn(), getHttpRequests: vi.fn() },
    httpFolders: { getHttpFolders: vi.fn() },
    notes: { getNotesById: vi.fn() },
    noteFolders: { getNoteFolders: vi.fn() },
    snippets: { getSnippetsById: vi.fn() },
  },
}))

describe('shouldShowInternalLinkWidget', () => {
  it('does not render widgets in raw mode', () => {
    expect(
      shouldShowInternalLinkWidget(
        'raw',
        true,
        [{ from: 0, to: 0, empty: true }],
        5,
        20,
      ),
    ).toBe(false)
  })

  it('renders widgets in livePreview and preview when selection is outside the link', () => {
    expect(
      shouldShowInternalLinkWidget(
        'livePreview',
        true,
        [{ from: 0, to: 0, empty: true }],
        5,
        20,
      ),
    ).toBe(true)
    expect(
      shouldShowInternalLinkWidget(
        'preview',
        false,
        [{ from: 0, to: 0, empty: true }],
        5,
        20,
      ),
    ).toBe(true)
  })

  it('shows raw markdown when focused selection is inside the link source range', () => {
    expect(
      shouldShowInternalLinkWidget(
        'livePreview',
        true,
        [{ from: 8, to: 8, empty: true }],
        5,
        20,
      ),
    ).toBe(false)
  })

  it('renders widget when the caret is exactly at the end of the link', () => {
    expect(
      shouldShowInternalLinkWidget(
        'livePreview',
        true,
        [{ from: 20, to: 20, empty: true }],
        5,
        20,
      ),
    ).toBe(true)
  })
})

describe('getInternalLinkEntityStatus', () => {
  it('returns pending when entity is not cached yet', () => {
    expect(getInternalLinkEntityStatus(undefined)).toBe('pending')
  })

  it('returns valid for existing entities', () => {
    expect(
      getInternalLinkEntityStatus({
        exists: true,
        data: {
          id: 1,
          name: 'Snippet',
          type: 'snippet',
          folder: null,
          isDeleted: 0,
        },
      }),
    ).toBe('valid')
  })

  it('returns broken for missing entities', () => {
    expect(getInternalLinkEntityStatus({ exists: false })).toBe('broken')
  })
})

it('does not send reserved planned titles to the real resolver', async () => {
  const { resolveInternalLinkByTitle } = await import('../decorations')
  await expect(
    resolveInternalLinkByTitle('masscode:planned:note'),
  ).resolves.toEqual({ exists: false })
})

it('rebuilds moved widget DOM offsets and acts on the chosen duplicate planned occurrence', async () => {
  const { EditorState } = await import('@codemirror/state')
  const { createInternalLinksDecorations } = await import('../decorations')
  const { createInternalLinksTrigger, getPlannedLinkActions } = await import(
    '../trigger'
  )
  const { findInternalLinks } = await import('../parser')
  const element = (): any => ({
    dataset: {},
    style: {},
    children: [],
    classList: { add() {} },
    setAttribute() {},
    append(child: any) {
      this.children.push(child)
    },
  })
  vi.stubGlobal('h', h)
  vi.stubGlobal('document', {
    createElement: element,
    createElementNS: element,
  })
  const raw = '[[masscode:planned:note|Same]]'
  let state = EditorState.create({ doc: `prefix ${raw} ${raw}` })
  let decorations: any
  let trigger: any
  const view: any = {
    get state() {
      return state
    },
    get visibleRanges() {
      return [{ from: 0, to: state.doc.length }]
    },
    hasFocus: false,
    dom: { inert: false },
    requestMeasure() {},
    focus() {},
    dispatch(spec: Parameters<typeof state.update>[0]) {
      const tr = state.update(spec)
      state = tr.state
      const update = {
        view,
        transactions: [tr],
        docChanged: tr.docChanged,
        selectionSet: false,
        changes: tr.changes,
      }
      trigger.update(update)
      decorations.update(update)
    },
  }
  try {
    const create = vi.fn()
    trigger = (
      createInternalLinksTrigger({
        mode: 'livePreview',
        editable: true,
        sourceIdentity: () => ({ id: 22, generation: 0 }),
        activatePlannedLink: create,
      })[0] as any
    ).create(view)
    decorations = (createInternalLinksDecorations('livePreview') as any).create(
      view,
    )
    function widgets() {
      const result: any[] = []
      decorations.decorations.between(
        0,
        state.doc.length,
        (_from: number, _to: number, value: any) => {
          result.push(value.spec.widget)
        },
      )
      return result
    }
    const before = widgets()
    const Widget = before[0].constructor
    for (const type of ['note', 'snippet', 'http-request'] as const) {
      const link = findInternalLinks(`[[${type}:9]]`)[0]!
      const oldWidget = new Widget(link, 'valid', {
        id: 9,
        type,
        name: 'some',
      })
      const renamedWidget = new Widget(link, 'valid', {
        id: 9,
        type,
        name: 'renamed',
      })
      expect(renamedWidget.eq(oldWidget)).toBe(false)
      expect(renamedWidget.toDOM().children[1].textContent).toBe('renamed')
      const custom = findInternalLinks(`[[${type}:9|Custom label]]`)[0]!
      expect(
        new Widget(custom, 'valid', { id: 9, type, name: 'renamed' }).toDOM()
          .children[1].textContent,
      ).toBe('Custom label')
    }
    const oldDom = before[1].toDOM().children[0]
    view.dispatch({ changes: { from: 0, insert: 'inserted ' } })
    const after = widgets()
    expect(after[0].eq(before[0])).toBe(false)
    expect(after[1].eq(before[1])).toBe(false)
    const container = after[1].toDOM()
    const currentDom = container.children[0]
    expect(currentDom.title).toBeUndefined()
    expect(container.tooltipText).toBe('internalLinks.planned.status')
    expect(Number(currentDom.dataset.internalLinkFrom)).toBe(
      Number(oldDom.dataset.internalLinkFrom) + 9,
    )
    const chosen = findInternalLinks(state.doc.toString()).find(
      link => link.from === Number(currentDom.dataset.internalLinkFrom),
    )!
    getPlannedLinkActions(view, chosen)!.create()
    create.mock.calls[0]![0].insert('[[note:9|Existing]]')
    expect(state.doc.toString()).toBe(
      `inserted prefix ${raw} [[note:9|Existing]]`,
    )
  }
  finally {
    trigger?.destroy()
    vi.unstubAllGlobals()
  }
})
