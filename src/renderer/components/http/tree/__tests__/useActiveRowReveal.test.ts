import type { TreeRow } from '../types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, watch } from 'vue'
import { useActiveRowReveal } from '../useActiveRowReveal'

Object.assign(globalThis, { watch })
const cleanup: Array<() => void> = []
afterEach(() => cleanup.splice(0).forEach(dispose => dispose()))

function row(id: string): TreeRow {
  return {
    node: { id, name: id, kind: 'request', parentId: null },
    depth: 0,
    position: 1,
    siblings: 1,
  }
}

function setup() {
  const activeId = ref<string>()
  const rows = ref<TreeRow[]>([])
  const scrollToId = vi.fn()
  const tree = ref<{ scrollToId: typeof scrollToId }>()
  const scope = effectScope()
  scope.run(() => useActiveRowReveal(activeId, rows, tree))
  cleanup.push(() => scope.stop())
  return { activeId, rows, tree, scrollToId }
}

describe('hTTP active row reveal', () => {
  it('preserves manual scroll through move, rename and background refresh', async () => {
    const state = setup()
    let scrollTop = 0
    state.scrollToId.mockImplementation(() => {
      scrollTop = 0
    })
    state.activeId.value = 'first'
    state.rows.value = [row('first'), row('last')]
    state.tree.value = { scrollToId: state.scrollToId }
    await nextTick()
    expect(state.scrollToId).toHaveBeenCalledExactlyOnceWith('first')

    scrollTop = 200000
    state.rows.value = [row('last'), row('first')]
    await nextTick()
    state.rows.value = state.rows.value.map(item => ({
      ...item,
      node: { ...item.node, name: `${item.node.name} renamed` },
    }))
    await nextTick()
    state.rows.value = state.rows.value.map(item => ({ ...item }))
    await nextTick()
    expect(scrollTop).toBe(200000)
    expect(state.scrollToId).toHaveBeenCalledTimes(1)
  })

  it('does not reveal the same selection again after filtering or collapse', async () => {
    const { activeId, rows, tree, scrollToId } = setup()
    activeId.value = 'selected'
    tree.value = { scrollToId }
    rows.value = [row('selected')]
    await nextTick()
    rows.value = []
    await nextTick()
    rows.value = [row('selected')]
    await nextTick()
    expect(scrollToId).toHaveBeenCalledExactlyOnceWith('selected')
  })

  it('waits for initial data, tree mount and expansion then reveals only once', async () => {
    const { activeId, rows, tree, scrollToId } = setup()
    activeId.value = 'restored'
    await nextTick()
    tree.value = { scrollToId }
    await nextTick()
    rows.value = [row('other')]
    await nextTick()
    expect(scrollToId).not.toHaveBeenCalled()
    rows.value = [row('other'), row('restored')]
    await nextTick()
    expect(scrollToId).toHaveBeenCalledExactlyOnceWith('restored')
    rows.value = [...rows.value]
    await nextTick()
    expect(scrollToId).toHaveBeenCalledTimes(1)
  })

  it('reveals new navigation but discards a superseded pending selection', async () => {
    const { activeId, rows, tree, scrollToId } = setup()
    tree.value = { scrollToId }
    activeId.value = 'loading'
    await nextTick()
    activeId.value = 'new'
    rows.value = [row('new')]
    await nextTick()
    rows.value = [row('loading'), row('new')]
    await nextTick()
    expect(scrollToId).toHaveBeenCalledExactlyOnceWith('new')
    activeId.value = 'loading'
    await nextTick()
    expect(scrollToId).toHaveBeenLastCalledWith('loading')
    expect(scrollToId).toHaveBeenCalledTimes(2)
  })

  it('cancels a pending reveal when navigation clears the selection', async () => {
    const { activeId, rows, tree, scrollToId } = setup()
    tree.value = { scrollToId }
    activeId.value = 'pending'
    await nextTick()
    activeId.value = undefined
    await nextTick()
    rows.value = [row('pending')]
    await nextTick()
    expect(scrollToId).not.toHaveBeenCalled()
  })
})
