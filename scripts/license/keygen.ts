/**
 * Одноразовая генерация пары ключей Ed25519 для supporter-лицензий.
 *
 * Приватный ключ сохраняется в ~/.masscode/license-private.pem и никогда
 * не должен попадать в репозиторий. Публичный ключ выводится в stdout —
 * его нужно вшить в src/main/license/index.ts (LICENSE_PUBLIC_KEY).
 *
 * Запуск: bun scripts/license/keygen.ts
 */
import { generateKeyPairSync } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const privateKeyDir = path.join(os.homedir(), '.masscode')
const privateKeyPath = path.join(privateKeyDir, 'license-private.pem')

if (fs.existsSync(privateKeyPath)) {
  console.error(`Private key already exists: ${privateKeyPath}`)
  console.error(
    'Remove it manually if you really want to generate a new pair.',
  )
  process.exit(1)
}

const { publicKey, privateKey } = generateKeyPairSync('ed25519')

fs.mkdirSync(privateKeyDir, { recursive: true })
fs.writeFileSync(
  privateKeyPath,
  privateKey.export({ type: 'pkcs8', format: 'pem' }),
  { mode: 0o600 },
)

const publicKeyBase64 = publicKey
  .export({ type: 'spki', format: 'der' })
  .toString('base64')

console.log(`Private key saved to: ${privateKeyPath}`)
console.log('')
console.log('Public key (embed into src/main/license/index.ts):')
console.log(publicKeyBase64)
