import 'dotenv/config'
import type { TrackEvents } from '@shared/types/main/analytics'
import { version } from '../../../../package.json'
import { platform } from 'os'
import axios from 'axios'

const isDev = process.env.NODE_ENV === 'development'

export const track = (event: TrackEvents, payload?: string) => {
  let os
  const p = platform()

  if (p === 'darwin') os = 'macOS'
  if (p === 'win32') os = 'Windows'
  if (p === 'linux') os = 'Linux'

  const api = process.env.APP_ANALYTICS_API || 'http://localhost'

  const path = payload
    ? `${version}/${os}/${event}/${payload}`
    : `${version}/${os}/${event}`

  const body = {
    name: 'pageview',
    url: `https://${process.env.APP_ANALYTICS_DOMAIN}/${path}`,
    domain: process.env.APP_ANALYTICS_DOMAIN
  }

  if (isDev) {
    if (process.env.DEBUG?.includes('analytics')) {
      console.log('[analytics]:', path)
    }
  } else {
    axios.post(api, body)
  }
}
