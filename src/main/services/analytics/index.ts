import type { TrackEvents } from '@shared/types/main/analytics'
import ua from 'universal-analytics'
import { version } from '../../../../package.json'
import { platform } from 'os'

const isDev = process.env.NODE_ENV === 'development'

const analytics = ua('UA-56182454-13')

export const track = (event: TrackEvents, payload?: string) => {
  if (isDev) return

  let os
  const p = platform()

  if (p === 'darwin') os = 'macOS'
  if (p === 'win32') os = 'Windows'

  const path = payload
    ? `${version}/${os}/${event}/${payload}`
    : `${version}/${os}/${event}`

  analytics.pageview(path).send()
}
