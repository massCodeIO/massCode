import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'

Object.assign(globalThis as Record<string, unknown>, {
  ref,
  computed,
  nextTick,
})

describe('useJsonDiff', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('shows empty state when only one side is filled and valid', async () => {
    const { useJsonDiff } = await import('../useJsonDiff')
    const diff = useJsonDiff()

    diff.leftText.value = '{ "name": "Alice" }'

    expect(diff.isReady.value).toBe(false)
    expect(diff.showEmptyState.value).toBe(true)
    expect(diff.leftError.value).toBe('')
    expect(diff.rightError.value).toBe('')
  })

  it('formats pasted JSON on the next tick instead of immediately', async () => {
    const { useJsonDiff } = await import('../useJsonDiff')
    const diff = useJsonDiff()

    diff.leftText.value = '{"name":"Alice"}'
    diff.scheduleLeftFormat()

    expect(diff.leftText.value).toBe('{"name":"Alice"}')

    await nextTick()

    expect(diff.leftText.value).toBe(`{\n  "name": "Alice"\n}`)
  })

  it('clears invalid error and becomes ready again after JSON is fixed', async () => {
    const { useJsonDiff } = await import('../useJsonDiff')
    const diff = useJsonDiff()

    diff.leftText.value = '{"name":'
    diff.rightText.value = '{"name":"Bob"}'

    expect(diff.leftError.value).toBe('invalidJson')
    expect(diff.isReady.value).toBe(false)

    diff.leftText.value = '{"name":"Alice"}'

    expect(diff.leftError.value).toBe('')
    expect(diff.isReady.value).toBe(true)
    expect(diff.viewerError.value).toBe('')
  })

  it('keeps unchanged ancestors visible when filtering nested modified nodes', async () => {
    const { useJsonDiff } = await import('../useJsonDiff')
    const diff = useJsonDiff()

    diff.leftText.value = '{"user":{"profile":{"name":"Alice","age":30}}}'
    diff.rightText.value = '{"user":{"profile":{"name":"Bob","age":30}}}'
    diff.filters.value.modified = true

    const userNode = diff.nodes.value[0]
    const profileNode = userNode.children?.[0]
    const nameNode = profileNode?.children?.[0]

    expect(userNode.path).toBe('user')
    expect(profileNode?.path).toBe('user.profile')
    expect(nameNode?.path).toBe('user.profile.name')
    expect(nameNode?.changeType).toBe('modified')
  })

  it('hides unrelated change types when a filter is active', async () => {
    const { useJsonDiff } = await import('../useJsonDiff')
    const diff = useJsonDiff()

    diff.leftText.value = '{"name":"Alice"}'
    diff.rightText.value = '{"name":"Bob","email":"bob@test.com"}'
    diff.filters.value.added = true

    expect(diff.nodes.value).toHaveLength(1)
    expect(diff.nodes.value[0]?.path).toBe('email')
    expect(diff.nodes.value[0]?.changeType).toBe('added')
  })

  it('shares expansion state across both columns and auto-expands filtered ancestors', async () => {
    const { useJsonDiff } = await import('../useJsonDiff')
    const diff = useJsonDiff()

    diff.leftText.value = '{"user":{"profile":{"name":"Alice"}}}'
    diff.rightText.value = '{"user":{"profile":{"name":"Bob"}}}'
    diff.filters.value.modified = true

    const userNode = diff.nodes.value[0]
    const profileNode = userNode.children?.[0]

    expect(diff.isExpanded(userNode, 0)).toBe(true)
    expect(diff.isExpanded(profileNode!, 1)).toBe(true)

    diff.filters.value.modified = false

    const unfilteredUserNode = diff.nodes.value[0]
    const unfilteredProfileNode = unfilteredUserNode.children?.[0]

    expect(diff.isExpanded(unfilteredUserNode, 0)).toBe(true)
    expect(diff.isExpanded(unfilteredProfileNode!, 1)).toBe(false)

    diff.toggleExpanded(unfilteredProfileNode!.path)

    expect(diff.isExpanded(unfilteredProfileNode!, 1)).toBe(true)
  })
})
