#!/usr/bin/env node

const path = require('node:path')
const { performance } = require('node:perf_hooks')
const process = require('node:process')
const fs = require('fs-extra')

function getErrorMessage(error) {
  if (error instanceof Error) {
    const cause = error.cause
    if (cause && typeof cause === 'object' && 'message' in cause) {
      const causeMessage = String(cause.message || '').trim()
      if (causeMessage) {
        return `${error.message} (${causeMessage})`
      }
    }

    return error.message
  }

  return String(error)
}

function parseArgs(argv) {
  const options = {
    baseUrl: process.env.MASSCODE_API_URL || 'http://localhost:4321',
    fragments: 3,
    keep: false,
    query: '',
    snippets: 100,
    timeoutMs: 10_000,
    vault: '',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (argument === '--base-url') {
      options.baseUrl = String(argv[index + 1] || options.baseUrl)
      index += 1
      continue
    }

    if (argument === '--snippets') {
      options.snippets = Number(argv[index + 1] || options.snippets)
      index += 1
      continue
    }

    if (argument === '--fragments') {
      options.fragments = Number(argv[index + 1] || options.fragments)
      index += 1
      continue
    }

    if (argument === '--query') {
      options.query = String(argv[index + 1] || '')
      index += 1
      continue
    }

    if (argument === '--vault') {
      options.vault = String(argv[index + 1] || '')
      index += 1
      continue
    }

    if (argument === '--timeout') {
      options.timeoutMs = Number(argv[index + 1] || options.timeoutMs)
      index += 1
      continue
    }

    if (argument === '--keep') {
      options.keep = true
    }
  }

  options.snippets
    = Number.isFinite(options.snippets) && options.snippets > 0
      ? Math.trunc(options.snippets)
      : 100
  options.fragments
    = Number.isFinite(options.fragments) && options.fragments > 0
      ? Math.trunc(options.fragments)
      : 3
  options.timeoutMs
    = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
      ? Math.trunc(options.timeoutMs)
      : 10_000

  return options
}

async function requestJson(baseUrl, pathname, options) {
  const requestUrl = new URL(pathname, baseUrl)
  let response

  try {
    response = await fetch(requestUrl, options)
  }
  catch (error) {
    const details = getErrorMessage(error)
    throw new Error(
      [
        `Failed to reach API at ${requestUrl.origin}.`,
        'Start massCode first (for example: "pnpm dev") or pass a different URL with --base-url.',
        `Details: ${details}`,
      ].join(' '),
    )
  }

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(
      `Request failed (${response.status}) ${pathname}: ${errorBody || response.statusText}`,
    )
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

async function measure(name, callback) {
  const startedAt = performance.now()
  const result = await callback()

  return {
    duration: performance.now() - startedAt,
    name,
    result,
  }
}

function formatDuration(duration) {
  return `${duration.toFixed(2)}ms`
}

function printMetrics(metrics) {
  console.log('\nMarkdown Load Test Results')
  console.log('--------------------------')

  metrics.forEach((metric) => {
    const payload
      = metric.result && typeof metric.result === 'object'
        ? ` ${JSON.stringify(metric.result)}`
        : ''

    console.log(`${metric.name}: ${formatDuration(metric.duration)}${payload}`)
  })
}

async function waitFor(predicate, timeoutMs) {
  const startedAt = performance.now()

  while (performance.now() - startedAt <= timeoutMs) {
    if (await predicate()) {
      return true
    }

    await new Promise(resolve => setTimeout(resolve, 75))
  }

  return false
}

async function createSnippet(baseUrl, name) {
  const createdSnippet = await requestJson(baseUrl, '/snippets/', {
    body: JSON.stringify({ name }),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  })

  return createdSnippet.id
}

async function createSnippetContent(baseUrl, snippetId, label, value) {
  await requestJson(baseUrl, `/snippets/${snippetId}/contents`, {
    body: JSON.stringify({
      label,
      language: 'typescript',
      value,
    }),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  })
}

async function deleteSnippet(baseUrl, snippetId) {
  try {
    await requestJson(baseUrl, `/snippets/${snippetId}`, {
      method: 'DELETE',
    })
  }
  catch {
    // ignore cleanup errors
  }
}

async function getSnippets(baseUrl, query) {
  const searchParams = new URLSearchParams()

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return
    }

    searchParams.set(key, String(value))
  })

  const pathWithQuery = searchParams.size
    ? `/snippets/?${searchParams.toString()}`
    : '/snippets/'

  return requestJson(baseUrl, pathWithQuery, {
    method: 'GET',
  })
}

async function resetStorageCache(baseUrl) {
  await requestJson(baseUrl, '/system/storage-cache/reset', {
    method: 'POST',
  })
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const baseUrl = options.baseUrl.endsWith('/')
    ? options.baseUrl
    : `${options.baseUrl}/`

  const engineResponse = await requestJson(baseUrl, '/system/storage-engine', {
    method: 'GET',
  })

  if (engineResponse.engine !== 'markdown') {
    throw new Error(
      `Current storage engine is "${engineResponse.engine}". Switch to "markdown" before running this script.`,
    )
  }

  const syncModeResponse = await requestJson(
    baseUrl,
    '/system/storage-sync-mode',
    {
      method: 'GET',
    },
  )
  const vaultPathResponse = await requestJson(
    baseUrl,
    '/system/storage-vault-path',
    {
      method: 'GET',
    },
  )
  const vaultPath = options.vault || vaultPathResponse.vaultPath

  if (!vaultPath) {
    throw new Error('Vault path is not configured')
  }

  const runToken = Date.now()
  const snippetPrefix = `load-test-${runToken}`
  const createdSnippetIds = []

  console.log(`API: ${baseUrl}`)
  console.log(`Vault: ${vaultPath}`)
  console.log(`Sync mode: ${syncModeResponse.syncMode}`)
  console.log(
    `Preparing snippets: ${options.snippets} x ${options.fragments} fragments`,
  )

  for (
    let snippetIndex = 1;
    snippetIndex <= options.snippets;
    snippetIndex += 1
  ) {
    const snippetId = await createSnippet(
      baseUrl,
      `${snippetPrefix}-snippet-${snippetIndex}`,
    )
    createdSnippetIds.push(snippetId)

    for (
      let fragmentIndex = 1;
      fragmentIndex <= options.fragments;
      fragmentIndex += 1
    ) {
      const contentToken = `${snippetPrefix}-f-${snippetIndex}-${fragmentIndex}`

      await createSnippetContent(
        baseUrl,
        snippetId,
        `Fragment ${fragmentIndex}`,
        `export const token = '${contentToken}'`,
      )
    }
  }

  const defaultSearchQuery
    = options.query
      || `${snippetPrefix}-f-${Math.max(1, Math.floor(options.snippets / 2))}-1`

  const metrics = []

  metrics.push(
    await measure('coldStart(getSnippets after cache reset)', async () => {
      await resetStorageCache(baseUrl)
      const snippets = await getSnippets(baseUrl, {
        search: defaultSearchQuery,
      })

      return {
        matches: snippets.length,
      }
    }),
  )

  metrics.push(
    await measure('hotStart(getSnippets repeated)', async () => {
      const snippets = await getSnippets(baseUrl, {
        search: defaultSearchQuery,
      })

      return {
        matches: snippets.length,
      }
    }),
  )

  metrics.push(
    await measure('uncachedSearch(reset + search)', async () => {
      await resetStorageCache(baseUrl)
      const snippets = await getSnippets(baseUrl, {
        search: defaultSearchQuery,
      })

      return {
        matches: snippets.length,
      }
    }),
  )

  metrics.push(
    await measure('cachedSearch(repeated same query)', async () => {
      const snippets = await getSnippets(baseUrl, {
        search: defaultSearchQuery,
      })

      return {
        matches: snippets.length,
      }
    }),
  )

  if (syncModeResponse.syncMode === 'realtime') {
    const watchedSnippetName = `${snippetPrefix}-snippet-1`
    const watchedSnippetPath = path.join(
      vaultPath,
      '.masscode',
      'inbox',
      `${watchedSnippetName}.md`,
    )

    if (fs.pathExistsSync(watchedSnippetPath)) {
      const externalToken = `${snippetPrefix}-external-${Date.now()}`

      fs.appendFileSync(
        watchedSnippetPath,
        `\n\n## Fragment: External\n\
\`\`\`typescript\n\
export const external = '${externalToken}'\n\
\`\`\`\n`,
        'utf8',
      )

      metrics.push(
        await measure('watcherSync(external file change)', async () => {
          const synced = await waitFor(async () => {
            const snippets = await getSnippets(baseUrl, {
              search: externalToken,
            })

            return snippets.some(
              snippet => snippet.name === watchedSnippetName,
            )
          }, options.timeoutMs)

          return {
            synced,
            timeoutMs: options.timeoutMs,
          }
        }),
      )
    }
  }

  printMetrics(metrics)

  if (!options.keep) {
    for (const snippetId of createdSnippetIds) {
      await deleteSnippet(baseUrl, snippetId)
    }
  }
}

main().catch((error) => {
  console.error(getErrorMessage(error))
  process.exitCode = 1
})
