import type {
  ApiTransportRequest,
  ApiTransportResponse,
} from '~/shared/apiTransport'
import { useSonner } from '@/composables/useSonner'
import { i18n, ipc, store } from '@/electron'
import ky from 'ky'
import { Api } from './generated'

const apiPort = store.preferences.get('api.port')

// 503 от storage-слоя означает «содержимое ещё не докачано из облака»
// (CLOUD_FILE_NOT_DOWNLOADED / VAULT_HYDRATING): единый тост вместо тихой
// ошибки в консоли в каждом мутационном потоке.
const kyWithCloudNotice = ky.extend({
  fetch: async (input, init) => {
    const request = new Request(input, init)
    const response = await ipc.invoke<
      ApiTransportRequest,
      ApiTransportResponse
    >('system:api-request', {
      url: request.url,
      method: request.method,
      headers: Array.from(request.headers.entries()),
      body: request.body ? await request.arrayBuffer() : undefined,
    })
    return new Response(
      request.method === 'HEAD' || [204, 205, 304].includes(response.status)
        ? null
        : response.body,
      response,
    )
  },
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
  baseUrl: `http://127.0.0.1:${apiPort}`,
  customFetch: kyWithCloudNotice,
})
