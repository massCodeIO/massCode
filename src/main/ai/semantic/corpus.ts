import type { RecordSignature } from '../../storage/contracts'
import type { CorpusRecord } from './chunks'
import type { KeywordIndex } from './keywordIndex'
import { setImmediate } from 'node:timers/promises'
import { useHttpStorage, useNotesStorage, useStorage } from '../../storage'
import { keywordDocument } from './chunks'
import {
  createKeywordIndex,
  removeKeywordDocument,
  updateKeywordDocument,
} from './keywordIndex'
import { httpSearchPath, textHash } from './text'

export type CorpusType = CorpusRecord['type']

export interface CorpusEntry {
  ref: string
  sig: string
  // Содержимое ещё не скачано из облака: запись ищется по имени, не хэшируется и не эмбеддится.
  pending: boolean
  name: string
  record?: CorpusRecord
  h?: string
}

export interface CorpusChanges {
  added: string[]
  // Только записи с изменившимся содержимым; смена одной сигнатуры сюда не попадает.
  changed: string[]
  removed: string[]
}

export interface Corpus {
  entries: Map<string, CorpusEntry>
  keyword: KeywordIndex
  refresh: () => Promise<CorpusChanges>
}

// 2026-10-12: дочитывание по одной записи синхронно читает файл; на больших правках дешевле один
// проход списка с withContent, который отдаёт управление между файлами.
const POINT_HYDRATION_LIMIT = 50
const YIELD_EVERY_MS = 8

const TYPES: CorpusType[] = ['snippet', 'note', 'http_request']

export function refOf(type: CorpusType, id: number) {
  return `${type}:${id}`
}

// Хэш того, что уходит в чанки. id не входит: одинаковое содержимое под новым id (файл переименован
// извне) не эмбеддится заново. Папка не входит: она ищется только словами. У HTTP — путь без хоста
// и query, как в chunkRecord.
export function recordHash(record: CorpusRecord) {
  const projection
    = record.type === 'http_request'
      ? {
          ...record,
          id: 0,
          folder: undefined,
          url: httpSearchPath(record.url ?? ''),
        }
      : { ...record, id: 0, folder: undefined }
  return textHash(JSON.stringify(projection))
}

function requireMethod<T>(method: T | undefined, name: string): T {
  if (!method)
    throw new Error(`Storage does not implement ${name}`)
  return method
}

function readSignatures(): Record<CorpusType, Map<number, RecordSignature>> {
  const { snippets } = useStorage()
  const { notes } = useNotesStorage()
  const { requests } = useHttpStorage()
  return {
    snippet: requireMethod(
      snippets.getSnippetSignatures,
      'getSnippetSignatures',
    )(),
    note: requireMethod(notes.getNoteSignatures, 'getNoteSignatures')(),
    http_request: requireMethod(
      requests.getRequestSignatures,
      'getRequestSignatures',
    )(),
  }
}

interface Hydrated {
  name: string
  pending: boolean
  record: CorpusRecord
}

function fromSnippet(item: {
  id: number
  name: string
  description: string | null
  folder?: { name: string } | null
  contents: { label: string, language: string, value: string | null }[]
  pendingCloudDownload?: boolean
}): Hydrated {
  return {
    name: item.name,
    // Тело не дочиталось (файл выгружен после скана): запись не эмбеддится пустой и сверяется заново.
    pending:
      item.pendingCloudDownload === true
      || item.contents.some(content => content.value === null),
    record: {
      type: 'snippet',
      id: item.id,
      name: item.name,
      description: item.description,
      contents: item.contents.map(({ label, language, value }) => ({
        label,
        language,
        value,
      })),
      ...(item.folder ? { folder: item.folder.name } : {}),
    },
  }
}

function fromNote(item: {
  id: number
  name: string
  content: string
  folder?: { name: string } | null
  pendingCloudDownload?: boolean
}): Hydrated {
  return {
    name: item.name,
    pending: item.pendingCloudDownload === true,
    record: {
      type: 'note',
      id: item.id,
      name: item.name,
      content: item.content,
      ...(item.folder ? { folder: item.folder.name } : {}),
    },
  }
}

// Записи с телами по id. Ожидающие облака берутся из списка без чтения файлов:
// getSnippetById поднял бы их в очереди докачки.
async function hydrate(
  type: CorpusType,
  ids: Map<number, boolean>,
  full: boolean,
) {
  const result = new Map<number, Hydrated>()
  if (!ids.size)
    return result
  const wanted = (id: number) => ids.has(id)
  if (type === 'http_request') {
    // Описание HTTP лежит в метаданных state: список отдаёт его без чтения файлов.
    const { folders, requests } = useHttpStorage()
    const folderNames = new Map(
      folders.getFolders().map(folder => [folder.id, folder.name]),
    )
    for (const item of requests.getRequests({ isDeleted: 0 })) {
      if (!wanted(item.id))
        continue
      result.set(item.id, {
        name: item.name,
        pending: item.pendingCloudDownload === true,
        record: {
          type,
          id: item.id,
          name: item.name,
          method: item.method,
          url: item.url,
          description: item.description ?? '',
          ...(item.folderId !== null && folderNames.has(item.folderId)
            ? { folder: folderNames.get(item.folderId) }
            : {}),
        },
      })
    }
    return result
  }
  const pointIds = [...ids].filter(([, pending]) => !pending).map(([id]) => id)
  const listNeeded = full || pointIds.length < ids.size
  if (type === 'snippet') {
    const { snippets } = useStorage()
    if (listNeeded) {
      const list = await requireMethod(
        snippets.getSnippetsAsync,
        'getSnippetsAsync',
      )({ isDeleted: 0, withContent: full })
      for (const item of list) {
        if (wanted(item.id) && (full || ids.get(item.id)))
          result.set(item.id, fromSnippet(item))
      }
    }
    if (!full) {
      for (const id of pointIds) {
        const item = snippets.getSnippetById(id)
        if (item && !item.isDeleted)
          result.set(id, fromSnippet(item))
      }
    }
    return result
  }
  const { notes } = useNotesStorage()
  if (listNeeded) {
    const list = await requireMethod(
      notes.getNotesAsync,
      'getNotesAsync',
    )({ isDeleted: 0, withContent: full })
    for (const item of list) {
      if (wanted(item.id) && (full || ids.get(item.id)))
        result.set(item.id, fromNote(item))
    }
  }
  if (!full) {
    for (const id of pointIds) {
      const item = notes.getNoteById(id)
      if (item && !item.isDeleted)
        result.set(id, fromNote(item))
    }
  }
  return result
}

export function createCorpus(): Corpus {
  const entries = new Map<string, CorpusEntry>()
  const keyword = createKeywordIndex()
  let running: Promise<CorpusChanges> | undefined
  let queued: Promise<CorpusChanges> | undefined

  function remove(ref: string) {
    entries.delete(ref)
    removeKeywordDocument(keyword, ref)
  }

  async function run(): Promise<CorpusChanges> {
    const changes: CorpusChanges = { added: [], changed: [], removed: [] }
    const signatures = readSignatures()
    const live = new Set<string>()
    const stale = new Map<CorpusType, Map<number, boolean>>()
    // Тело не дочиталось при прошлом обновлении, хотя запись не ждёт облака: сверяется по одной,
    // getById пометит её ожидающей, и следующий refresh её уже не тронет.
    const retry = new Map<CorpusType, Map<number, boolean>>()
    let staleCount = 0
    let retryCount = 0
    for (const type of TYPES) {
      const wanted = new Map<number, boolean>()
      const unread = new Map<number, boolean>()
      for (const [id, signature] of signatures[type]) {
        const ref = refOf(type, id)
        live.add(ref)
        const entry = entries.get(ref)
        if (
          entry
          && entry.sig === signature.sig
          && entry.pending === signature.pendingCloudDownload
        ) {
          continue
        }
        if (
          entry
          && entry.sig === signature.sig
          && !signature.pendingCloudDownload
        ) {
          unread.set(id, false)
          retryCount++
          continue
        }
        wanted.set(id, signature.pendingCloudDownload)
        staleCount++
      }
      stale.set(type, wanted)
      retry.set(type, unread)
    }
    for (const ref of [...entries.keys()]) {
      if (!live.has(ref)) {
        remove(ref)
        changes.removed.push(ref)
      }
    }
    if (!staleCount && !retryCount)
      return changes

    const full = staleCount > POINT_HYDRATION_LIMIT
    // Массовое обновление: отсортированный список слов дешевле пересобрать при следующем префиксном
    // поиске, чем вставлять в него каждое новое слово.
    if (full)
      keyword.sortedWords = undefined
    let started = performance.now()
    for (const type of TYPES) {
      const unread = retry.get(type)!
      const ids = new Map([...stale.get(type)!, ...unread])
      if (!ids.size)
        continue
      const hydrated = await hydrate(type, stale.get(type)!, full)
      for (const [id, item] of await hydrate(type, unread, false))
        hydrated.set(id, item)
      for (const id of ids.keys()) {
        // Отдача управления в каждой итерации полного пути, какая бы ветка ни сработала ниже.
        if (full && performance.now() - started >= YIELD_EVERY_MS) {
          await setImmediate()
          started = performance.now()
        }
        const ref = refOf(type, id)
        const item = hydrated.get(id)
        const previous = entries.get(ref)
        if (!item) {
          // Запись удалили между чтением сигнатур и дочитыванием.
          if (previous) {
            remove(ref)
            changes.removed.push(ref)
          }
          continue
        }
        const sig = signatures[type].get(id)!.sig
        if (item.pending) {
          entries.set(ref, { ref, sig, pending: true, name: item.name })
          updateKeywordDocument(keyword, { ref, name: item.name, body: '' })
          if (!previous)
            changes.added.push(ref)
          continue
        }
        const h = recordHash(item.record)
        if (previous?.h === h) {
          // Сменилась только папка: обновляется поиск по словам, векторы остаются.
          if (previous.record?.folder !== item.record.folder)
            updateKeywordDocument(keyword, keywordDocument(item.record))
          entries.set(ref, { ...previous, sig, record: item.record })
          continue
        }
        entries.set(ref, {
          ref,
          sig,
          pending: false,
          name: item.name,
          record: item.record,
          h,
        })
        updateKeywordDocument(keyword, keywordDocument(item.record));
        (previous ? changes.changed : changes.added).push(ref)
      }
    }
    return changes
  }

  // Обновления не идут параллельно: вызов во время прогона ждёт его и запускает ещё один,
  // иначе правка, сделанная после чтения сигнатур, осталась бы незамеченной.
  function refresh(): Promise<CorpusChanges> {
    if (!running) {
      running = run().finally(() => {
        running = undefined
      })
      return running
    }
    queued ??= running
      .catch(() => {})
      .then((): Promise<CorpusChanges> => {
        queued = undefined
        return refresh()
      })
    return queued
  }

  return { entries, keyword, refresh }
}

export const vaultCorpus = createCorpus()
