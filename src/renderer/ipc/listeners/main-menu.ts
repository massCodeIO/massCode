import { ipc } from '@/electron'
import { router } from '@/router'

export function registerMainMenuListeners() {
  ipc.on('main-menu:goto-preferences', () => {
    router.push({ name: 'preferences/storage' })
  })
}
