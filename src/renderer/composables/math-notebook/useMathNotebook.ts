import type { MathSheet } from '~/main/store/types'
import { useDonations } from '@/composables/useDonations'
import {
  markPersistedStorageMutation,
  markUserEdit,
} from '@/composables/useStorageMutation'
import { i18n, ipc } from '@/electron'
import { useDebounceFn } from '@vueuse/core'
import { nanoid } from 'nanoid'

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

const activeSheet = computed(() => {
  return sheets.value.find(s => s.id === activeSheetId.value)
})

function persist() {
  markPersistedStorageMutation()
  ipc.invoke('spaces:math:write', {
    sheets: JSON.parse(JSON.stringify(sheets.value)),
    activeSheetId: activeSheetId.value,
  })
}

const debouncedPersist = useDebounceFn(persist, 500)

async function loadFromDisk() {
  const data = await ipc.invoke('spaces:math:read', null)
  sheets.value = Array.isArray(data?.sheets) ? data.sheets : []
  activeSheetId.value = data?.activeSheetId ?? null
}

function resetMathNotebook() {
  sheets.value = []
  activeSheetId.value = null
  initialized = false
}

export function useMathNotebook() {
  async function init() {
    if (initialized) {
      return
    }
    initialized = true
    await loadFromDisk()
  }

  async function reloadFromDisk() {
    await loadFromDisk()
  }

  function createSheet() {
    const nextSheetName = getNextIndexedName(
      i18n.t('spaces.math.untitled'),
      sheets.value.map(sheet => sheet.name),
    )
    const sheet: MathSheet = {
      id: nanoid(),
      name: nextSheetName,
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    sheets.value = [...sheets.value, sheet]
    activeSheetId.value = sheet.id
    persist()

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

    if (activeSheetId.value === id) {
      activeSheetId.value
        = next.length > 0 ? next[Math.min(index, next.length - 1)].id : null
    }
    persist()
  }

  function updateSheet(id: string, content: string) {
    const sheet = sheets.value.find(s => s.id === id)
    if (sheet) {
      markUserEdit()
      sheet.content = content
      sheet.updatedAt = Date.now()
      debouncedPersist()
    }
  }

  function selectSheet(id: string) {
    activeSheetId.value = id
    persist()
  }

  function renameSheet(id: string, name: string) {
    const sheet = sheets.value.find(s => s.id === id)
    if (sheet) {
      sheet.name = name
      sheet.updatedAt = Date.now()
      persist()
    }
  }

  return {
    sheets,
    activeSheetId,
    activeSheet,
    init,
    reloadFromDisk,
    reset: resetMathNotebook,
    createSheet,
    deleteSheet,
    updateSheet,
    selectSheet,
    renameSheet,
  }
}
