import { Elysia } from 'elysia'
import { resetRuntimeCache } from '../../storage/providers/markdown'
import { getVaultPath } from '../../storage/providers/markdown/runtime'

const app = new Elysia({ prefix: '/system' })

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
    resetRuntimeCache()

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
