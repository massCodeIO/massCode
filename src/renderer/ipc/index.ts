import { registerMainMenuListeners } from './listeners/main-menu'
import { registerSystemListeners } from './listeners/system'

export function registerIPCListeners() {
  registerMainMenuListeners()
  registerSystemListeners()
}
