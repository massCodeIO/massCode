import 'dotenv/config'
import * as jsonServer from 'json-server'
import { store } from '../../store'
import type { Server } from 'http'
import type { Socket } from 'net'
interface ServerWithDestroy extends Server {
  destroy: Function
}

const enableDestroy = (server: ServerWithDestroy) => {
  const connections: Record<string, Socket> = {}

  server.on('connection', conn => {
    const key = conn.remoteAddress + ':' + conn.remotePort
    connections[key] = conn
    conn.on('close', () => {
      delete connections[key]
    })
  })

  server.destroy = () => {
    server.close()
    for (const key in connections) {
      connections[key].destroy()
    }
  }
}

export const createApiServer = () => {
  const db = store.preferences.get('storagePath') + '/db.json'
  const app = jsonServer.create()
  const middlewares = jsonServer.defaults()
  const router = jsonServer.router(db)

  app.get('/restart', (req, res) => {
    server.destroy()
    createApiServer()
    console.log('API server is restart...')

    res.status(200)
  })

  app.use(middlewares)
  app.use(router)

  const server = app.listen(process.env.VITE_APP_API_PORT, () => {
    console.log(
      `API server is running on port ${process.env.VITE_APP_API_PORT}`
    )
  }) as ServerWithDestroy

  enableDestroy(server)
}
