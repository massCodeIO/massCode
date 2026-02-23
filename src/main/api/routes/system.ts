import { Elysia } from 'elysia'
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

export default app
