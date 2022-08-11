import 'dotenv/config'
import type { TrackEvents } from '@shared/types/main/analytics'
import ua from 'universal-analytics'
import { version } from '../../../../package.json'
import { platform } from 'os'

const isDev = process.env.NODE_ENV === 'development'

const analytics = ua('UA-56182454-13')

export const track = (event: TrackEvents, payload?: string) => {
  let os
  const p = platform()

  if (p === 'darwin') os = 'macOS'
  if (p === 'win32') os = 'Windows'
  if (p === 'linux') os = 'Linux'

  const path = payload
    ? `${version}/${os}/${event}/${payload}`
    : `${version}/${os}/${event}`

  if (isDev && process.env.DEBUG?.includes('analytics')) {
    console.log('[analytics]:', path)
  } else {
    analytics.pageview(path).send()
  }
}
