import type { MathSheet } from '~/main/store/types'
import { i18n, store } from '@/electron'
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

function loadSheets(): MathSheet[] {
  try {
    const raw = store.mathNotebook.get('sheets')
    return Array.isArray(raw) ? JSON.parse(JSON.stringify(raw)) : []
  }
  catch {
    return []
  }
}

function loadActiveSheetId(): string | null {
  try {
    return store.mathNotebook.get('activeSheetId') as string | null
  }
  catch {
    return null
  }
}

const sheets = ref<MathSheet[]>(loadSheets())
const activeSheetId = ref<string | null>(loadActiveSheetId())

const activeSheet = computed(() => {
  return sheets.value.find(s => s.id === activeSheetId.value)
})

function persist() {
  const raw = JSON.parse(JSON.stringify(sheets.value)) as MathSheet[]
  store.mathNotebook.set('sheets', raw)
  store.mathNotebook.set('activeSheetId', activeSheetId.value)
}

const debouncedPersist = useDebounceFn(persist, 500)

export function useMathNotebook() {
  function createSheet() {
    const nextSheetName = getNextIndexedName(
      i18n.t('mathNotebook.untitled'),
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
    createSheet,
    deleteSheet,
    updateSheet,
    selectSheet,
    renameSheet,
  }
}
