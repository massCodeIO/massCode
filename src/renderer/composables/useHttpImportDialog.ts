const isHttpImportDialogOpen = ref(false)

export function useHttpImportDialog() {
  function openHttpImportDialog() {
    isHttpImportDialogOpen.value = true
  }

  return {
    isHttpImportDialogOpen,
    openHttpImportDialog,
  }
}
