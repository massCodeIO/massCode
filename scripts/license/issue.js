/**
 * Выпуск supporter-лицензии, подписанной приватным ключом Ed25519.
 *
 * Запуск: pnpm license:issue --email john@example.com [--name "John Doe"]
 */
const { Buffer } = require('node:buffer')
const { createPrivateKey, sign } = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const process = require('node:process')

const privateKeyPath
  = process.env.MASSCODE_LICENSE_PRIVATE_KEY
    || path.join(os.homedir(), '.masscode', 'license-private.pem')

function getArg(name) {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1 || index === process.argv.length - 1) {
    return undefined
  }
  return process.argv[index + 1]
}

const name = getArg('name')
const email = getArg('email')

if (!email) {
  console.error(
    'Usage: pnpm license:issue --email john@example.com [--name "John Doe"]',
  )
  process.exit(1)
}

if (!fs.existsSync(privateKeyPath)) {
  console.error(`Private key not found: ${privateKeyPath}`)
  console.error('Run "node scripts/license/keygen.js" first.')
  process.exit(1)
}

const privateKey = createPrivateKey(fs.readFileSync(privateKeyPath))

const payload = {
  email,
  ...(name ? { name } : {}),
  issuedAt: new Date().toISOString().slice(0, 10),
}

const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
  'base64url',
)
const signature = sign(null, Buffer.from(payloadBase64), privateKey).toString(
  'base64url',
)

console.log(`${payloadBase64}.${signature}`)
