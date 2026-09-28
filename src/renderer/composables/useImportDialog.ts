import type { ImportPreviewResponse } from '@/services/api/generated'
import type { ImportReporter } from './importResult'
import { createImportResultSession } from './importResult'

export type ImportDialogSource = ImportPreviewResponse['source']
export type ImportDialogSpace = 'code' | 'notes'

const resultSession = createImportResultSession()
const importDialogOpening = ref(0)
const importDialogSource = ref<ImportDialogSource>()
const isImportDialogOpen = ref(false)
const importDialogSpace = ref<ImportDialogSpace>('code')

function getImportDialogSpace(source: ImportDialogSource): ImportDialogSpace {
  return source === 'obsidian' ? 'notes' : 'code'
}

export function useImportDialog() {
  function openImportDialog(
    source: ImportDialogSource,
    space = getImportDialogSpace(source),
    reporter?: ImportReporter,
    isCurrent?: () => boolean,
  ) {
    resultSession.open(reporter, isCurrent)
    importDialogOpening.value++
    importDialogSource.value = reporter ? source : undefined
    importDialogSpace.value = space
    isImportDialogOpen.value = true
  }

  return {
    importDialogSource,
    importDialogOpening,
    canContinueImport: resultSession.canContinue,
    beginImportApply: resultSession.beginApply,
    captureImportResult: resultSession.capture,
    closeImportResult: resultSession.close,
    importDialogSpace,
    isImportDialogOpen,
    openImportDialog,
  }
}
