// Preview keeps ordinary web resources, but never cross-origin file access.
// Shared with the real-Electron Preview regression probe. Preload hardening
// (nodeIntegration/sandbox) is a separate change from this browser boundary.
export const mainWindowWebPreferences = {
  nodeIntegration: true,
  contextIsolation: true,
  webSecurity: true,
} as const
