import { lstatSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import i18next from 'i18next'
import Backend from 'i18next-fs-backend'
import { store } from '../store'
import { language } from './language'

const storedLng = store.preferences.get('language')

const lng
  = storedLng && Object.keys(language).includes(storedLng) ? storedLng : 'en_US'

i18next.use(Backend).init({
  fallbackLng: 'en_US',
  lng,
  debug: false,
  ns: ['devtools', 'menu', 'messages', 'preferences', 'special', 'ui'],
  defaultNS: 'ui',
  initImmediate: false,
  preload: readdirSync(join(__dirname, './locales')).filter((fileName) => {
    const joinedPath = join(join(__dirname, './locales'), fileName)
    const isDirectory = lstatSync(joinedPath).isDirectory()
    return isDirectory
  }),
  backend: {
    loadPath: join(__dirname, './locales/{{lng}}/{{ns}}.json'),
  },
})

i18next.addResourceBundle(lng, 'language', language)

export default i18next
