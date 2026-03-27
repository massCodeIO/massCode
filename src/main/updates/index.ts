/* eslint-disable node/prefer-global/process */
import { repository, version } from '../../../package.json'
import { send } from '../ipc'
import { store } from '../store'

interface GitHubRelease {
  tag_name: string
}

const INTERVAL = 1000 * 60 * 60 * 3 // 3 часа
const isDev = process.env.NODE_ENV === 'development'
const currentVersionParts = parseVersion(version)!
const currentMajorVersion = currentVersionParts[0]

function parseVersion(rawVersion: string): [number, number, number] | null {
  const normalizedVersion = rawVersion.trim().replace(/^v/, '')
  const match = normalizedVersion.match(/^(\d+)\.(\d+)\.(\d+)$/)

  if (!match) {
    return null
  }

  return [
    Number.parseInt(match[1], 10),
    Number.parseInt(match[2], 10),
    Number.parseInt(match[3], 10),
  ]
}

function compareVersions(
  left: [number, number, number],
  right: [number, number, number],
): 1 | -1 | 0 {
  for (let i = 0; i < 3; i += 1) {
    if (left[i] === right[i]) {
      continue
    }

    return left[i] > right[i] ? 1 : -1
  }

  return 0
}

function getLatestReleaseVersion(releases: GitHubRelease[]) {
  let latestParsedVersion: [number, number, number] | null = null

  for (const release of releases) {
    const parsedVersion = parseVersion(release.tag_name)
    if (!parsedVersion || parsedVersion[0] !== currentMajorVersion) {
      continue
    }

    if (
      !latestParsedVersion
      || compareVersions(parsedVersion, latestParsedVersion) > 0
    ) {
      latestParsedVersion = parsedVersion
    }
  }

  return latestParsedVersion?.join('.')
}

function isNewerVersion(versionToCompare: string) {
  const parsedVersion = parseVersion(versionToCompare)
  if (!parsedVersion) {
    return false
  }

  return compareVersions(parsedVersion, currentVersionParts) > 0
}

export async function fetchUpdates() {
  if (isDev) {
    return
  }

  try {
    const url = `${repository.replace('github.com', 'api.github.com/repos')}/releases`

    const response = await fetch(url)
    if (!response.ok) {
      return
    }

    const data = (await response.json()) as GitHubRelease[]
    if (!Array.isArray(data) || data.length === 0) {
      return
    }

    const latestVersion = getLatestReleaseVersion(data)
    if (latestVersion && isNewerVersion(latestVersion)) {
      return latestVersion
    }
  }
  catch (err) {
    console.error('Error checking for updates:', err)
  }
}

async function notifyAboutUpdate() {
  const latestVersion = await fetchUpdates()
  if (!latestVersion) {
    return
  }

  const lastNotifiedVersion = store.app.get(
    'notifications.lastNotifiedUpdateVersion',
  )
  if (lastNotifiedVersion === latestVersion) {
    return
  }

  send('system:update-available')
  store.app.set('notifications.lastNotifiedUpdateVersion', latestVersion)
}

export function checkForUpdates() {
  void notifyAboutUpdate()

  setInterval(() => {
    void notifyAboutUpdate()
  }, INTERVAL)
}
