import { useSonner } from '@/composables/useSonner'
import { i18n, ipc, store } from '@/electron'
import ky from 'ky'
import { Api } from './generated'

const apiPort = store.preferences.get('api.port')
let apiSessionToken: Promise<string> | undefined

function getApiSessionToken(): Promise<string> {
  apiSessionToken ??= ipc.invoke<undefined, string>(
    'system:api-session-token',
    undefined,
  )

  return apiSessionToken
}

// 503 от storage-слоя означает «содержимое ещё не докачано из облака»
// (CLOUD_FILE_NOT_DOWNLOADED / VAULT_HYDRATING): единый тост вместо тихой
// ошибки в консоли в каждом мутационном потоке.
const kyWithCloudNotice = ky.extend({
  hooks: {
    beforeRequest: [
      async (request) => {
        request.headers.set(
          'authorization',
          `Bearer ${await getApiSessionToken()}`,
        )
      },
    ],
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
  baseUrl: `http://127.0.0.1:${apiPort}`,
  customFetch: kyWithCloudNotice,
})
