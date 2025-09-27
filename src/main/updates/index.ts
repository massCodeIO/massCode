/* eslint-disable node/prefer-global/process */
import { repository, version } from '../../../package.json'
import { send } from '../ipc'

interface GitHubRelease {
  tag_name: string
}

const INTERVAL = 1000 * 60 * 60 * 3 // 3 часа
const isDev = process.env.NODE_ENV === 'development'

export async function fethUpdates() {
  if (isDev) {
    return
  }

  try {
    const url = `${repository.replace('github.com', 'api.github.com/repos')}/releases`

    const response = await fetch(url)
    const data = (await response.json()) as GitHubRelease[]

    if (!data) {
      return
    }

    const releases = data.filter((release) => {
      const tagName = release.tag_name.replace('v', '')
      return tagName.startsWith('4.')
    })

    if (releases.length > 0) {
      const latestRelease = releases[0]
      const latestVersion = latestRelease.tag_name.replace('v', '')

      if (latestVersion !== version) {
        send('system:update-available')
        return latestVersion as string
      }
    }
  }
  catch (err) {
    console.error('Error checking for updates:', err)
  }
}

export function checkForUpdates() {
  fethUpdates()

  setInterval(() => {
    fethUpdates()
  }, INTERVAL)
}
