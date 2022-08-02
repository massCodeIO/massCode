import { subscribeToContextMenu } from './context-menu'
import { subscribeToNotification } from './notifications'
import { subscribeToPrettier } from './prettier'
import { subscribeToFs } from './fs'

export const subscribeToChannels = () => {
  subscribeToContextMenu()
  subscribeToNotification()
  subscribeToPrettier()
  subscribeToFs()
}
