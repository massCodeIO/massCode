import type { TreeNode as TreeNodeType } from '@/components/ui/tree/types'
import { useHttpFolders } from './useHttpFolders'
import { useHttpRequests } from './useHttpRequests'

type Position = 'after' | 'before' | 'center'

export function useHttpFolderDragDrop() {
  const { folders, updateHttpFolder, getFolderByIdFromTree } = useHttpFolders()
  const { requests, updateHttpRequest, getHttpRequests } = useHttpRequests()

  async function onDragNode({
    nodes,
    target,
    position,
  }: {
    nodes: TreeNodeType[]
    target: TreeNodeType
    position: Position
  }) {
    try {
      const folderNodes = nodes
        .map(n => getFolderByIdFromTree(folders.value, Number(n.id)))
        .filter((n): n is NonNullable<typeof n> => Boolean(n))
      const folderTarget = getFolderByIdFromTree(
        folders.value,
        Number(target.id),
      )

      if (!folderNodes.length || !folderTarget)
        return

      const movableNodes = folderNodes.filter(
        node => node.id !== folderTarget.id,
      )

      if (!movableNodes.length)
        return

      if (position === 'center') {
        const destinationParentId = Number(target.id)
        let orderIndex = folderTarget.children?.length || 0

        for (const node of movableNodes) {
          await updateHttpFolder(node.id, {
            parentId: destinationParentId,
            orderIndex,
          })
          orderIndex += 1
        }

        return
      }

      for (const node of movableNodes) {
        const isDraggingUp = node.orderIndex > folderTarget.orderIndex
        const newParentId: number | null = folderTarget.parentId || null
        let newOrderIndex: number

        if (node.parentId === folderTarget.parentId) {
          if (position === 'after') {
            newOrderIndex = isDraggingUp
              ? folderTarget.orderIndex + 1
              : folderTarget.orderIndex
          }
          else {
            newOrderIndex = isDraggingUp
              ? folderTarget.orderIndex
              : Math.max(folderTarget.orderIndex - 1, 0)
          }
        }
        else {
          newOrderIndex
            = position === 'after'
              ? folderTarget.orderIndex + 1
              : folderTarget.orderIndex
        }

        await updateHttpFolder(node.id, {
          parentId: newParentId,
          orderIndex: newOrderIndex,
        })
      }
    }
    catch (error) {
      console.error('HTTP folder drag error:', error)
    }
  }

  async function onExternalDrop({
    data,
    target,
  }: {
    data: DataTransfer
    target: TreeNodeType
    position: Position
  }) {
    const requestIds = JSON.parse(
      data.getData('requestIds') || '[]',
    ) as number[]
    if (!requestIds.length)
      return

    const folderId = Number(target.id)
    const matched = requests.value.filter(r => requestIds.includes(r.id))

    if (!matched.length)
      return

    if (matched.every(r => r.folderId === folderId))
      return

    for (const request of matched) {
      await updateHttpRequest(request.id, { folderId })
    }

    await getHttpRequests()
  }

  return {
    onDragNode,
    onExternalDrop,
  }
}
