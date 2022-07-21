import { lstatSync, readdirSync } from 'fs'
import { join } from 'path'
import i18next from 'i18next'
import Backend from 'i18next-fs-backend'
import { store } from '../../store'

const lng = store.preferences.get('language')

i18next.use(Backend).init({
  fallbackLng: 'en',
  lng: lng,
  debug: false,
  ns: ['common', 'dialog', 'preferences', 'special', 'menu'],
  defaultNS: 'common',
  initImmediate: false,
  preload: readdirSync(join(__dirname, './locales')).filter(fileName => {
    const joinedPath = join(join(__dirname, './locales'), fileName)
    const isDirectory = lstatSync(joinedPath).isDirectory()
    return isDirectory
  }),
  backend: {
    loadPath: join(__dirname, './locales/{{lng}}/{{ns}}.json')
  }
})

i18next.addResourceBundle(lng, 'language', {
  en: 'English',
  ru: 'Русский',
  zh_CN: '中文 (简体)'
})

export default i18next
