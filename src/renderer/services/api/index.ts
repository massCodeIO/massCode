import { useSonner } from '@/composables/useSonner'
import { i18n, store } from '@/electron'
import ky from 'ky'
import { Api } from './generated'

const apiPort = store.preferences.get('api.port')

// 503 от storage-слоя означает «содержимое ещё не докачано из облака»
// (CLOUD_FILE_NOT_DOWNLOADED / VAULT_HYDRATING): единый тост вместо тихой
// ошибки в консоли в каждом мутационном потоке.
const kyWithCloudNotice = ky.extend({
  hooks: {
    afterResponse: [
      (_request, _options, response) => {
        if (response.status === 503) {
          useSonner().sonner({
            id: 'cloud-file-not-ready',
            message: i18n.t('messages:warning.cloudFileNotReady'),
            type: 'warning',
          })
        }
      },
    ],
  },
})

export const api = new Api({
  baseUrl: `http://localhost:${apiPort}`,
  customFetch: kyWithCloudNotice,
})
