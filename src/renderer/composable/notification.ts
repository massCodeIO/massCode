import { createToast, destroyAllToasts } from 'vercel-toast'
import { i18n, ipc, store, track } from '@/electron'
import { useAppStore } from '@/store/app'
import { addDays } from 'date-fns'
import { ref } from 'vue'
import axios from 'axios'

export const checkForRemoteNotification = async () => {
  const showMessage = (message: string, date: string | number) => {
    const el = document.createElement('div')
    el.innerHTML = message

    const links = el.querySelectorAll('a')

    links.forEach(i => {
      i.addEventListener('click', e => {
        e.preventDefault()
        ipc.invoke('main:open-url', i.href)
        track('app/notify', i.innerHTML)
      })
    })

    createToast(el, {
      action: {
        text: i18n.t('close'),
        callback (toast) {
          toast.destroy()
          store.app.set('prevRemoteNotice', date)
          track('app/notify', `remoteNotification-close-${date}`)
        }
      }
    })
  }

  const checkAndShow = async () => {
    try {
      const headers = {
        'Cache-Control': 'no-cache',
        Expires: 0
      }

      const { data } = await axios.get<{ message: string; date: number }>(
        'https://masscode.io/notification.json',
        { headers }
      )

      if (!data) return

      const { message, date } = data
      const prevDate = store.app.get('prevRemoteNotice')

      if (prevDate) {
        if (prevDate < date) showMessage(message, date)
      } else {
        showMessage(message, date)
      }
    } catch (err) {
      console.error(err)
    }
  }

  checkAndShow()

  setInterval(() => {
    checkAndShow()
  }, 1000 * 60 * 180) // 3 часа
}

export const useSupportNotification = () => {
  const appStore = useAppStore()
  const isShow = ref(false)

  const setNextNoticeDate = () => {
    store.app.set('nextSupportNotice', addDays(new Date(), 7).valueOf())
  }

  const showMessage = () => {
    const message = document.createElement('div')
    message.innerHTML = i18n.t('special:supportMessage', {
      tagStart: '<a id="donate" href="#">',
      tagEnd: '</a>'
    })

    createToast(message, {
      action: {
        text: i18n.t('close'),
        callback (toast) {
          toast.destroy()
          setNextNoticeDate()
          isShow.value = false
          track('app/notify', 'support-close')
        }
      }
    })

    const d = document.querySelector('#donate')

    d?.addEventListener('click', () => {
      ipc.invoke('main:open-url', 'https://masscode.io/donate')
      destroyAllToasts()
      setNextNoticeDate()
      isShow.value = false
      track('app/notify', 'support-go-to-masscode')
    })

    isShow.value = true
  }

  const showSupportToast = () => {
    if (appStore.isSponsored) return

    const date = store.app.get('nextSupportNotice')

    if (!date && !isShow.value) {
      showMessage()
    } else {
      const isDateToShow = new Date().valueOf() > date

      if (!isDateToShow) return
      if (isShow.value) return

      showMessage()
    }
  }

  return {
    showSupportToast
  }
}
