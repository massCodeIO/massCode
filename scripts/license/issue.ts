/**
 * Выпуск supporter-лицензии, подписанной приватным ключом Ed25519.
 *
 * Запуск: pnpm license:issue --name "John Doe" [--email john@example.com]
 */
import { Buffer } from 'node:buffer'
import { createPrivateKey, sign } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const privateKeyPath
  = process.env.MASSCODE_LICENSE_PRIVATE_KEY
    || path.join(os.homedir(), '.masscode', 'license-private.pem')

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1 || index === process.argv.length - 1) {
    return undefined
  }
  return process.argv[index + 1]
}

const name = getArg('name')
const email = getArg('email')

if (!name) {
  console.error(
    'Usage: pnpm license:issue --name "John Doe" [--email john@example.com]',
  )
  process.exit(1)
}

if (!fs.existsSync(privateKeyPath)) {
  console.error(`Private key not found: ${privateKeyPath}`)
  console.error('Run "bun scripts/license/keygen.ts" first.')
  process.exit(1)
}

const privateKey = createPrivateKey(fs.readFileSync(privateKeyPath))

const payload = {
  name,
  ...(email ? { email } : {}),
  issuedAt: new Date().toISOString().slice(0, 10),
}

const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
  'base64url',
)
const signature = sign(null, Buffer.from(payloadBase64), privateKey).toString(
  'base64url',
)

console.log(`${payloadBase64}.${signature}`)
