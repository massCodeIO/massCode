import { app as electronApp } from 'electron'
import { Elysia } from 'elysia'
import { store } from '../store'
import { importEsm } from '../utils'
import { createApiApp } from './app'

export async function initApi(sessionToken: string) {
  // поскольку @elysiajs/node использует crossws, который работает только в ESM среде,
  // то делаем хак с динамическим импортом
  const { node } = await importEsm('@elysiajs/node')

  const port = store.preferences.get('api.port') as number
  const app = new Elysia({ adapter: node() })

  createApiApp(
    {
      port,
      sessionToken,
      version: electronApp.getVersion(),
    },
    app,
  ).listen({
    hostname: '127.0.0.1',
    port,
  })

  // eslint-disable-next-line no-console
  console.log(`\nAPI started on port ${port}\n`)
}
