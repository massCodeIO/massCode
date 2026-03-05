#!/usr/bin/env node

const { performance } = require('node:perf_hooks')
const process = require('node:process')

const ALLOWED_SNIPPETS = [1000, 5000, 10000]
const ALLOWED_FRAGMENTS = [3, 4]
const DEFAULT_BASE_URL
  = process.env.MASSCODE_API_URL || 'http://localhost:4321'
const DEFAULT_CONCURRENCY = 6
const DEFAULT_PREFIX = 'seed'

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

function parseInteger(value, fallback) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  const integer = Math.trunc(parsed)
  return integer > 0 ? integer : fallback
}

function parseArgs(argv) {
  const options = {
    all: false,
    baseUrl: DEFAULT_BASE_URL,
    concurrency: DEFAULT_CONCURRENCY,
    fragments: 3,
    help: false,
    prefix: DEFAULT_PREFIX,
    profiles: '',
    snippets: 1000,
    token: Date.now().toString(36),
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (argument === '--help' || argument === '-h') {
      options.help = true
      continue
    }

    if (argument === '--all') {
      options.all = true
      continue
    }

    if (argument === '--base-url') {
      options.baseUrl = String(argv[index + 1] || options.baseUrl)
      index += 1
      continue
    }

    if (argument === '--snippets') {
      options.snippets = parseInteger(argv[index + 1], options.snippets)
      index += 1
      continue
    }

    if (argument === '--fragments') {
      options.fragments = parseInteger(argv[index + 1], options.fragments)
      index += 1
      continue
    }

    if (argument === '--concurrency') {
      options.concurrency = parseInteger(argv[index + 1], options.concurrency)
      index += 1
      continue
    }

    if (argument === '--prefix') {
      options.prefix
        = String(argv[index + 1] || options.prefix).trim() || options.prefix
      index += 1
      continue
    }

    if (argument === '--token') {
      options.token
        = String(argv[index + 1] || options.token).trim() || options.token
      index += 1
      continue
    }

    if (argument === '--profiles') {
      options.profiles = String(argv[index + 1] || '')
      index += 1
      continue
    }
  }

  options.concurrency = Math.max(1, options.concurrency)

  return options
}

function printHelp() {
  console.log(`
Fake snippets seed for benchmarking.

Usage:
  node scripts/bench-seed.js [options]

Options:
  --snippets <count>       Allowed: ${ALLOWED_SNIPPETS.join(', ')} (default: 1000)
  --fragments <count>      Allowed: ${ALLOWED_FRAGMENTS.join(', ')} (default: 3)
  --profiles <list>        Comma-separated profiles: "1000x3,5000x4"
  --all                    Generate all profiles: 1000/5000/10000 x 3/4
  --concurrency <count>    Parallel workers (default: ${DEFAULT_CONCURRENCY})
  --base-url <url>         API base URL (default: ${DEFAULT_BASE_URL})
  --prefix <value>         Name prefix (default: ${DEFAULT_PREFIX})
  --token <value>          Dataset token (default: generated from timestamp)
  --help                   Show this help
`)
}

function validateProfile(profile) {
  if (!ALLOWED_SNIPPETS.includes(profile.snippets)) {
    throw new Error(
      `Unsupported snippets count "${profile.snippets}". Allowed values: ${ALLOWED_SNIPPETS.join(', ')}`,
    )
  }

  if (!ALLOWED_FRAGMENTS.includes(profile.fragments)) {
    throw new Error(
      `Unsupported fragments count "${profile.fragments}". Allowed values: ${ALLOWED_FRAGMENTS.join(', ')}`,
    )
  }
}

function parseProfile(value) {
  const match = value.trim().match(/^(\d+)x(\d+)$/i)
  if (!match) {
    throw new Error(
      `Invalid profile "${value}". Expected format: <snippets>x<fragments>, for example 1000x3`,
    )
  }

  const profile = {
    snippets: Number(match[1]),
    fragments: Number(match[2]),
  }

  validateProfile(profile)
  return profile
}

function resolveProfiles(options) {
  if (options.all) {
    return ALLOWED_SNIPPETS.flatMap(snippets =>
      ALLOWED_FRAGMENTS.map(fragments => ({ fragments, snippets })),
    )
  }

  if (options.profiles.trim()) {
    const uniqueProfiles = new Map()

    options.profiles
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
      .forEach((item) => {
        const profile = parseProfile(item)
        uniqueProfiles.set(`${profile.snippets}x${profile.fragments}`, profile)
      })

    if (uniqueProfiles.size === 0) {
      throw new Error('No valid profiles provided')
    }

    return [...uniqueProfiles.values()]
  }

  const profile = {
    fragments: options.fragments,
    snippets: options.snippets,
  }

  validateProfile(profile)
  return [profile]
}

function normalizeBaseUrl(value) {
  return value.endsWith('/') ? value : `${value}/`
}

async function requestJson(baseUrl, pathname, options) {
  const requestUrl = new URL(pathname, baseUrl)
  let response

  try {
    response = await fetch(requestUrl, options)
  }
  catch (error) {
    throw new Error(
      `Failed to reach API at ${requestUrl.origin}. Start massCode first (for example: "pnpm dev"). Details: ${getErrorMessage(error)}`,
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

function formatDuration(durationMs) {
  if (durationMs < 1_000) {
    return `${durationMs.toFixed(0)}ms`
  }

  const seconds = durationMs / 1_000
  if (seconds < 60) {
    return `${seconds.toFixed(2)}s`
  }

  return `${(seconds / 60).toFixed(2)}m`
}

function buildSnippetName(options, profile, snippetIndex) {
  return [
    options.prefix,
    options.token,
    `${profile.snippets}x${profile.fragments}`,
    'snippet',
    String(snippetIndex).padStart(5, '0'),
  ].join('-')
}

function buildFragmentBody(options, profile, snippetIndex, fragmentIndex) {
  const token = [
    options.prefix,
    options.token,
    profile.snippets,
    profile.fragments,
    snippetIndex,
    fragmentIndex,
  ].join('-')

  return [
    '// Generated by bench-seed.js',
    `export const seedToken = '${token}'`,
    `export const profile = '${profile.snippets}x${profile.fragments}'`,
    `export const snippetIndex = ${snippetIndex}`,
    `export const fragmentIndex = ${fragmentIndex}`,
  ].join('\n')
}

async function runProfile(baseUrl, options, profile) {
  const total = profile.snippets
  const workerCount = Math.min(total, options.concurrency)
  const profileLabel = `${profile.snippets}x${profile.fragments}`
  const startedAt = performance.now()

  let completed = 0
  let nextSnippetIndex = 1
  let workerError = null

  console.log(`\n[${profileLabel}] Start seeding`)
  console.log(`[${profileLabel}] Snippets: ${profile.snippets}`)
  console.log(`[${profileLabel}] Fragments per snippet: ${profile.fragments}`)
  console.log(`[${profileLabel}] Workers: ${workerCount}`)
  console.log(`[${profileLabel}] Prefix: ${options.prefix}`)
  console.log(`[${profileLabel}] Token: ${options.token}`)

  const progressTimer = setInterval(() => {
    const percent = ((completed / total) * 100).toFixed(1)
    console.log(
      `[${profileLabel}] Progress: ${completed}/${total} (${percent}%)`,
    )
  }, 5_000)

  async function worker() {
    while (!workerError) {
      const snippetIndex = nextSnippetIndex
      nextSnippetIndex += 1

      if (snippetIndex > total) {
        return
      }

      const snippetName = buildSnippetName(options, profile, snippetIndex)

      try {
        const snippetId = await createSnippet(baseUrl, snippetName)

        for (
          let fragmentIndex = 1;
          fragmentIndex <= profile.fragments;
          fragmentIndex += 1
        ) {
          const fragmentBody = buildFragmentBody(
            options,
            profile,
            snippetIndex,
            fragmentIndex,
          )
          await createSnippetContent(
            baseUrl,
            snippetId,
            `Fragment ${fragmentIndex}`,
            fragmentBody,
          )
        }
      }
      catch (error) {
        workerError = new Error(
          `Profile ${profileLabel}: failed at snippet #${snippetIndex} ("${snippetName}"). ${getErrorMessage(error)}`,
        )
      }
      finally {
        completed += 1
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  clearInterval(progressTimer)

  if (workerError) {
    throw workerError
  }

  const durationMs = performance.now() - startedAt
  console.log(`[${profileLabel}] Completed in ${formatDuration(durationMs)}`)

  return {
    durationMs,
    fragments: profile.fragments,
    snippets: profile.snippets,
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  const profiles = resolveProfiles(options)
  const baseUrl = normalizeBaseUrl(options.baseUrl)

  const engineResponse = await requestJson(baseUrl, '/system/storage-engine', {
    method: 'GET',
  })

  console.log(`API: ${baseUrl}`)
  console.log(`Engine: ${engineResponse.engine}`)
  console.log(
    `Profiles: ${profiles.map(p => `${p.snippets}x${p.fragments}`).join(', ')}`,
  )

  const summary = []

  for (const profile of profiles) {
    summary.push(await runProfile(baseUrl, options, profile))
  }

  console.log('\nSeeding summary')
  console.log('--------------')
  summary.forEach((result) => {
    console.log(
      `${result.snippets}x${result.fragments}: ${formatDuration(result.durationMs)}`,
    )
  })
}

main().catch((error) => {
  console.error(getErrorMessage(error))
  process.exitCode = 1
})
