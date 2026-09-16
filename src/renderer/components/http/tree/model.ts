import type { DropTarget, HttpTreeNode, MoveResult, TreeRow } from './types'

function ancestorsFromMap(
  byId: Map<string, HttpTreeNode>,
  id: string,
): string[] {
  const result: string[] = []
  let parent = byId.get(id)?.parentId
  while (parent && !result.includes(parent)) {
    result.push(parent)
    parent = byId.get(parent)?.parentId
  }
  return result
}

export function ancestorIds(nodes: HttpTreeNode[], id: string): string[] {
  return ancestorsFromMap(new Map(nodes.map(node => [node.id, node])), id)
}

export function visibleRows(
  nodes: HttpTreeNode[],
  expanded: Set<string>,
  query = '',
): TreeRow[] {
  const search = query.trim().toLocaleLowerCase()
  const included = new Set<string>()
  if (search) {
    const byId = new Map(nodes.map(node => [node.id, node]))
    for (const node of nodes) {
      if (
        `${node.name} ${node.method ?? ''} ${node.url ?? ''}`
          .toLocaleLowerCase()
          .includes(search)
      ) {
        included.add(node.id)
        ancestorsFromMap(byId, node.id).forEach(id => included.add(id))
      }
    }
  }
  const children = new Map<string | null, HttpTreeNode[]>()
  for (const node of nodes) {
    if (!search || included.has(node.id)) {
      const siblings = children.get(node.parentId)
      if (siblings)
        siblings.push(node)
      else children.set(node.parentId, [node])
    }
  }
  const rows: TreeRow[] = []
  function walk(parentId: string | null, depth: number) {
    const siblings = children.get(parentId) ?? []
    siblings.forEach((node, index) => {
      rows.push({
        node,
        depth,
        position: index + 1,
        siblings: siblings.length,
      })
      if (search || expanded.has(node.id))
        walk(node.id, depth + 1)
    })
  }
  walk(null, 0)
  return rows
}

export function selectRange(
  rows: TreeRow[],
  anchor: string | undefined,
  target: string,
): string[] {
  const end = rows.findIndex(row => row.node.id === target)
  const start = rows.findIndex(row => row.node.id === anchor)
  if (end < 0)
    return []
  if (start < 0)
    return [target]
  return rows
    .slice(Math.min(start, end), Math.max(start, end) + 1)
    .map(row => row.node.id)
}

export function selectedRoots(
  nodes: HttpTreeNode[],
  ids: string[],
): HttpTreeNode[] {
  const selection = new Set(ids)
  const byId = new Map(nodes.map(node => [node.id, node]))
  return nodes.filter(
    node =>
      selection.has(node.id)
      && !ancestorsFromMap(byId, node.id).some(id => selection.has(id)),
  )
}

// Pure planning: the caller commits this result only after its own persistence guards.
export function planMove(
  nodes: HttpTreeNode[],
  ids: string[],
  target: DropTarget,
): MoveResult {
  const destination = nodes.find(node => node.id === target.id)
  const moving = selectedRoots(nodes, ids)
  if (
    !destination
    || !moving.length
    || ids.some(id => !nodes.some(node => node.id === id))
  ) {
    return { ok: false, error: 'invalid' }
  }
  if (target.position === 'inside' && destination.kind === 'request')
    return { ok: false, error: 'invalid' }
  const parentId
    = target.position === 'inside' ? destination.id : destination.parentId
  const movingIds = new Set(moving.map(node => node.id))
  if (
    movingIds.has(destination.id)
    || ancestorIds(nodes, destination.id).some(id => movingIds.has(id))
  ) {
    return { ok: false, error: 'cycle' }
  }
  if (
    moving.some(node =>
      node.kind === 'collection' ? parentId !== null : parentId === null,
    )
  ) {
    return { ok: false, error: 'collection' }
  }

  const names = new Set(
    nodes
      .filter(node => node.parentId === parentId && !movingIds.has(node.id))
      .map(node => node.name.trim().toLocaleLowerCase()),
  )
  for (const node of moving) {
    const name = node.name.trim().toLocaleLowerCase()
    if (names.has(name))
      return { ok: false, error: 'conflict' }
    names.add(name)
  }
  const result = nodes.filter(node => !movingIds.has(node.id))
  let index = result.findIndex(node => node.id === destination.id)
  if (target.position === 'after')
    index += 1
  if (target.position === 'inside') {
    const lastChild = result.findLastIndex(
      node => node.parentId === parentId,
    )
    index = lastChild < 0 ? index + 1 : lastChild + 1
  }
  result.splice(index, 0, ...moving.map(node => ({ ...node, parentId })))
  return { ok: true, nodes: result, parentId }
}

// Apply the desired prefix left to right: each backend PATCH shifts siblings.
// Writing final indices of only the selected nodes can otherwise interleave them.
export function folderOrderWrites(
  before: HttpTreeNode[],
  after: HttpTreeNode[],
  parentId: string | null,
) {
  const current = before
    .filter(node => node.kind !== 'request' && node.parentId === parentId)
    .map(node => node.id)
  const desired = after.filter(
    node => node.kind !== 'request' && node.parentId === parentId,
  )
  const writes: { node: HttpTreeNode, orderIndex: number }[] = []
  desired.forEach((node, orderIndex) => {
    if (current[orderIndex] === node.id)
      return
    const oldIndex = current.indexOf(node.id)
    if (oldIndex >= 0)
      current.splice(oldIndex, 1)
    current.splice(orderIndex, 0, node.id)
    writes.push({ node, orderIndex })
  })
  return writes
}
