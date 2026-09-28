// Keeps request selection independent of the runtime composable, which reads
// the selected request itself. The runtime installs its guard when initialized.
export const httpRuntimeNavigation = {
  transitionToken: 0,
  confirmCollectionLeave: (): Promise<boolean> => Promise.resolve(true),
  confirmLeave: (): Promise<boolean> => Promise.resolve(true),
}
