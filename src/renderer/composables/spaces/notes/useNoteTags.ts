import { api } from '@/services/api'

// --- Types ---
// These mirror the generated API types that will exist after api:generate.

interface NoteTagRecord {
  id: number
  name: string
}

type NoteTagsResponse = NoteTagRecord[]

// --- Module-level state ---

const tags = shallowRef<NoteTagsResponse>([])
const isLoading = ref(false)
const isNoteTagsLoaded = ref(false)
let inFlightRequest: Promise<void> | null = null

// --- CRUD ---

// Параллельные вызовы (init спейса + маунт компонентов) деду­плицируются
// в один запрос.
function getNoteTags(): Promise<void> {
  if (inFlightRequest) {
    return inFlightRequest
  }

  inFlightRequest = (async () => {
    try {
      isLoading.value = true
      const { data } = await api.noteTags.getNoteTags()
      tags.value = data
      isNoteTagsLoaded.value = true
    }
    catch (error) {
      console.error(error)
    }
    finally {
      isLoading.value = false
      inFlightRequest = null
    }
  })()

  return inFlightRequest
}

async function addNoteTag(tagName: string) {
  const { data } = await api.noteTags.postNoteTags({ name: tagName })

  return data.id as number
}

async function updateNoteTag(tagId: number, tagName: string) {
  try {
    await api.noteTags.patchNoteTagsById(String(tagId), {
      name: tagName,
    })
    await getNoteTags()
  }
  catch (error) {
    console.error(error)
  }
}

async function deleteNoteTag(tagId: number) {
  try {
    await api.noteTags.deleteNoteTagsById(String(tagId))
    await getNoteTags()
  }
  catch (error) {
    console.error(error)
  }
}

function resetNoteTags() {
  tags.value = []
  isNoteTagsLoaded.value = false
}

export function useNoteTags() {
  return {
    addNoteTag,
    deleteNoteTag,
    getNoteTags,
    isLoading,
    isNoteTagsLoaded,
    resetNoteTags,
    tags,
    updateNoteTag,
  }
}
