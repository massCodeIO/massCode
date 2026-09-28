import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outputPath = join(__dirname, '../.vitepress/_data/github-stats.json')
const repository = 'massCodeIO/massCode'
const startYear = 2019

async function readExistingStats() {
  try {
    return JSON.parse(await readFile(outputPath, 'utf-8'))
  }
  catch {
    return {
      repository,
      stars: 0,
      releaseDownloads: 0,
      activeDevelopmentStartYear: startYear,
      activeDevelopmentYears: new Date().getUTCFullYear() - startYear,
      updatedAt: null,
    }
  }
}

function createHeaders() {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'masscode-docs-build',
    'X-GitHub-Api-Version': '2022-11-28',
  }

  // eslint-disable-next-line node/prefer-global/process
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN

  if (token)
    headers.Authorization = `Bearer ${token}`

  return headers
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: createHeaders() })

  if (!response.ok)
    throw new Error(`GitHub API returned ${response.status} for ${url}`)

  return response.json()
}

async function fetchAllReleases() {
  const releases = []
  let page = 1

  while (true) {
    const batch = await fetchJson(`https://api.github.com/repos/${repository}/releases?per_page=100&page=${page}`)

    if (!Array.isArray(batch) || batch.length === 0)
      break

    releases.push(...batch)

    if (batch.length < 100)
      break

    page += 1
  }

  return releases
}

function getReleaseDownloads(releases) {
  return releases.reduce((total, release) => {
    if (release.draft)
      return total

    return total + release.assets.reduce((assetTotal, asset) => assetTotal + asset.download_count, 0)
  }, 0)
}

async function updateStats() {
  const existingStats = await readExistingStats()

  try {
    const [repo, releases] = await Promise.all([
      fetchJson(`https://api.github.com/repos/${repository}`),
      fetchAllReleases(),
    ])

    const stats = {
      repository,
      stars: repo.stargazers_count,
      releaseDownloads: getReleaseDownloads(releases),
      activeDevelopmentStartYear: startYear,
      activeDevelopmentYears: new Date().getUTCFullYear() - startYear,
      updatedAt: new Date().toISOString(),
    }

    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, `${JSON.stringify(stats, null, 2)}\n`)

    console.log(`Updated GitHub stats: ${stats.stars} stars, ${stats.releaseDownloads} release downloads`)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    console.warn(`Could not update GitHub stats, using existing values: ${message}`)

    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, `${JSON.stringify(existingStats, null, 2)}\n`)
  }
}

await updateStats()
