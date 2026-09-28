import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, expect, it } from 'vitest'

let root: string | undefined
afterEach(() => {
  if (root)
    fs.rmSync(root, { recursive: true, force: true })
})
it('reports insufficient samples without p95 and rejects invalid timings', () => {
  root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'masscode-report-test-')),
  )
  for (const directory of ['profile', 'vault'])
    fs.mkdirSync(path.join(root, directory))
  fs.writeFileSync(
    path.join(root, '.masscode-benchmark.json'),
    JSON.stringify({ version: 1, root }),
  )
  const events = path.join(root, 'events.jsonl')
  fs.writeFileSync(
    events,
    `${JSON.stringify({ name: 'code.list.state-presented', durationMs: 12, status: 'ok' })}\n`,
  )
  const run = () =>
    spawnSync(
      process.execPath,
      ['scripts/benchmark/cli.cjs', 'report', '--output', root!],
      { encoding: 'utf8' },
    )
  expect(run().status).toBe(0)
  expect(fs.readFileSync(path.join(root, 'report.md'), 'utf8')).toContain(
    '| 1 | 12.00 | — | 12.00 |',
  )
  fs.writeFileSync(
    events,
    `${JSON.stringify({ name: 'code.list.state-presented', durationMs: -1, status: 'ok' })}\n`,
  )
  expect(run().status).not.toBe(0)
})
