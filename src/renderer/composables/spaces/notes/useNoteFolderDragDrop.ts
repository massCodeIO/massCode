import type { TreeNode as TreeNodeType } from '@/components/ui/tree/types'
import { useNoteFolders } from './useNoteFolders'
import { useNotes } from './useNotes'
import { useNoteSearch } from './useNoteSearch'

type Position = 'after' | 'before' | 'center'

export function useNoteFolderDragDrop() {
  const { folders, updateNoteFolder, getFolderByIdFromTree } = useNoteFolders()
  const { getNotes, selectFirstNote, updateNote } = useNotes()
  const { displayedNotes } = useNoteSearch()

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
          await updateNoteFolder(node.id, {
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

        await updateNoteFolder(node.id, {
          parentId: newParentId,
          orderIndex: newOrderIndex,
        })
      }
    }
    catch (error) {
      console.error('Note folder drag error:', error)
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
    const noteIds = JSON.parse(data.getData('noteIds') || '[]') as number[]
    const matchedNotes = displayedNotes.value?.filter(n =>
      noteIds.includes(n.id),
    )

    if (!matchedNotes?.length)
      return

    const folderId = Number(target.id)

    if (matchedNotes.every(n => n.folder?.id === folderId && !n.isDeleted))
      return

    for (const note of matchedNotes) {
      await updateNote(note.id, { folderId, isDeleted: 0 })
    }

    await getNotes()
    selectFirstNote()
  }

  return {
    onDragNode,
    onExternalDrop,
  }
}
