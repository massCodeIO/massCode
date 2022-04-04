import { subscribeToContextMenu } from './context-menu'
import { subscribeToNotification } from './notifications'

export const subscribeToChannels = () => {
  subscribeToContextMenu()
  subscribeToNotification()
}
