import { subscribeToContextMenu } from './context-menu'
import { subscribeToNotification } from './notifications'
import { subscribeToPrettier } from './prettier'

export const subscribeToChannels = () => {
  subscribeToContextMenu()
  subscribeToNotification()
  subscribeToPrettier()
}
