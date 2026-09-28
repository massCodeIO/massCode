import type { CookieState } from './jar'
import { createHash } from 'node:crypto'
import path from 'node:path'
import Store from 'electron-store'
import { getVaultPath } from '../../storage/providers/markdown/runtime/paths'
import { HttpCookieJar } from './jar'

let storage: Store<{ vaults: Record<string, CookieState> }> | undefined
const listeners = new Set<() => void>()
export function onHttpCookiesChanged(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
const jars = new Map<string, HttpCookieJar>()
export function getHttpCookieJar() {
  const key = createHash('sha256')
    .update(path.resolve(getVaultPath()))
    .digest('hex')
  let jar = jars.get(key)
  if (!jar) {
    storage ??= new Store({
      name: 'http-cookies',
      cwd: 'v2',
      defaults: { vaults: {} },
    })
    const saved = storage.get('vaults')[key]
    jar = new HttpCookieJar(saved, (state) => {
      storage!.set('vaults', { ...storage!.get('vaults'), [key]: state })
      listeners.forEach(listener => listener())
    })
    jars.set(key, jar)
  }
  return jar
}
