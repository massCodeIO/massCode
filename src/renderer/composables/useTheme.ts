import { store } from '@/electron'
import { useColorMode } from '@vueuse/core'

const storedTheme = store.preferences.get('theme')
const { store: theme } = useColorMode()

theme.value = storedTheme

watch(theme, (v) => {
  store.preferences.set('theme', v)
})

export function useTheme() {
  return {
    theme,
  }
}
