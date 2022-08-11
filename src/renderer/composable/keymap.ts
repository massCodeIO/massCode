import { store } from '@/electron'
import { EDITOR_DEFAULTS, useAppStore } from '@/store/app'
import { useMagicKeys } from '@vueuse/core'
import { watch } from 'vue'
import router from '@/router'
import { emitter } from '.'

export const useKeyMap = () => {
  const appStore = useAppStore()

  // Вариант с meta.value && Equal.value вызывается только один раз,
  // последующее нажатие на клавишу "="" не вызывает метод.
  // Поэтому сделал так
  useMagicKeys({
    passive: false,
    onEventFired: e => {
      const { path } = router.currentRoute.value

      if (path !== '/') return

      if (e.metaKey && e.key === '=') {
        appStore.editor.fontSize += 1
      }

      if (e.metaKey && e.key === '-') {
        if (appStore.editor.fontSize === 1) return
        appStore.editor.fontSize -= 1
      }

      if (e.metaKey && e.key === '0') {
        appStore.editor.fontSize = EDITOR_DEFAULTS.fontSize
      }

      emitter.emit('editor:refresh', true)
    }
  })

  watch(
    () => appStore.editor,
    v => {
      store.preferences.set('editor', { ...v })
    },
    { deep: true }
  )
}
