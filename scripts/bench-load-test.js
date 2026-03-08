#!/usr/bin/env node

const { performance } = require('node:perf_hooks')
const process = require('node:process')

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
  console.log('\nLoad Test Results')
  console.log('-----------------')

  metrics.forEach((metric) => {
    const payload
      = metric.result && typeof metric.result === 'object'
        ? ` ${JSON.stringify(metric.result)}`
        : ''

    console.log(`${metric.name}: ${formatDuration(metric.duration)}${payload}`)
  })
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

  const runToken = Date.now()
  const snippetPrefix = `load-test-${runToken}`
  const createdSnippetIds = []

  console.log(`API: ${baseUrl}`)
  console.log(`Engine: ${engineResponse.engine}`)
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
