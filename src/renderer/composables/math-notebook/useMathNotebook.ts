import type { MathNotebookChange, MathSheet } from '~/main/store/types'
import { useDonations } from '@/composables/useDonations'
import {
  markPersistedStorageMutation,
  markUserEdit,
} from '@/composables/useStorageMutation'
import { i18n, ipc } from '@/electron'

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

const sheets = ref<MathSheet[]>([])
const activeSheetId = ref<string | null>(null)
let initialized = false

// До первого успешного чтения state с диска persist запрещён: запись
// затёрла бы ещё не докачанный из облака .state.yaml.
let hasAuthoritativeState = false
let cloudRetryTimer: ReturnType<typeof setTimeout> | null = null

// UI-состояние докачки math state из облака: пока true, пространство
// показывает индикатор синхронизации и не даёт создавать листы.
const isCloudSyncing = ref(false)

// Синхронизировано с ретраем реконсиляции vault в main process.
const CLOUD_RETRY_MS = 3000

const activeSheet = computed(() => {
  return sheets.value.find(s => s.id === activeSheetId.value)
})

function clearCloudRetryTimer() {
  if (cloudRetryTimer) {
    clearTimeout(cloudRetryTimer)
    cloudRetryTimer = null
  }
}

let pendingChanges: MathNotebookChange[] = []
let saveTimer: ReturnType<typeof setTimeout> | undefined
let writing: Promise<void> | undefined
let revision = 0

async function writePendingChanges() {
  while (pendingChanges.length) {
    const changes = pendingChanges
    pendingChanges = []
    try {
      await ipc.invoke('spaces:math:write', changes)
      markPersistedStorageMutation()
    }
    catch (error) {
      pendingChanges = [...changes, ...pendingChanges]
      throw error
    }
  }
}

function flushPendingWrites(): Promise<void> {
  clearTimeout(saveTimer)
  writing ??= writePendingChanges().finally(() => {
    writing = undefined
  })
  return writing
}

function persist(changes: MathNotebookChange[], debounce = false) {
  if (!hasAuthoritativeState)
    return

  revision++
  const previous = pendingChanges.at(-1)
  const next = changes[0]
  if (
    debounce
    && previous?.type === 'edit'
    && next.type === 'edit'
    && previous.id === next.id
    && previous.fields.content !== undefined
  ) {
    pendingChanges.pop()
  }
  pendingChanges.push(...changes)
  const flush = () => {
    void flushPendingWrites().catch(console.error)
  }
  if (debounce) {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(flush, 500)
  }
  else {
    flush()
  }
}

async function loadFromDisk() {
  await flushPendingWrites()
  const pendingRevision = revision
  const data = await ipc.invoke('spaces:math:read', null)
  if (pendingRevision !== revision)
    return

  // .state.yaml ещё не докачан из облака: ретраим чтение, пока main не
  // отдаст настоящий state (докачка уже поставлена в очередь).
  if (data?.pending) {
    isCloudSyncing.value = true
    clearCloudRetryTimer()
    cloudRetryTimer = setTimeout(() => {
      cloudRetryTimer = null
      void loadFromDisk()
    }, CLOUD_RETRY_MS)
    return
  }

  clearCloudRetryTimer()
  hasAuthoritativeState = true
  isCloudSyncing.value = false
  sheets.value = Array.isArray(data?.sheets) ? data.sheets : []
  activeSheetId.value = data?.activeSheetId ?? null
}

function resetMathNotebook() {
  clearCloudRetryTimer()
  clearTimeout(saveTimer)
  pendingChanges = []
  revision++
  sheets.value = []
  activeSheetId.value = null
  initialized = false
  hasAuthoritativeState = false
  isCloudSyncing.value = false
}

export function useMathNotebook() {
  async function init() {
    if (initialized) {
      return
    }
    await loadFromDisk()
    // Флаг ставится после успешного чтения: reject оставляет init
    // непройденным, и следующая активация space повторит загрузку.
    initialized = true
  }

  async function reloadFromDisk() {
    await loadFromDisk()
  }

  function markStale() {
    initialized = false
  }

  function createSheet() {
    // Во время докачки state из облака созданный лист нельзя ни сохранить,
    // ни пережить приход настоящего state: создание блокируется, UI
    // показывает состояние синхронизации.
    if (isCloudSyncing.value) {
      return
    }

    const nextSheetName = getNextIndexedName(
      i18n.t('spaces.math.untitled'),
      sheets.value.map(sheet => sheet.name),
    )
    const sheet: MathSheet = {
      id: crypto.randomUUID(),
      name: nextSheetName,
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    sheets.value = [...sheets.value, sheet]
    activeSheetId.value = sheet.id
    persist([
      { type: 'create', sheet },
      { type: 'select', id: sheet.id },
    ])

    useDonations().incrementCreated('math')

    return sheet.id
  }

  function deleteSheet(id: string) {
    const index = sheets.value.findIndex(s => s.id === id)
    if (index === -1)
      return

    const next = [...sheets.value]
    next.splice(index, 1)
    sheets.value = next

    const changes: MathNotebookChange[] = [{ type: 'delete', id }]
    if (activeSheetId.value === id) {
      activeSheetId.value
        = next.length > 0 ? next[Math.min(index, next.length - 1)].id : null
      changes.push({ type: 'select', id: activeSheetId.value })
    }
    persist(changes)
  }

  function updateSheet(id: string, content: string) {
    const sheet = sheets.value.find(s => s.id === id)
    if (sheet) {
      markUserEdit()
      sheet.content = content
      sheet.updatedAt = Date.now()
      persist(
        [{ type: 'edit', id, fields: { content, updatedAt: sheet.updatedAt } }],
        true,
      )
    }
  }

  function selectSheet(id: string) {
    activeSheetId.value = id
    persist([{ type: 'select', id }])
  }

  function renameSheet(id: string, name: string) {
    const sheet = sheets.value.find(s => s.id === id)
    if (sheet) {
      sheet.name = name
      sheet.updatedAt = Date.now()
      persist([
        { type: 'edit', id, fields: { name, updatedAt: sheet.updatedAt } },
      ])
    }
  }

  return {
    sheets,
    activeSheetId,
    activeSheet,
    isCloudSyncing,
    init,
    reloadFromDisk,
    flushPendingWrites,
    markStale,
    reset: resetMathNotebook,
    createSheet,
    deleteSheet,
    updateSheet,
    selectSheet,
    renameSheet,
  }
}
