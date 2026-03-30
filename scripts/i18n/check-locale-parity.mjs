import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const localesDir = join(import.meta.dirname, '../../src/main/i18n/locales')
const referenceLocale = 'en_US'

function flattenKeys(obj, prefix = '') {
  const keys = []

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, path))
    }
    else {
      keys.push(path)
    }
  }

  return keys
}

function readLocaleFile(locale, file) {
  const filePath = join(localesDir, locale, file)

  try {
    const content = readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  }
  catch {
    return null
  }
}

const locales = readdirSync(localesDir, { withFileTypes: true })
  .filter(d => d.isDirectory() && d.name !== referenceLocale)
  .map(d => d.name)

const referenceFiles = readdirSync(join(localesDir, referenceLocale))
  .filter(f => f.endsWith('.json'))

const referenceKeysByFile = new Map()

for (const file of referenceFiles) {
  const data = readLocaleFile(referenceLocale, file)
  referenceKeysByFile.set(file, flattenKeys(data))
}

let hasMissing = false

for (const locale of locales) {
  const missingByFile = []

  for (const file of referenceFiles) {
    const refKeys = referenceKeysByFile.get(file)
    const data = readLocaleFile(locale, file)

    if (data === null) {
      missingByFile.push({ file, missing: refKeys })
      continue
    }

    const localeKeys = new Set(flattenKeys(data))
    const missing = refKeys.filter(k => !localeKeys.has(k))

    if (missing.length > 0) {
      missingByFile.push({ file, missing })
    }
  }

  if (missingByFile.length > 0) {
    hasMissing = true
    console.log(`\n[${locale}]`)

    for (const { file, missing } of missingByFile) {
      console.log(`  ${file} — ${missing.length} missing key(s):`)

      for (const key of missing) {
        console.log(`    - ${key}`)
      }
    }
  }
}

if (hasMissing) {
  console.log('')
  process.exit(1)
}
else {
  console.log('All locales in sync with en_US.')
}
