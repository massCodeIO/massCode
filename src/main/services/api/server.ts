import * as jsonServer from '@masscode/json-server'
import { store } from '../../store'
import { nanoid } from 'nanoid'
import { API_PORT } from '../../config'
import path from 'path'
import type { DB, Folder, Snippet, Tag } from '@shared/types/main/db'
import type { Server } from 'http'
import type { Socket } from 'net'
import { remove } from 'lodash'
import type { SnippetWithFolder } from '@shared/types/renderer/store/snippets'
import { BrowserWindow } from 'electron'

interface ServerWithDestroy extends Server {
  destroy: Function
}

export class ApiServer {
  server: ServerWithDestroy
  connections: Record<string, Socket> = {}

  constructor () {
    this.server = this.create()
  }

  create (): ServerWithDestroy {
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

    app.get('/snippets/embed-folder', (req, res) => {
      const snippets = router.db
        .get<SnippetWithFolder[]>('snippets')
        .cloneDeep()
        .value()

      const result = snippets.map(i => {
        const folder = router.db
          .get<Folder[]>('folders')
          .find(f => f.id === i.folderId)
        if (folder) i.folder = folder.value()
        return i
      })

      res.status(200).send(result)
    })

    app.post('/snippets/delete', (req, res) => {
      const ids: string[] = req.body.ids
      const snippets = router.db.get<Snippet[]>('snippets').value()

      ids.forEach(i => {
        const index = snippets.findIndex(s => s.id === i)
        if (index !== -1) snippets.splice(index, 1)
      })

      router.db.write()

      res.sendStatus(200)
    })

    app.post('/snippets/create', (req, res) => {
      const windows = BrowserWindow.getAllWindows()
      windows[0].webContents.send('api:snippet-create', req.body)

      res.sendStatus(200)
    })

    app.delete('/tags/:id', (req, res) => {
      const id = req.params.id
      const tags = router.db.get<Tag[]>('tags').value()
      const snippets = router.db
        .get<Snippet[]>('snippets')
        .filter(i => i.tagsIds.includes(id))
        .value()
      const index = tags.findIndex(i => i.id === id)

      snippets.forEach(i => {
        remove(i.tagsIds, item => item === id)
      })

      tags.splice(index, 1)
      router.db.write()

      res.sendStatus(200)
    })

    app.get('/tags/:id/snippets', (req, res) => {
      const id = req.params.id
      const _snippets = router.db.get<Snippet[]>('snippets').value()
      const snippets = _snippets.filter(i => i.tagsIds.includes(id))

      res.status(200).send(snippets)
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

    const server = app.listen(API_PORT, () => {
      console.log(`API server is running on port ${API_PORT}`)
    }) as ServerWithDestroy

    server.on('connection', conn => {
      const key = conn.remoteAddress + ':' + conn.remotePort
      this.connections[key] = conn
      conn.on('close', () => {
        delete this.connections[key]
      })
    })

    server.destroy = () => {
      server.close()
      for (const key in this.connections) {
        this.connections[key].destroy()
      }
    }

    return server
  }

  restart () {
    console.log('API server restart...')
    this.server.destroy()
    this.server = this.create()
  }
}
