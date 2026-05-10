import type { ImportPreviewResponse } from '@/services/api/generated'

export type ImportDialogSource = ImportPreviewResponse['source']
export type ImportDialogSpace = 'code' | 'notes'

const isImportDialogOpen = ref(false)
const importDialogSource = ref<ImportDialogSource>('vscode-snippets')
const importDialogSpace = ref<ImportDialogSpace>('code')

function getImportDialogSpace(source: ImportDialogSource): ImportDialogSpace {
  return source === 'obsidian' ? 'notes' : 'code'
}

export function useImportDialog() {
  function openImportDialog(
    source: ImportDialogSource,
    space = getImportDialogSpace(source),
  ) {
    importDialogSource.value = source
    importDialogSpace.value = space
    isImportDialogOpen.value = true
  }

  return {
    importDialogSource,
    importDialogSpace,
    isImportDialogOpen,
    openImportDialog,
  }
}
