import { Elysia } from 'elysia'
import { resetRuntimeCache } from '../../storage/providers/markdown'
import { getVaultPath } from '../../storage/providers/markdown/runtime'
import { store } from '../../store'

const app = new Elysia({ prefix: '/system' })

app.get(
  '/storage-engine',
  () => {
    const engine = store.preferences.get('storage.engine')

    return { engine }
  },
  {
    detail: {
      tags: ['System'],
    },
  },
)

app.get(
  '/storage-vault-path',
  () => {
    return {
      vaultPath: getVaultPath(),
    }
  },
  {
    detail: {
      tags: ['System'],
    },
  },
)

app.post(
  '/storage-cache/reset',
  () => {
    if (store.preferences.get('storage.engine') === 'markdown') {
      resetRuntimeCache()
    }

    return {
      reset: true,
    }
  },
  {
    detail: {
      tags: ['System'],
    },
  },
)

export default app
