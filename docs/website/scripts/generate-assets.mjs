import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const pkg = JSON.parse(readFileSync(join(__dirname, '../../../package.json'), 'utf-8'))

const version = pkg.version
const tagName = `v${version}`
const downloadUrl = `https://github.com/massCodeIO/massCode/releases/download/${tagName}`

const assets = {
  version,
  mac: `${downloadUrl}/massCode-${version}.dmg`,
  macM1: `${downloadUrl}/massCode-${version}-arm64.dmg`,
  win: `${downloadUrl}/massCode-${version}-x64.exe`,
  winPortable: `${downloadUrl}/massCode-${version}-x64-portable.exe`,
  linux: `${downloadUrl}/massCode-${version}.AppImage`,
}

const dist = join(__dirname, '../.vitepress/_data')
mkdirSync(dist, { recursive: true })
writeFileSync(join(dist, 'assets.json'), JSON.stringify(assets, null, 2))

console.log(`Generated assets.json for v${version}`)
