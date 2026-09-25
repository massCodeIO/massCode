import type { ImportReporter } from './importResult'
import { createImportResultSession } from './importResult'

const resultSession = createImportResultSession()
const importDialogOpening = ref(0)
const isHttpImportDialogOpen = ref(false)

export function useHttpImportDialog() {
  function openHttpImportDialog(
    reporter?: ImportReporter,
    isCurrent?: () => boolean,
  ) {
    resultSession.open(reporter, isCurrent)
    importDialogOpening.value++
    isHttpImportDialogOpen.value = true
  }

  return {
    importDialogOpening,
    canContinueImport: resultSession.canContinue,
    beginImportApply: resultSession.beginApply,
    captureImportResult: resultSession.capture,
    closeImportResult: resultSession.close,
    isHttpImportDialogOpen,
    openHttpImportDialog,
  }
}
