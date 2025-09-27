import Donate from '@/components/ui/sonner/templates/Donate.vue'
import { useApp, useSonner } from '@/composables'
import { store } from '@/electron'
import { addDays } from 'date-fns'

const INTERVAL = 1000 * 60 * 60 * 3 // 3 часа

const { sonner } = useSonner()
const { isSponsored } = useApp()

const isShownDonateNotification = ref(false)

function setNextDonateNotification() {
  const nextDonateNotification = addDays(new Date(), 14)
  store.app.set('nextDonateNotification', nextDonateNotification.getTime())
}

function initFirstDonateNotification() {
  const nextDonateNotification = store.app.get('nextDonateNotification')

  if (!nextDonateNotification) {
    setNextDonateNotification()
  }
}

function showDonateNotification() {
  if (isSponsored) {
    return
  }

  const nextDonateNotification = store.app.get('nextDonateNotification')
  const now = new Date().getTime()

  if (
    !nextDonateNotification
    || nextDonateNotification > now
    || isShownDonateNotification.value
  ) {
    return
  }

  sonner({
    closeButton: true,
    component: Donate,
    duration: Infinity,
    onClose: () => {
      isShownDonateNotification.value = false
      setNextDonateNotification()
    },
  })

  isShownDonateNotification.value = true
}

function startNotificationCheck() {
  initFirstDonateNotification()

  showDonateNotification()

  setInterval(() => {
    showDonateNotification()
  }, INTERVAL)
}

export function donateNotification() {
  startNotificationCheck()
}
