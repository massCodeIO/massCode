import type { AddressInfo, Server } from 'node:net'
import { once } from 'node:events'
import { Elysia } from 'elysia'
import { describe, expect, it } from 'vitest'

describe('api listener', () => {
  it('binds the installed Node adapter to IPv4 loopback', async () => {
    const { node } = await import('@elysiajs/node')
    const app = new Elysia({ adapter: node() }).get('/health', () => 'ok')
    const existingBeforeExitListeners = new Set(
      process.listeners('beforeExit'),
    )
    let adapterBeforeExitListeners = process
      .listeners('beforeExit')
      .slice(0, 0)
    let nodeServer: Server | undefined

    try {
      await new Promise<void>((resolve) => {
        app.listen({ hostname: '127.0.0.1', port: 0 }, (runningServer) => {
          nodeServer = (
            runningServer as typeof runningServer & {
              raw?: { node?: { server?: Server } }
            }
          ).raw?.node?.server
          resolve()
        })
      })
      adapterBeforeExitListeners = process
        .listeners('beforeExit')
        .filter(listener => !existingBeforeExitListeners.has(listener))

      if (!nodeServer) {
        throw new Error('Node adapter did not expose its server')
      }

      if (!nodeServer.listening) {
        await once(nodeServer, 'listening')
      }

      const address = nodeServer?.address()

      expect(address).not.toBeNull()
      expect(typeof address).toBe('object')
      expect((address as AddressInfo).address).toBe('127.0.0.1')
      expect((address as AddressInfo).family).toBe('IPv4')

      const response = await fetch(
        `http://127.0.0.1:${(address as AddressInfo).port}/health`,
      )
      expect(response.status).toBe(200)
      expect(await response.text()).toBe('ok')
    }
    finally {
      for (const listener of adapterBeforeExitListeners) {
        process.removeListener('beforeExit', listener)
      }

      if (nodeServer?.listening) {
        await new Promise<void>((resolve, reject) => {
          nodeServer?.close(error => (error ? reject(error) : resolve()))
        })
      }
    }
  })
})
