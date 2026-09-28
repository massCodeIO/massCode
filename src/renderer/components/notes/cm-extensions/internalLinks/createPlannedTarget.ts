import type {
  HttpRequestsAdd,
  NotesAdd,
  SnippetContentsAdd,
  SnippetItemResponse,
  SnippetsAdd,
} from '@/services/api/generated'
import { markPersistedStorageMutation } from '@/composables/useStorageMutation'
import { i18n } from '@/electron'
import { api } from '@/services/api'

type NoteInput = Partial<Pick<NotesAdd, 'name'>>
type SnippetInput = Partial<Pick<SnippetsAdd, 'name'>>
type HttpInput = Partial<Pick<HttpRequestsAdd, 'name'>> & {
  folderId: NonNullable<HttpRequestsAdd['folderId']>
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function nextName(
  requested: string | undefined,
  fallback: string,
  names: string[],
) {
  const base = requested?.trim() || fallback
  if (
    requested?.trim()
    && !names.some(name => name.trim().toLowerCase() === base.toLowerCase())
  ) {
    return base
  }
  const escaped = escapeRegExp(base)
  const pattern = new RegExp(`^${escaped}(?:\\s+(\\d+))?$`, 'i')
  let index = 0
  for (const name of names) {
    const match = name.trim().match(pattern)
    if (match) {
      const suffix = match[1] ? Number(match[1]) : 0
      if (Number.isFinite(suffix))
        index = Math.max(index, suffix)
    }
  }
  return `${base} ${index + 1}`
}

export function createNoteOperation(
  payload: NoteInput,
  beforePost: () => void = () => {},
) {
  const input = { ...payload }
  const state: { id?: number, uncertain: boolean } = { uncertain: false }
  let pending: Promise<number> | undefined
  async function run() {
    if (state.id)
      return state.id
    if (state.uncertain)
      throw new Error('CREATION_UNCERTAIN')
    const { data: siblings } = await api.notes.getNotes({
      isDeleted: 0,
      isInbox: 1,
    })
    const name = nextName(
      input.name,
      i18n.t('notes.untitled'),
      siblings.filter(item => item.folder == null).map(item => item.name),
    )
    beforePost()
    markPersistedStorageMutation()
    state.uncertain = true
    try {
      const { data } = await api.notes.postNotes({ name, folderId: null })
      state.id = confirmedId(data.id)
      state.uncertain = false
      return state.id
    }
    catch (error) {
      state.uncertain = !isDefiniteRejection(error)
      throw error
    }
  }
  return {
    state,
    run() {
      pending ??= run().finally(() => {
        pending = undefined
      })
      return pending
    },
  }
}

export function createHttpRequestOperation(
  payload: HttpInput,
  beforePost: () => void = () => {},
) {
  const input = { ...payload }
  const state: { id?: number, uncertain: boolean } = { uncertain: false }
  let pending: Promise<number> | undefined
  async function run() {
    if (state.id)
      return state.id
    if (state.uncertain)
      throw new Error('CREATION_UNCERTAIN')
    const { data: siblings } = await api.httpRequests.getHttpRequests({
      isDeleted: 0,
      folderId: input.folderId,
    })
    const name = nextName(
      input.name,
      i18n.t('spaces.http.untitledRequest'),
      siblings
        .filter(item => (item.folderId ?? null) === input.folderId)
        .map(item => item.name),
    )
    beforePost()
    markPersistedStorageMutation()
    state.uncertain = true
    try {
      const { data } = await api.httpRequests.postHttpRequests({
        name,
        folderId: input.folderId,
      })
      state.id = confirmedId(data.id)
      state.uncertain = false
      return state.id
    }
    catch (error) {
      state.uncertain = !isDefiniteRejection(error)
      throw error
    }
  }
  return {
    state,
    run() {
      pending ??= run().finally(() => {
        pending = undefined
      })
      return pending
    },
  }
}
function confirmedId(value: unknown) {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new Error('CREATION_UNCERTAIN')
  return id
}

function isDefiniteRejection(error: unknown) {
  const status = (error as { response?: { status?: number } })?.response?.status
  return (
    status !== undefined && status >= 400 && status < 500 && status !== 408
  )
}

// Keep this operation after a failure: confirmed identities survive initialization.
// An uncertain POST is never retried automatically; the caller must reconcile it.
export function createSnippetOperation(
  payload: SnippetInput,
  beforePost: () => void = () => {},
) {
  const input = { ...payload }
  const state: { id?: number, fragmentId?: number, uncertain: boolean } = {
    uncertain: false,
  }
  let pending: Promise<number> | undefined
  let fragment: SnippetContentsAdd | undefined

  async function confirmFragment(
    content: SnippetItemResponse['contents'][number],
  ) {
    // GET can expose runtime data from a failed POST persist. PATCH always persists
    // the owner, even with identical values; retain current fields, not defaults.
    markPersistedStorageMutation()
    await api.snippets.patchSnippetsByIdContentsByContentId(
      String(state.id),
      String(content.id),
      {
        label: content.label,
        language: content.language,
        value: content.value,
      },
    )
    state.fragmentId = content.id
    state.uncertain = false
  }

  async function run() {
    if (state.uncertain)
      throw new Error('Snippet creation requires reconciliation')
    if (!state.id) {
      const { data: siblings } = await api.snippets.getSnippets({
        isDeleted: 0,
        isInbox: 1,
      })
      fragment = {
        label: `${i18n.t('common.fragment')} 1`,
        value: '',
        language: 'plain_text',
      }
      const name = nextName(
        input.name,
        i18n.t('snippet.untitled'),
        siblings.filter(item => item.folder == null).map(item => item.name),
      )
      beforePost()
      markPersistedStorageMutation()
      state.uncertain = true
      let data
      try {
        ({ data } = await api.snippets.postSnippets({ name, folderId: null }))
      }
      catch (error) {
        state.uncertain = !isDefiniteRejection(error)
        throw error
      }
      state.id = confirmedId(data.id)
      state.uncertain = false
    }
    if (!state.fragmentId) {
      // A previous fragment POST may have committed despite a lost response.
      const { data: record } = await api.snippets.getSnippetsById(
        String(state.id),
      )
      if (record.pendingCloudDownload)
        throw new Error('Snippet is still syncing')
      if (record.contents.length) {
        await confirmFragment(record.contents[0]!)
      }
      else {
        state.uncertain = true
        markPersistedStorageMutation()
        let data
        try {
          ({ data } = await api.snippets.postSnippetsByIdContents(
            String(state.id),
            fragment!,
          ))
        }
        catch (error) {
          state.uncertain = !isDefiniteRejection(error)
          throw error
        }
        state.fragmentId = confirmedId(data.id)
        state.uncertain = false
      }
    }
    return state.id
  }

  return {
    state,
    run() {
      pending ??= run().finally(() => {
        pending = undefined
      })
      return pending
    },
    async reconcileFragment() {
      if (!state.id)
        return false
      const { data } = await api.snippets.getSnippetsById(String(state.id))
      if (data.pendingCloudDownload)
        return false
      const existing = data.contents[0]
      if (!existing)
        return false
      await confirmFragment(existing)
      return true
    },
  }
}

let plannedHttpCollectionRequest: Promise<number> | undefined

export function getPlannedHttpCollection(
  beforeCreate: () => void,
): Promise<number> {
  plannedHttpCollectionRequest ??= (async () => {
    const name = i18n.t('internalLinks.planned.httpCollection')
    const { data: folders } = await api.httpFolders.getHttpFolders()
    const existing = folders.find(
      folder => folder.parentId === null && folder.name === name,
    )
    if (existing)
      return existing.id
    beforeCreate()
    markPersistedStorageMutation()
    const { data } = await api.httpFolders.postHttpFolders({
      name,
      parentId: null,
    })
    return confirmedId(data.id)
  })().finally(() => {
    plannedHttpCollectionRequest = undefined
  })
  return plannedHttpCollectionRequest
}
