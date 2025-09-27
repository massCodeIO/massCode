import { cors } from '@elysiajs/cors'
import { node } from '@elysiajs/node'
import { swagger } from '@elysiajs/swagger'
import { app as electronApp } from 'electron'
import { Elysia } from 'elysia'
import { store } from '../store'
import folders from './routes/folders'
import snippets from './routes/snippets'
import tags from './routes/tags'

export function initApi() {
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
