import { store } from '@/electron'

const locale = ref<string>(
  store.preferences.get('localization.locale') as string,
)
watch(locale, value => store.preferences.set('localization.locale', value))
export function useLocalePreference() {
  return { locale }
}
