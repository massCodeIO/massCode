import type { Ref } from 'vue'

export function useActiveRowReveal(
  activeId: Readonly<Ref<string | number | undefined>>,
  rows: Readonly<Ref<{ node: { id: string | number } }[]>>,
  tree: Ref<{ scrollToId: (id: string | number) => void } | undefined>,
) {
  let pendingId: string | number | undefined

  watch(
    [
      activeId,
      tree,
      () => rows.value.some(row => row.node.id === activeId.value),
    ],
    ([id, target, available], [previousId, previousTarget]) => {
      // Navigation may precede loading or expansion of the selected row.
      // Once revealed, data refreshes must leave the user's scroll alone.
      if (id !== previousId || target !== previousTarget)
        pendingId = id
      if (pendingId !== undefined && target && available) {
        target.scrollToId(pendingId)
        pendingId = undefined
      }
    },
    { immediate: true, flush: 'post' },
  )
}
