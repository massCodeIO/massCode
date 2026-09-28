import { createGraphqlServer } from './graphql.mjs'
import { createScriptsServer } from './scripts.mjs'
import { createShowcaseServer } from './showcase.mjs'
import { createTransportServer } from './transport.mjs'
import { createWebsocketServer } from './websocket.mjs'

export const defaultPorts = { websocket: 5188, scripts: 5189, showcase: 5190, graphql: 4399, transport: 5191, crossOrigin: 5192 }

export async function startServers(ports = {}, services = Object.keys(defaultPorts)) {
  const instances = new Map()
  const addresses = {}
  let closing
  const close = () => {
    closing ??= Promise.all([...instances.values()].map(async ({ server, sockets, dispose }) => {
      dispose?.()
      const closed = new Promise(resolve => server.close(resolve))
      for (const socket of sockets) socket.destroy()
      await closed
    }))
    return closing
  }
  const reset = () => {
    for (const instance of instances.values()) instance.reset?.()
  }
  const factories = {
    websocket: createWebsocketServer,
    scripts: createScriptsServer,
    showcase: createShowcaseServer,
    graphql: createGraphqlServer,
    transport: () => createTransportServer({ crossOrigin: () => addresses.crossOrigin, reset }),
    crossOrigin: () => createTransportServer({ crossOrigin: () => addresses.transport, reset }),
  }
  try {
    for (const name of services) {
      const port = ports[name] ?? defaultPorts[name]
      if (!Number.isInteger(port) || port < 0 || port > 65535)
        throw new Error(`Invalid ${name} port`)
      const instance = factories[name]()
      const sockets = new Set()
      instances.set(name, { ...instance, sockets })
      instance.server.on('connection', (socket) => {
        sockets.add(socket)
        socket.once('close', () => sockets.delete(socket))
      })
      await new Promise((resolve, reject) => {
        instance.server.once('error', reject)
        instance.server.listen(port, '127.0.0.1', () => {
          instance.server.removeListener('error', reject)
          resolve()
        })
      })
      addresses[name] = `${name === 'websocket' ? 'ws' : 'http'}://127.0.0.1:${instance.server.address().port}`
    }
    return { addresses, close }
  }
  catch (error) {
    await close()
    throw error
  }
}
