import 'dotenv/config'
import * as jsonServer from 'json-server'
import { store } from '../../store'

export const createApiServer = () => {
  const db = store.preferences.get('storagePath') + '/db.json'
  const server = jsonServer.create()
  const middlewares = jsonServer.defaults()
  const router = jsonServer.router(db)

  server.use(middlewares)
  server.use(router)
  server.listen(process.env.VITE_APP_API_PORT, () => {
    console.log(
      `API server is running on port ${process.env.VITE_APP_API_PORT}`
    )
  })
}
