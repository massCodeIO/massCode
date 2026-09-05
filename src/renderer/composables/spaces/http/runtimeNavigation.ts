// Keeps request selection independent of the runtime composable, which reads
// the selected request itself. The runtime installs its guard when initialized.
export const httpRuntimeNavigation = {
  confirmLeave: (): Promise<boolean> => Promise.resolve(true),
}
