import type { HttpTreeNode } from '../types'
import { describe, expect, it } from 'vitest'
import { reorderFolderSiblings } from '~/main/storage/providers/markdown/runtime/shared/folderIndex'
import {
  ancestorIds,
  folderOrderWrites,
  planMove,
  selectedRoots,
  selectRange,
  visibleRows,
} from '../model'
import { createFixtures } from './fixtures'

describe('hTTP tree navigation', () => {
  it('search reveals ancestors without changing expansion and matches URLs', () => {
    const expanded = new Set(['personal'])
    const rows = visibleRows(createFixtures(), expanded, '/accounts/123')
    expect(rows.map(row => row.node.id)).toEqual([
      'payments',
      'accounts',
      'admin',
      'archive',
    ])
    expect([...expanded]).toEqual(['personal'])
    expect(
      visibleRows(createFixtures(), expanded).some(
        row => row.node.id === 'archive',
      ),
    ).toBe(false)
  })

  it('selects only visible rows in either range direction', () => {
    const rows = visibleRows(createFixtures(), new Set(['payments']))
    expect(selectRange(rows, 'health', 'accounts')).toEqual([
      'accounts',
      'billing',
      'health',
    ])
    expect(selectRange(rows, 'missing', 'health')).toEqual(['health'])
  })

  it('does not move a selected descendant twice', () => {
    expect(
      selectedRoots(createFixtures(), ['accounts', 'admin', 'archive']).map(
        node => node.id,
      ),
    ).toEqual(['accounts'])
  })
})

describe('hTTP tree move planning', () => {
  it('moves folders across collections while preserving all identities and descendants', () => {
    const nodes = createFixtures()
    const before = structuredClone(nodes)
    const result = planMove(nodes, ['accounts', 'list'], {
      id: 'personal',
      position: 'inside',
    })
    expect(result.ok).toBe(true)
    if (!result.ok)
      return
    expect(result.nodes.find(node => node.id === 'accounts')?.parentId).toBe(
      'personal',
    )
    expect(ancestorIds(result.nodes, 'list')).toEqual(['accounts', 'personal'])
    expect(result.nodes.map(node => node.id).sort()).toEqual(
      nodes.map(node => node.id).sort(),
    )
    expect(nodes).toEqual(before)
  })

  it('rejects a folder moved into a descendant, including relative drops', () => {
    for (const position of ['inside', 'before', 'after'] as const) {
      expect(
        planMove(createFixtures(), ['accounts'], { id: 'admin', position }),
      ).toEqual({ ok: false, error: 'cycle' })
    }
  })

  it('rejects collection nesting and loose root requests', () => {
    expect(
      planMove(createFixtures(), ['payments'], {
        id: 'personal',
        position: 'inside',
      }),
    ).toEqual({ ok: false, error: 'collection' })
    expect(
      planMove(createFixtures(), ['list'], {
        id: 'personal',
        position: 'before',
      }),
    ).toEqual({ ok: false, error: 'collection' })
  })

  it('rejects request drop containers and stale selections', () => {
    expect(
      planMove(createFixtures(), ['list'], {
        id: 'profile',
        position: 'inside',
      }),
    ).toEqual({ ok: false, error: 'invalid' })
    expect(
      planMove(createFixtures(), ['gone'], {
        id: 'personal',
        position: 'inside',
      }),
    ).toEqual({ ok: false, error: 'invalid' })
  })

  it('rejects existing and within-selection name collisions atomically', () => {
    const nodes = createFixtures()
    expect(
      planMove(nodes, ['list'], { id: 'sandbox', position: 'inside' }),
    ).toEqual({ ok: false, error: 'conflict' })
    expect(
      planMove(nodes, ['list', 'conflict'], {
        id: 'empty',
        position: 'inside',
      }),
    ).toEqual({ ok: false, error: 'conflict' })
  })

  it('reorders requests before and after siblings with correct visible order', () => {
    const result = planMove(createFixtures(), ['create'], {
      id: 'list',
      position: 'before',
    })
    expect(result.ok).toBe(true)
    if (!result.ok)
      return
    expect(
      result.nodes
        .filter(node => node.parentId === 'accounts')
        .map(node => node.id),
    ).toEqual(['create', 'list', 'admin'])
    const after = planMove(result.nodes, ['create'], {
      id: 'admin',
      position: 'after',
    })
    if (!after.ok)
      throw new Error(after.error)
    expect(
      after.nodes
        .filter(node => node.parentId === 'accounts')
        .map(node => node.id),
    ).toEqual(['list', 'admin', 'create'])
  })

  it('reorders root collections and accepts an empty destination', () => {
    const result = planMove(createFixtures(), ['empty'], {
      id: 'payments',
      position: 'before',
    })
    if (!result.ok)
      throw new Error(result.error)
    expect(
      result.nodes
        .filter(node => node.parentId === null)
        .map(node => node.id),
    ).toEqual(['empty', 'payments', 'personal'])
    const moved = planMove(result.nodes, ['health', 'profile'], {
      id: 'empty',
      position: 'inside',
    })
    if (!moved.ok)
      throw new Error(moved.error)
    expect(
      moved.nodes
        .filter(node => node.parentId === 'empty')
        .map(node => node.id),
    ).toEqual(['health', 'profile'])
  })
})

describe('hTTP folder order persistence', () => {
  it('applies a multi-folder downward move using the actual backend sibling shifting rules', () => {
    const nodes = ['A', 'B', 'C', 'D'].map((name, index) => ({
      id: name,
      entityId: index + 1,
      parentId: null,
      kind: 'collection' as const,
      name,
    }))
    const result = planMove(nodes, ['A', 'B'], { id: 'D', position: 'after' })
    if (!result.ok)
      throw new Error(result.error)
    const records = nodes.map((node, orderIndex) => ({
      id: node.entityId,
      name: node.name,
      parentId: null,
      orderIndex,
    }))
    for (const { node, orderIndex } of folderOrderWrites(
      nodes,
      result.nodes,
      null,
    )) {
      const record = records.find(item => item.id === node.entityId)!
      reorderFolderSiblings(
        records,
        record.id,
        record.parentId,
        record.orderIndex,
        null,
        orderIndex,
      )
      record.orderIndex = orderIndex
    }
    expect(
      records
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map(node => node.name),
    ).toEqual(['C', 'D', 'A', 'B'])
  })
})

describe('tree row construction', () => {
  it('keeps ancestor closure, sibling order and row metadata while filtering', () => {
    const nodes: HttpTreeNode[] = [
      { id: 'root', parentId: null, kind: 'collection', name: 'Root' },
      { id: 'second', parentId: 'root', kind: 'request', name: 'Match second' },
      { id: 'folder', parentId: 'root', kind: 'folder', name: 'Nested' },
      { id: 'hidden', parentId: 'root', kind: 'request', name: 'Hidden' },
      { id: 'child', parentId: 'folder', kind: 'request', name: 'Match child' },
      { id: 'last', parentId: 'root', kind: 'request', name: 'Match last' },
    ]
    const before = structuredClone(nodes)
    const expanded = new Set<string>()
    expect(
      visibleRows(nodes, expanded, 'match').map(({ node, ...row }) => ({
        id: node.id,
        ...row,
      })),
    ).toEqual([
      { id: 'root', depth: 0, position: 1, siblings: 1 },
      { id: 'second', depth: 1, position: 1, siblings: 3 },
      { id: 'folder', depth: 1, position: 2, siblings: 3 },
      { id: 'child', depth: 2, position: 1, siblings: 1 },
      { id: 'last', depth: 1, position: 3, siblings: 3 },
    ])
    expect(nodes).toEqual(before)
    expect(expanded.size).toBe(0)
    expect(visibleRows(nodes, expanded).map(row => row.node.id)).toEqual([
      'root',
    ])
    expect(visibleRows(nodes, expanded, 'missing')).toEqual([])
  })

  it('terminates ancestor lookup for cycles and leaves disconnected rows hidden', () => {
    const nodes: HttpTreeNode[] = [
      { id: 'a', parentId: 'b', kind: 'folder', name: 'Cycle A' },
      { id: 'b', parentId: 'a', kind: 'folder', name: 'Cycle B' },
      { id: 'self', parentId: 'self', kind: 'folder', name: 'Cycle self' },
    ]
    expect(ancestorIds(nodes, 'a')).toEqual(['b', 'a'])
    expect(ancestorIds(nodes, 'self')).toEqual(['self'])
    expect(ancestorIds(nodes, 'missing')).toEqual([])
    expect(visibleRows(nodes, new Set(), 'cycle')).toEqual([])
    expect(selectedRoots(nodes, ['a', 'b'])).toEqual([])
  })

  it('preserves all 10000 matching siblings and their positions', () => {
    const requests: HttpTreeNode[] = Array.from(
      { length: 10000 },
      (_, index) => ({
        id: `request-${index}`,
        parentId: 'root',
        kind: 'request',
        name: `Request ${index}`,
        method: 'GET',
        url: `/items/${index}`,
      }),
    )
    const nodes: HttpTreeNode[] = [
      { id: 'root', parentId: null, kind: 'collection', name: 'Collection' },
      ...requests,
    ]
    const rows = visibleRows(nodes, new Set(), 'request')
    expect(rows).toHaveLength(10001)
    expect(
      rows
        .slice(1)
        .every(
          (row, index) =>
            row.node === requests[index]
            && row.position === index + 1
            && row.siblings === 10000
            && row.depth === 1,
        ),
    ).toBe(true)
    expect(
      selectedRoots(
        nodes,
        nodes.map(node => node.id),
      ),
    ).toEqual([nodes[0]])
  })
})
