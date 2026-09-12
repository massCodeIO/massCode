import { history, undo } from '@codemirror/commands'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { createOutlineMove, getActiveHeading, getOutline } from '../outline'

describe('note outline', () => {
  it('parses real sections, skips code and quoted or list headings, and tracks hierarchy', () => {
    const content
      = 'Intro\n\n# Root\n\n### Child\ntext\n\n## Next\n\n```md\n# Code\n```\n\n> # Quote\n\n- # List\n\nSetext\n======\n'
    const headings = getOutline(content)
    expect(headings.map(h => [h.title, h.level, h.depth])).toEqual([
      ['Root', 1, 0],
      ['Child', 3, 1],
      ['Next', 2, 1],
      ['Setext', 1, 0],
    ])
    expect(headings[1]!.end).toBe(headings[2]!.from)
    expect(headings[0]!.end).toBe(headings[3]!.from)
    expect(getActiveHeading(headings, 0)).toBeUndefined()
    expect(getActiveHeading(headings, content.indexOf('text'))).toBe(
      headings[1]!.from,
    )
  })

  it('moves a section and its descendants with one undo step', () => {
    const content
      = 'Preamble\n\n# Root\n\n## A\nA body\n\n### Child\nchild body\n\n## B\nB body\n'
    const [root, a, , b] = getOutline(content)
    const move = createOutlineMove(content, {
      content,
      from: a!.from,
      target: b!.from,
      after: true,
    })!
    let state = EditorState.create({ doc: content, extensions: [history()] })
    state = state.update(move).state
    expect(state.doc.toString()).toBe(
      'Preamble\n\n# Root\n\n## B\nB body\n\n## A\nA body\n\n### Child\nchild body\n\n',
    )
    expect(getOutline(state.doc.toString()).map(h => h.title)).toEqual([
      'Root',
      'B',
      'A',
      'Child',
    ])
    expect(state.selection.main.head).toBe(
      state.doc.toString().indexOf('## A'),
    )
    expect(
      undo({
        state,
        dispatch: (tr) => {
          state = tr.state
        },
      }),
    ).toBe(true)
    expect(state.doc.toString()).toBe(content)
    expect(
      createOutlineMove(content, {
        content,
        from: root!.from,
        target: a!.from,
        after: true,
      }),
    ).toBeNull()
  })

  it('separates a final section without a trailing newline when moving it up', () => {
    const content = '# A\nbody\n\n# B\nlast'
    const [a, b] = getOutline(content)
    const move = createOutlineMove(content, {
      content,
      from: b!.from,
      target: a!.from,
      after: false,
    })!
    const result = EditorState.create({ doc: content })
      .update(move)
      .state
      .doc
      .toString()
    expect(result).toBe('# B\nlast\n\n# A\nbody\n\n')
  })

  it('rejects stale drags, descendants and no-op moves', () => {
    const content = '# A\n## Child A\n# B\n## Child B\n'
    const [a, ca, b] = getOutline(content)
    expect(
      createOutlineMove(content, {
        content: 'stale',
        from: a!.from,
        target: b!.from,
        after: true,
      }),
    ).toBeNull()
    expect(
      createOutlineMove(content, {
        content,
        from: a!.from,
        target: ca!.from,
        after: true,
      }),
    ).toBeNull()
    expect(
      createOutlineMove(content, {
        content,
        from: a!.from,
        target: b!.from,
        after: false,
      }),
    ).toBeNull()
  })
  it('nests across parents, shifts descendants and restores exact Markdown on undo', () => {
    const content = '# A\n\n## Child\ntext\n\n# B\nbody'
    const [a, , b] = getOutline(content)
    const spec = createOutlineMove(content, {
      content,
      from: a!.from,
      target: b!.from,
      after: false,
      inside: true,
    })!
    let state = EditorState.create({
      doc: content,
      extensions: [history()],
    }).update(spec).state
    expect(
      getOutline(state.doc.toString()).map(h => [h.title, h.level]),
    ).toEqual([
      ['B', 1],
      ['A', 2],
      ['Child', 3],
    ])
    expect(state.doc.toString()).toContain('body\n\n## A')
    undo({
      state,
      dispatch: (tr) => {
        state = tr.state
      },
    })
    expect(state.doc.toString()).toBe(content)
  })

  it('promotes a child after its parent and retains its subtree', () => {
    const content = '# A\nbody\n\n## Child\ntext\n\n### Nested\nend'
    const [a, child] = getOutline(content)
    const spec = createOutlineMove(content, {
      content,
      from: child!.from,
      target: a!.from,
      after: true,
    })!
    const result = EditorState.create({ doc: content })
      .update(spec)
      .state
      .doc
      .toString()
    expect(getOutline(result).map(h => [h.title, h.level])).toEqual([
      ['A', 1],
      ['Child', 1],
      ['Nested', 2],
    ])
  })

  it('moves between unrelated parents and converts Setext when changing levels', () => {
    const content = '# A\n\nChild\n-----\ntext\n\n# B\n\n## Target\nbody'
    const [, child, , target] = getOutline(content)
    const spec = createOutlineMove(content, {
      content,
      from: child!.from,
      target: target!.from,
      after: false,
      inside: true,
    })!
    const result = EditorState.create({ doc: content })
      .update(spec)
      .state
      .doc
      .toString()
    expect(getOutline(result).map(h => [h.title, h.level])).toEqual([
      ['A', 1],
      ['B', 1],
      ['Target', 2],
      ['Child', 3],
    ])
    expect(result).toContain('### Child\ntext')
  })

  it('does not flatten descendants beyond the Markdown H6 limit', () => {
    const content = '# A\n## Child\n\n##### B\n'
    const [a, , b] = getOutline(content)
    // B belongs to A, so also exercises rejection of dropping onto a descendant.
    expect(
      createOutlineMove(content, {
        content,
        from: a!.from,
        target: b!.from,
        after: false,
        inside: true,
      }),
    ).toBeNull()
    const other = '# A\n## Child\n# Root B\n##### B\n'
    const [source, , , target] = getOutline(other)
    expect(
      createOutlineMove(other, {
        content: other,
        from: source!.from,
        target: target!.from,
        after: false,
        inside: true,
      }),
    ).toBeNull()
  })
})
