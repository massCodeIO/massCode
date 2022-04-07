import * as jsonServer from '@masscode/json-server'
import { store } from '../../store'
import { nanoid } from 'nanoid'
import { API_PORT } from '../../config'
import path from 'path'
import type { DB, Snippet } from '@shared/types/main/db'

export const createApiServer = () => {
  const db = path.resolve(store.preferences.get('storagePath') + '/db.json')
  const app = jsonServer.create()
  const middlewares = jsonServer.defaults()
  const router = jsonServer.router<DB>(db)

  app.use(jsonServer.bodyParser)
  app.use(middlewares)

  app.post('/db/update/:table', (req, res) => {
    const table = req.params.table as keyof DB
    const isAllowedTable = ['folders', 'snippets', 'tags'].includes(table)

    if (!isAllowedTable) {
      return res.status(400).send('Table is not defined in DB')
    }
    if (req.body.value?.length === 0) {
      res.status(400).send("'value' is required")
    } else {
      const db = router.db.getState()

      db[table] = req.body.value

      router.db.setState(db)
      router.db.write()

      res.sendStatus(200)
    }
  })

  app.get('/tags/:id/snippets', (req, res) => {
    const id = req.params.id
    const snippets = router.db.get<Snippet[]>('snippets').value()
    const founded = snippets.filter(i => i.tagsIds.includes(id))

    res.status(200).send(founded)
  })

  app.use((req, res, next) => {
    if (req.method === 'POST') {
      req.body.id = nanoid(8)
      req.body.createdAt = Date.now().valueOf()
      req.body.updatedAt = Date.now().valueOf()
    }

    if (req.method === 'PATCH' || req.method === 'PUT') {
      req.body.updatedAt = Date.now().valueOf()
    }
    next()
  })

  app.use(router)

  app.listen(API_PORT, () => {
    console.log(`API server is running on port ${API_PORT}`)
  })
}
