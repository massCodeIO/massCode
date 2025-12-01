import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { app as electronApp } from 'electron'
import { Elysia } from 'elysia'
import { store } from '../store'
import { importEsm } from '../utils'
import folders from './routes/folders'
import snippets from './routes/snippets'
import tags from './routes/tags'

export async function initApi() {
  // поскольку @elysiajs/node использует crossws, который работает только в ESM среде,
  // то делаем хак с динамическим импортом
  const { node } = await importEsm('@elysiajs/node')

  const app = new Elysia({ adapter: node() })
  const port = store.preferences.get('apiPort')

  app
    .use(cors({ origin: '*' }))
    .use(
      swagger({
        documentation: {
          info: {
            title: 'massCode API',
            version: electronApp.getVersion(),
          },
        },
      }),
    )
    .use(snippets)
    .use(folders)
    .use(tags)
    .listen(port)

  // eslint-disable-next-line no-console
  console.log(`\nAPI started on port ${port}\n`)
}
