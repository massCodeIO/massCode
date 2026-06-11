import { useDialog } from '@/composables/useDialog'
import { useDonations } from '@/composables/useDonations'
import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { i18n } from '@/electron'
import { getContiguousSelection } from '@/utils'
import { api } from '~/renderer/services/api'
import { LibraryFilter } from '../../types'
import { NoteTaskStatus } from './taskProperties'
import { useNoteContent } from './useNoteContent'
import { useNotesApp } from './useNotesApp'
import { isSearch, notesBySearch, searchQuery } from './useNoteSearch'

const { notesState, focusNoteNameInput, notesCreateKind } = useNotesApp()

// --- Types ---
// These mirror the generated API types that will exist after api:generate.

interface NoteTagInfo {
  id: number
  name: string
}

interface NoteFolderInfo {
  id: number
  name: string
}

interface NoteRecord {
  id: number
  name: string
  description: string | null
  properties: Record<string, unknown>
  tags: NoteTagInfo[]
  folder: NoteFolderInfo | null
  isFavorites: number
  isDeleted: number
  createdAt: number
  updatedAt: number
}

// Полная запись заметки (GET /notes/:id): список контент не содержит.
export interface NoteFullRecord extends NoteRecord {
  content: string
}

// Выбранная заметка: пока полная запись загружается, метаданные берутся из
// списка и content временно отсутствует.
export type SelectedNoteView = NoteRecord & { content?: string }

type NotesResponse = NoteRecord[]

interface NotesQuery {
  search?: string
  sort?: string
  order?: 'ASC' | 'DESC'
  folderId?: number
  tagId?: number
  isFavorites?: number
  isDeleted?: number
  isInbox?: number
  propertyDue?: 'today' | 'upcoming'
  propertyStatus?: string
  propertyStatusNot?: string
  propertyType?: string
}

interface NotesUpdate {
  name?: string
  folderId?: number | null
  description?: string | null
  isDeleted?: number
  isFavorites?: number
}

interface NotePropertiesUpdate {
  properties?: Record<string, unknown>
  unset?: string[]
}

interface CreateNotePayload {
  name?: string
  properties?: Record<string, unknown>
}

// --- Module-level state ---

export const selectedNoteIds = ref<number[]>(
  notesState.noteId ? [notesState.noteId] : [],
)
const lastSelectedNoteId = ref<number | undefined>()

export const notes = shallowRef<NotesResponse>()

// Список отдаёт только метаданные, поэтому полная запись выбранной заметки
// (с контентом) загружается отдельно по id.
export const selectedNoteRecord = shallowRef<NoteFullRecord | undefined>()
let selectedNoteRequestToken = 0
let notesRequestToken = 0

export const isRestoreStateBlocked = ref(false)
const notesLoadingCounter = ref(0)
const isNotesLoadingVisible = ref(false)
const NOTES_LOADING_VISIBILITY_DELAY_MS = 300
let notesLoadingVisibilityTimer: ReturnType<typeof setTimeout> | undefined

// --- Computed ---

const selectedNote = computed<SelectedNoteView | undefined>(() => {
  if (selectedNoteRecord.value?.id === notesState.noteId) {
    return selectedNoteRecord.value
  }

  // Пока полная запись загружается, метаданные берутся из списка,
  // чтобы заголовок и layout не мигали.
  const source = isSearch.value ? notesBySearch.value : notes.value
  return source?.find(n => n.id === notesState.noteId)
})

const selectedNotes = computed(() => {
  const source = isSearch.value ? notesBySearch.value : notes.value
  if (!source?.length || !selectedNoteIds.value.length) {
    return []
  }

  const targetIds = new Set(selectedNoteIds.value)
  return source.filter(n => targetIds.has(n.id))
})

export async function refreshSelectedNote() {
  const noteId = notesState.noteId
  const requestToken = ++selectedNoteRequestToken

  if (noteId === undefined) {
    selectedNoteRecord.value = undefined
    return
  }

  try {
    const { data } = await api.notes.getNotesById(String(noteId))

    if (requestToken === selectedNoteRequestToken) {
      selectedNoteRecord.value = data as NoteFullRecord
    }
  }
  catch (error) {
    if (requestToken === selectedNoteRequestToken) {
      selectedNoteRecord.value = undefined
    }
    console.error(error)
  }
}

watch(
  () => notesState.noteId,
  () => {
    void refreshSelectedNote()
  },
)

function getActionTargetIds(fallbackNoteId?: number) {
  if (fallbackNoteId !== undefined && selectedNoteIds.value.length > 1) {
    return [...selectedNoteIds.value]
  }

  if (fallbackNoteId !== undefined) {
    return [fallbackNoteId]
  }

  if (selectedNoteIds.value.length) {
    return [...selectedNoteIds.value]
  }

  return notesState.noteId !== undefined ? [notesState.noteId] : []
}

function getActionTargetNotes(targetIds: number[], fallbackNote?: NoteRecord) {
  const source = isSearch.value ? notesBySearch.value : notes.value
  const targetIdSet = new Set(targetIds)
  const targetNotes = source?.filter(note => targetIdSet.has(note.id)) || []

  if (
    fallbackNote
    && targetIds.includes(fallbackNote.id)
    && !targetNotes.some(note => note.id === fallbackNote.id)
  ) {
    targetNotes.push(fallbackNote)
  }

  return targetNotes
}

const queryByLibraryOrFolderOrSearch = computed(() => {
  const query: NotesQuery = {}

  if (isSearch.value && searchQuery.value) {
    query.search = searchQuery.value
  }

  if (notesState.tagId) {
    query.tagId = notesState.tagId
    return query
  }

  if (notesState.folderId) {
    query.folderId = notesState.folderId
  }
  else if (notesState.libraryFilter === LibraryFilter.Favorites) {
    query.isFavorites = 1
  }
  else if (notesState.libraryFilter === LibraryFilter.Trash) {
    query.isDeleted = 1
  }
  else if (notesState.libraryFilter === LibraryFilter.All) {
    query.isDeleted = 0
  }
  else if (notesState.libraryFilter === LibraryFilter.Inbox) {
    query.isInbox = 1
  }
  else if (notesState.libraryFilter === LibraryFilter.Tasks) {
    query.propertyType = 'task'
  }
  else if (notesState.libraryFilter === LibraryFilter.Today) {
    query.propertyDue = 'today'
    query.propertyStatusNot = 'done'
    query.propertyType = 'task'
  }
  else if (notesState.libraryFilter === LibraryFilter.Upcoming) {
    query.propertyDue = 'upcoming'
    query.propertyStatusNot = 'done'
    query.propertyType = 'task'
  }
  else if (notesState.libraryFilter === LibraryFilter.Completed) {
    query.propertyStatus = 'done'
    query.propertyType = 'task'
  }

  return query
})

const isEmpty = computed(() => {
  if (isSearch.value) {
    return notesBySearch.value?.length === 0
  }

  return notes.value?.length === 0
})

const isNotesLoading = computed(() => notesLoadingCounter.value > 0)

function clearNotesLoadingVisibilityTimer() {
  if (!notesLoadingVisibilityTimer) {
    return
  }

  clearTimeout(notesLoadingVisibilityTimer)
  notesLoadingVisibilityTimer = undefined
}

watch(
  isNotesLoading,
  (loading) => {
    if (loading) {
      if (isNotesLoadingVisible.value || notesLoadingVisibilityTimer) {
        return
      }

      notesLoadingVisibilityTimer = setTimeout(() => {
        notesLoadingVisibilityTimer = undefined

        if (notesLoadingCounter.value > 0) {
          isNotesLoadingVisible.value = true
        }
      }, NOTES_LOADING_VISIBILITY_DELAY_MS)

      return
    }

    clearNotesLoadingVisibilityTimer()
    isNotesLoadingVisible.value = false
  },
  { immediate: true },
)

// --- Utility ---

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
    if (!match) {
      return
    }

    const index = match[1] ? Number(match[1]) : 0
    if (Number.isFinite(index)) {
      maxIndex = Math.max(maxIndex, index)
    }
  })

  return `${normalizedBase} ${maxIndex + 1}`
}

function hasDisplayedNote(noteId: number): boolean {
  const source = isSearch.value ? notesBySearch.value : notes.value
  return source?.some(note => note.id === noteId) ?? false
}

function selectFirstNoteIfCurrentSelectionIsMissing(previousNoteId?: number) {
  if (
    previousNoteId !== undefined
    && notesState.noteId === previousNoteId
    && !hasDisplayedNote(previousNoteId)
  ) {
    selectFirstNote()
  }
}

function isTaskCreatePayload(payload?: CreateNotePayload): boolean {
  return payload?.properties?.type === 'task'
}

function ensureCreateResultCanBeListed(payload?: CreateNotePayload) {
  const isTask = isTaskCreatePayload(payload)

  if (
    isTask
    && (notesState.libraryFilter === LibraryFilter.Favorites
      || notesState.libraryFilter === LibraryFilter.Trash
      || notesState.libraryFilter === LibraryFilter.Today
      || notesState.libraryFilter === LibraryFilter.Upcoming
      || notesState.libraryFilter === LibraryFilter.Completed)
  ) {
    notesState.libraryFilter = LibraryFilter.Tasks
    return
  }

  if (
    !isTask
    && (notesState.libraryFilter === LibraryFilter.Trash
      || notesState.libraryFilter === LibraryFilter.Favorites
      || notesState.libraryFilter === LibraryFilter.Tasks
      || notesState.libraryFilter === LibraryFilter.Today
      || notesState.libraryFilter === LibraryFilter.Upcoming
      || notesState.libraryFilter === LibraryFilter.Completed)
  ) {
    notesState.libraryFilter = LibraryFilter.All
  }
}

async function getNoteNamesForCreate(
  folderId: number | null,
): Promise<string[]> {
  const query: NotesQuery = { isDeleted: 0 }
  if (folderId !== null) {
    query.folderId = folderId
  }
  else {
    query.isInbox = 1
  }
  const { data: responseData } = await api.notes.getNotes(query)
  const data = responseData as NotesResponse

  return data
    .filter(note => (note.folder?.id ?? null) === folderId)
    .map(note => note.name)
}

// --- CRUD ---

export async function getNotes(query?: NotesQuery) {
  return withNotesLoading(async () => {
    // Защита от гонки ответов: применяется только самый свежий запрос.
    const requestToken = ++notesRequestToken
    const forSearch = isSearch.value

    const { data: responseData } = await api.notes.getNotes(
      query || queryByLibraryOrFolderOrSearch.value,
    )

    if (requestToken !== notesRequestToken) {
      return
    }

    const data = responseData as NotesResponse

    if (forSearch) {
      notesBySearch.value = data
    }
    else {
      notes.value = data
    }
  })
}

async function withNotesLoading<T>(loader: () => Promise<T>): Promise<T> {
  notesLoadingCounter.value += 1

  try {
    return await loader()
  }
  finally {
    notesLoadingCounter.value = Math.max(0, notesLoadingCounter.value - 1)
  }
}

async function createNote(payload?: CreateNotePayload) {
  try {
    const targetFolderId = notesState.folderId || null
    const existingNames = await getNoteNamesForCreate(targetFolderId)
    const requestedName = payload?.name?.trim()
    const hasRequestedName = existingNames.some(
      name => name.trim().toLowerCase() === requestedName?.toLowerCase(),
    )
    const nextNoteName
      = requestedName && !hasRequestedName
        ? requestedName
        : getNextIndexedName(
            requestedName || i18n.t('notes.untitled'),
            existingNames,
          )

    markPersistedStorageMutation()
    const { data } = await api.notes.postNotes({
      name: nextNoteName,
      folderId: targetFolderId,
      ...(payload?.properties ? { properties: payload.properties } : {}),
    })

    useDonations().incrementCreated('notes')

    ensureCreateResultCanBeListed(payload)

    await getNotes(queryByLibraryOrFolderOrSearch.value)

    return Number(data.id)
  }
  catch (error) {
    console.error(error)
  }
}

async function createNoteAndSelect(payload?: CreateNotePayload) {
  notesCreateKind.value = 'note'
  await createNoteWithPayloadAndSelect(payload)
}

async function createTaskAndSelect(payload?: CreateNotePayload) {
  notesCreateKind.value = 'task'
  await createNoteWithPayloadAndSelect({
    ...payload,
    properties: {
      ...payload?.properties,
      status: NoteTaskStatus.Todo,
      type: 'task',
    },
  })
}

async function createNoteBySelectedKindAndSelect() {
  if (notesCreateKind.value === 'task') {
    await createTaskAndSelect()
    return
  }

  await createNoteAndSelect()
}

async function createNoteWithPayloadAndSelect(payload?: CreateNotePayload) {
  const id = await createNote(payload)

  if (id) {
    selectNote(id)
  }
  else {
    selectFirstNote()
  }

  await focusNoteNameInput()
}

// Поля, влияющие на состав текущего списка: после их изменения нужен refetch.
function isNoteListMembershipAffecting(data: NotesUpdate) {
  return (
    data.folderId !== undefined
    || data.isDeleted !== undefined
    || data.isFavorites !== undefined
  )
}

function patchNoteInCollections(noteId: number, data: NotesUpdate) {
  const now = Date.now()

  function apply(collection?: NotesResponse) {
    if (!collection) {
      return collection
    }

    const index = collection.findIndex(n => n.id === noteId)
    if (index === -1) {
      return collection
    }

    const next = [...collection]
    next[index] = {
      ...next[index],
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined
        ? { description: data.description }
        : {}),
      updatedAt: now,
    }
    return next
  }

  notes.value = apply(notes.value)
  notesBySearch.value = apply(notesBySearch.value)

  const record = selectedNoteRecord.value
  if (record?.id === noteId) {
    selectedNoteRecord.value = {
      ...record,
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined
        ? { description: data.description }
        : {}),
      updatedAt: now,
    }
  }
}

async function updateNote(noteId: number, data: NotesUpdate) {
  markPersistedStorageMutation()
  await api.notes.patchNotesById(String(noteId), data)

  if (isNoteListMembershipAffecting(data)) {
    await getNotes(queryByLibraryOrFolderOrSearch.value)
    await refreshSelectedNote()
    return
  }

  // Переименование/описание не меняют состав списка — обновляем точечно.
  patchNoteInCollections(noteId, data)
}

async function updateNotes(noteIds: number[], data: NotesUpdate[]) {
  markPersistedStorageMutation()

  await Promise.all(
    noteIds.map((noteId, index) =>
      api.notes.patchNotesById(String(noteId), data[index]),
    ),
  )

  await getNotes(queryByLibraryOrFolderOrSearch.value)
  await refreshSelectedNote()
}

async function updateNoteProperties(
  noteId: number,
  data: NotePropertiesUpdate,
) {
  const previousNoteId = notesState.noteId

  markPersistedStorageMutation()
  await api.notes.patchNotesByIdProperties(String(noteId), data)
  await getNotes(queryByLibraryOrFolderOrSearch.value)
  await refreshSelectedNote()
  selectFirstNoteIfCurrentSelectionIsMissing(previousNoteId)
}

async function deleteNote(noteId: number) {
  markPersistedStorageMutation()
  await api.notes.deleteNotesById(String(noteId))
  await getNotes(queryByLibraryOrFolderOrSearch.value)
}

async function deleteNotes(noteIds: number[]) {
  markPersistedStorageMutation()

  await Promise.all(
    noteIds.map(noteId => api.notes.deleteNotesById(String(noteId))),
  )

  await getNotes(queryByLibraryOrFolderOrSearch.value)
}

async function deleteSelectedNotes(fallbackNote?: NoteRecord) {
  const { confirm } = useDialog()
  const targetIds = getActionTargetIds(fallbackNote?.id)

  if (!targetIds.length) {
    return
  }

  const targetNotes = getActionTargetNotes(targetIds, fallbackNote)

  if (targetIds.length > 1) {
    const isAllSoftDeleted
      = targetNotes.length === targetIds.length
        && targetNotes.every(note => note.isDeleted)

    if (isAllSoftDeleted) {
      const isConfirmed = await confirm({
        title: i18n.t('messages:confirm.deleteConfirmMultipleSnippets', {
          count: targetIds.length,
        }),
        content: i18n.t('messages:warning.noUndo'),
      })

      if (isConfirmed) {
        await deleteNotes(targetIds)
        selectFirstNote()
      }
    }
    else {
      const notesData = targetIds.map(() => ({
        folderId: null,
        isDeleted: 1,
      }))

      await updateNotes(targetIds, notesData)
      selectFirstNote()
    }

    return
  }

  const targetNote = targetNotes[0]

  if (!targetNote) {
    return
  }

  if (!targetNote.isDeleted) {
    await updateNote(targetNote.id, { folderId: null, isDeleted: 1 })

    if (notesState.noteId === targetNote.id) {
      selectFirstNote()
    }

    return
  }

  const isConfirmed = await confirm({
    title: i18n.t('messages:confirm.deletePermanently', {
      name: targetNote.name,
    }),
    content: i18n.t('messages:warning.noUndo'),
  })

  if (!isConfirmed) {
    return
  }

  const wasSelected = notesState.noteId === targetNote.id

  await deleteNote(targetNote.id)

  if (wasSelected) {
    selectFirstNote()
  }
}

async function emptyTrash() {
  const { confirm } = useDialog()

  const isConfirmed = await confirm({
    title: i18n.t('messages:confirm.emptyTrash'),
    content: i18n.t('messages:warning.noUndo'),
  })

  if (isConfirmed) {
    await api.notes.deleteNotesTrash()
    await getNotes(queryByLibraryOrFolderOrSearch.value)
  }
}

// --- Tag operations ---

async function addTagToNote(tagId: number, noteId: number) {
  try {
    await api.notes.postNotesByIdTagsByTagId(String(noteId), String(tagId))
    await getNotes(queryByLibraryOrFolderOrSearch.value)
    await refreshSelectedNote()
  }
  catch (error) {
    console.error(error)
  }
}

async function deleteTagFromNote(tagId: number, noteId: number) {
  try {
    await api.notes.deleteNotesByIdTagsByTagId(String(noteId), String(tagId))
    await getNotes(queryByLibraryOrFolderOrSearch.value)
    await refreshSelectedNote()
  }
  catch (error) {
    console.error(error)
  }
}

// --- Selection ---

export function selectNote(noteId: number, withShift = false) {
  if (!withShift) {
    selectedNoteIds.value = [noteId]
    notesState.noteId = noteId
    return
  }

  if (notesState.noteId !== undefined) {
    const source = isSearch.value ? notesBySearch.value : notes.value

    if (source?.length) {
      const orderedIds = source.map(note => note.id)
      const rangeSelection = getContiguousSelection(
        orderedIds,
        notesState.noteId,
        noteId,
      )

      if (rangeSelection.length) {
        selectedNoteIds.value = rangeSelection
        lastSelectedNoteId.value = noteId
      }
    }
  }
  else {
    selectedNoteIds.value = [noteId]
    lastSelectedNoteId.value = noteId
    notesState.noteId = noteId
  }
}

export function selectFirstNote() {
  let firstNote: NoteRecord | undefined

  if (isSearch.value) {
    firstNote = notesBySearch.value?.[0]
  }
  else {
    firstNote = notes.value?.[0]
  }

  if (firstNote) {
    notesState.noteId = firstNote.id
    selectedNoteIds.value = [firstNote.id]
    lastSelectedNoteId.value = firstNote.id
  }
  else {
    notesState.noteId = undefined
    selectedNoteIds.value = []
    lastSelectedNoteId.value = undefined
  }
}

function clearNotes() {
  notes.value = []
  notesBySearch.value = []
}

function clearNotesState() {
  clearNotes()
  selectedNoteIds.value = []
  selectedNoteRecord.value = undefined
  notesState.noteId = undefined
}

export function useNotes() {
  const { hasBusyNoteContentUpdates, updateNoteContent } = useNoteContent()

  return {
    addTagToNote,
    clearNotes,
    clearNotesState,
    createNote,
    createNoteAndSelect,
    createNoteBySelectedKindAndSelect,
    createTaskAndSelect,
    deleteNote,
    deleteNotes,
    deleteSelectedNotes,
    deleteTagFromNote,
    emptyTrash,
    getNotes,
    hasBusyNoteContentUpdates,
    isEmpty,
    isNotesLoading,
    isNotesLoadingVisible,
    isRestoreStateBlocked,
    isSearch,
    lastSelectedNoteId,
    notes,
    refreshSelectedNote,
    selectedNote,
    selectedNoteIds,
    selectedNotes,
    selectFirstNote,
    selectNote,
    updateNote,
    updateNoteProperties,
    updateNotes,
    updateNoteContent,
    withNotesLoading,
  }
}
