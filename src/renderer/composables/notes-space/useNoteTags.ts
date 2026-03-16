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

// --- CRUD ---

async function getNoteTags() {
  try {
    isLoading.value = true
    const { data } = await (api as any).noteTags.getNoteTags()
    tags.value = data
  }
  catch (error) {
    console.error(error)
  }
  finally {
    isLoading.value = false
  }
}

async function addNoteTag(tagName: string) {
  const { data } = await (api as any).noteTags.postNoteTags({ name: tagName })

  return data.id as number
}

async function updateNoteTag(tagId: number, tagName: string) {
  try {
    await (api as any).noteTags.patchNoteTagsById(String(tagId), {
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
    await (api as any).noteTags.deleteNoteTagsById(String(tagId))
    await getNoteTags()
  }
  catch (error) {
    console.error(error)
  }
}

export function useNoteTags() {
  return {
    addNoteTag,
    deleteNoteTag,
    getNoteTags,
    isLoading,
    tags,
    updateNoteTag,
  }
}
