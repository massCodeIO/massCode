import type { HttpHistoryResponse } from '../dto/http-history'
import { Elysia } from 'elysia'
import { useHttpStorage } from '../../storage'
import { httpHistoryDTO } from '../dto/http-history'

const app = new Elysia({ prefix: '/http-history' })

app
  .use(httpHistoryDTO)
  .get(
    '/',
    () => {
      const storage = useHttpStorage()
      return storage.history.getEntries() as HttpHistoryResponse
    },
    {
      response: 'httpHistoryResponse',
      detail: {
        tags: ['HTTP History'],
      },
    },
  )
  .delete(
    '/',
    () => {
      const storage = useHttpStorage()
      storage.history.clear()

      return { message: 'History cleared' }
    },
    {
      detail: {
        tags: ['HTTP History'],
      },
    },
  )

export default app
