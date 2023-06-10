import type { TrackEvents } from '@shared/types/main/analytics'
import { version, platform } from '@/electron'
import axios from 'axios'

const isDev = import.meta.env.DEV
const api = import.meta.env.VITE_ANALYTICS_API
const scope = import.meta.env.VITE_ANALYTICS_SCOPE

export const track = (event: TrackEvents, payload?: string) => {
  let os
  const p = platform()

  if (!api) return

  if (p === 'darwin') os = 'macOS'
  if (p === 'win32') os = 'Windows'
  if (p === 'linux') os = 'Linux'

  const path = payload
    ? `${version}/${os}/${event}/${payload}`
    : `${version}/${os}/${event}`

  const body = {
    name: 'pageview',
    url: `https://${scope}/${path}`,
    domain: scope
  }

  if (isDev) {
    console.log('[analytics]:', body)
  } else {
    axios.post(api, body)
  }
}
