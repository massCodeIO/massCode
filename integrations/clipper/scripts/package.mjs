import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const targets = ['chrome', 'firefox', 'safari']
const requestedTargets = process.argv.slice(2)
const packageTargets = requestedTargets.length > 0 ? requestedTargets : targets
const buildsDir = resolve(root, 'builds')

mkdirSync(buildsDir, { recursive: true })

for (const target of packageTargets) {
  if (!targets.includes(target)) {
    throw new Error(`Unsupported clipper package target: ${target}`)
  }

  const targetDir = resolve(root, 'dist', target)
  const manifestPath = resolve(targetDir, 'manifest.json')

  if (!existsSync(manifestPath)) {
    throw new Error(`Build ${target} before packaging it.`)
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const version = manifest.version
  const archiveName = `masscode-clipper-${version}-${target}.zip`
  const archivePath = resolve(buildsDir, archiveName)

  rmSync(archivePath, { force: true })

  const result = spawnSync('zip', ['-r', '-X', archivePath, '.'], {
    cwd: targetDir,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    throw new Error(`Failed to package ${target}.`)
  }

  console.log(`Created ${archivePath}`)
}
