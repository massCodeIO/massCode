const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { variedDocumentFor } = require('./varied-corpus.cjs')

const markerName = '.masscode-benchmark.json'
function validateRoot(value) {
  const root = fs.realpathSync(value)
  const marker = JSON.parse(fs.readFileSync(path.join(root, markerName), 'utf8'))
  if (marker.version !== 1 || marker.root !== root)
    throw new Error('Invalid benchmark root marker')
  for (const name of ['profile', 'vault']) {
    if (fs.realpathSync(path.join(root, name)) !== path.join(root, name))
      throw new Error(`Benchmark ${name} must not be a symlink`)
  }
  return { root, marker }
}
function documentFor(seed, index, space, corpus = 'repeated') {
  if (corpus === 'varied')
    return variedDocumentFor(seed, index, space)
  if (corpus !== 'repeated')
    throw new Error('Unknown benchmark corpus')
  const size = [512, 4096, 32768][index % 3]
  const token = crypto.createHash('sha256').update(`${seed}:${space}:${index}`).digest('hex')
  const line = space === 'notes' ? `- benchmark needle ${token}\n` : `// benchmark needle ${token}\n`
  const body = line.repeat(Math.ceil(size / line.length)).slice(0, size)
  return { name: `bench-${space}-${String(index).padStart(6, '0')}`, body }
}
module.exports = { validateRoot, markerName, documentFor }
