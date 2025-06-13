import axios from 'axios'
import { BrowserWindow } from 'electron'
import { version, repository } from '../../../package.json'

const isDev = process.env.NODE_ENV === 'development'

export const checkForUpdate = async () => {
  if (isDev) return

  try {
    const res = await axios.get(
      `${repository.replace('github.com', 'api.github.com/repos')}/releases`
    )

    if (res && res.data) {
      // Проверяем оставшиеся запросы в лимите
      const rateLimitRemaining = res.headers['x-ratelimit-remaining']
      if (rateLimitRemaining && parseInt(rateLimitRemaining) < 5) {
        console.warn(
          'GitHub API rate limit близок к исчерпанию:',
          rateLimitRemaining
        )
      }

      const v3Releases = res.data.filter((release: any) => {
        const tagName = release.tag_name.replace('v', '')
        return tagName.startsWith('3.')
      })

      if (v3Releases.length > 0) {
        const latestV3Release = v3Releases[0]
        const latestVersion = latestV3Release.tag_name.replace('v', '')

        if (latestVersion !== version) {
          BrowserWindow.getFocusedWindow()?.webContents.send(
            'main:update-available'
          )
          return latestVersion
        }
      }
    }
  } catch (err: any) {
    // Обработка лимита GitHub API
    if (err.response?.status === 403 || err.response?.status === 429) {
      const resetTime = err.response.headers['x-ratelimit-reset']
      if (resetTime) {
        const resetDate = new Date(parseInt(resetTime) * 1000)
        console.warn(
          'GitHub API rate limit exceeded. Reset at:',
          resetDate.toISOString()
        )
      } else {
        console.warn('GitHub API rate limit exceeded')
      }
      return
    }

    console.error('Error checking for updates:', err.message || err)
  }
}

export const checkForUpdateWithInterval = () => {
  checkForUpdate()

  setInterval(() => {
    checkForUpdate()
  }, 1000 * 60 * 360) // 6 часов
}
