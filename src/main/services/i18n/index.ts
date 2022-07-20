import { lstatSync, readdirSync } from 'fs'
import { join } from 'path'
import i18next from 'i18next'
import Backend from 'i18next-fs-backend'
import { store } from '../../store'

i18next.use(Backend).init({
  fallbackLng: 'en',
  lng: store.preferences.get('language'),
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

export default i18next
