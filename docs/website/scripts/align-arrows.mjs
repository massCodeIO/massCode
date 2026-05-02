import { readFileSync, writeFileSync } from 'node:fs'

const file = process.argv[2]
const content = readFileSync(file, 'utf-8')
const lines = content.split('\n')
const result = []
let inBlock = false
let block = []

function flushBlock() {
  if (block.length === 0)
    return
  // Find lines with →
  const arrowLines = block.filter(l => l.includes('→'))
  if (arrowLines.length === 0) {
    result.push(...block)
    block = []
    return
  }
  // Find max position before →
  let maxLeft = 0
  for (const line of arrowLines) {
    const idx = line.indexOf('→')
    const left = line.substring(0, idx).trimEnd()
    if (left.length > maxLeft)
      maxLeft = left.length
  }
  const col = maxLeft + 4 // 4 spaces before →
  for (const line of block) {
    if (line.includes('→')) {
      const idx = line.indexOf('→')
      const left = line.substring(0, idx).trimEnd()
      const right = line.substring(idx + 1).trimStart()
      const padded = `${left.padEnd(col)}→ ${right}`
      result.push(padded)
    }
    else {
      result.push(line)
    }
  }
  block = []
}

for (const line of lines) {
  if (line.startsWith('```') && !inBlock) {
    inBlock = true
    result.push(line)
  }
  else if (line.startsWith('```') && inBlock) {
    flushBlock()
    inBlock = false
    result.push(line)
  }
  else if (inBlock) {
    block.push(line)
  }
  else {
    result.push(line)
  }
}

writeFileSync(file, result.join('\n'))
console.log('Done')
