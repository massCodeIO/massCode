import type {
  HttpFoldersResponse,
  HttpFoldersTreeResponse,
  HttpFoldersUpdate,
} from '@/services/api/generated'
import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { i18n } from '@/electron'
import { api } from '@/services/api'
import { useHttpApp } from './useHttpApp'

export type HttpFolderItem = HttpFoldersResponse[number]
export type HttpFolderTreeItem = HttpFoldersTreeResponse[number]

const folders = shallowRef<HttpFoldersResponse>([])
const folderTree = shallowRef<HttpFoldersTreeResponse>([])

const renameFolderId = ref<number | null>(null)

const { httpState } = useHttpApp()

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getNextIndexedName(baseName: string, existingNames: string[]): string {
  const normalizedBase = baseName.trim()
  const indexedNameRe = new RegExp(
    `^${escapeRegExp(normalizedBase)}(?:\\s+(\\d+))?$`,
    'i',
  )

  let maxIndex = 0
  existingNames.forEach((name) => {
    const match = name.trim().match(indexedNameRe)
    if (!match)
      return
    const index = match[1] ? Number(match[1]) : 0
    if (Number.isFinite(index)) {
      maxIndex = Math.max(maxIndex, index)
    }
  })
  return `${normalizedBase} ${maxIndex + 1}`
}

function getNextUntitledFolderName(parentId: number | null): string {
  const siblingNames = folders.value
    .filter(folder => (folder.parentId ?? null) === parentId)
    .map(folder => folder.name)

  return getNextIndexedName(i18n.t('folder.untitled'), siblingNames)
}

async function getHttpFolders() {
  try {
    const [list, tree] = await Promise.all([
      api.httpFolders.getHttpFolders(),
      api.httpFolders.getHttpFoldersTree(),
    ])
    folders.value = list.data
    folderTree.value = tree.data
  }
  catch (error) {
    console.error(error)
  }
}

async function createHttpFolder(parentId?: number) {
  try {
    const name = getNextUntitledFolderName(parentId ?? null)
    markPersistedStorageMutation()
    const { data } = await api.httpFolders.postHttpFolders({
      name,
      ...(parentId !== undefined && { parentId }),
    })

    if (parentId) {
      await updateHttpFolder(parentId, { isOpen: 1 })
    }

    await getHttpFolders()

    return Number(data.id)
  }
  catch (error) {
    console.error(error)
  }
}

async function createHttpFolderAndSelect(parentId?: number) {
  const id = await createHttpFolder(parentId)
  if (id) {
    httpState.folderId = id
    renameFolderId.value = id
  }
}

async function updateHttpFolder(folderId: number, data: HttpFoldersUpdate) {
  try {
    markPersistedStorageMutation()
    await api.httpFolders.patchHttpFoldersById(String(folderId), data)
    await getHttpFolders()
  }
  catch (error) {
    console.error(error)
  }
}

async function deleteHttpFolder(folderId: number) {
  try {
    markPersistedStorageMutation()
    await api.httpFolders.deleteHttpFoldersById(String(folderId))
    if (httpState.folderId === folderId) {
      httpState.folderId = undefined
    }
    await getHttpFolders()
  }
  catch (error) {
    console.error(error)
  }
}

function selectHttpFolder(folderId: number | undefined) {
  httpState.folderId = folderId
}

function resetHttpFoldersState() {
  folders.value = []
  folderTree.value = []
  renameFolderId.value = null
  httpState.folderId = undefined
}

export function useHttpFolders() {
  return {
    createHttpFolder,
    createHttpFolderAndSelect,
    deleteHttpFolder,
    folderTree,
    folders,
    getHttpFolders,
    renameFolderId,
    resetHttpFoldersState,
    selectHttpFolder,
    updateHttpFolder,
  }
}
