const { spawnSync } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const process = require('node:process')
const { parseArgs } = require('node:util')
const { validateRoot, markerName } = require('./common.cjs')

const repo = path.resolve(__dirname, '../..')
const { positionals, values } = parseArgs({ allowPositionals: true, options: {
  output: { type: 'string' },
  count: { type: 'string', default: '1000' },
  space: { type: 'string', default: 'mixed' },
  seed: { type: 'string', default: 'masscode-pilot-1' },
  port: { type: 'string', default: '54321' },
} })
function run(command, args, env = {}) {
  const environment = { ...process.env, ...env }
  delete environment.ELECTRON_RUN_AS_NODE
  const result = spawnSync(command, args, { cwd: repo, stdio: 'inherit', env: environment })
  if (result.error || result.status !== 0)
    throw result.error || new Error(`${command} exited with ${result.status}`)
}
function git(args) {
  return spawnSync('git', args, { cwd: repo, encoding: 'utf8' }).stdout.trim()
}
const command = positionals[0]
if (command === 'prepare') {
  const count = Number(values.count)
  const port = Number(values.port)
  if (!Number.isSafeInteger(count) || count < 1 || count > 100000 || !['mixed', 'all', 'code', 'notes', 'http'].includes(values.space))
    throw new Error('Expected count 1..100000 and space mixed|all|code|notes|http')
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error('Expected port 1024..65535')
  const output = path.resolve(values.output || path.join(repo, 'docs/benchmarks', `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`))
  if (fs.existsSync(output))
    throw new Error('Output already exists; choose a new benchmark directory')
  fs.mkdirSync(output, { recursive: true })
  const root = fs.realpathSync(output)
  fs.mkdirSync(path.join(root, 'profile/v2'), { recursive: true })
  fs.mkdirSync(path.join(root, 'vault'))
  const marker = { version: 1, root, count, space: values.space, seed: values.seed, port }
  fs.writeFileSync(path.join(root, markerName), JSON.stringify(marker, null, 2))
  fs.writeFileSync(path.join(root, 'profile/v2/preferences.json'), JSON.stringify({ storage: { rootPath: path.join(root, 'vault'), vaultPath: path.join(root, 'vault'), sqliteMigrated: true }, api: { port }, updates: { autoUpdate: false } }))
  const manifest = { ...marker, createdAt: new Date().toISOString(), commit: git(['rev-parse', 'HEAD']), dirty: git(['status', '--porcelain']), buildMode: 'production', packageVersion: require('../../package.json').version, node: process.versions.node, electron: require('electron/package.json').version, platform: os.platform(), release: os.release(), arch: os.arch(), cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, memoryBytes: os.totalmem() }
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2))
  fs.copyFileSync(path.join(repo, 'package.json'), path.join(root, 'package.json'))
  fs.symlinkSync(path.join(repo, 'node_modules'), path.join(root, 'node_modules'), 'dir')
  run('pnpm', ['exec', 'tsc', '-p', 'tsconfig.main.json', '--outDir', path.join(root, 'build')])
  fs.cpSync(path.join(repo, 'src/main/i18n/locales'), path.join(root, 'build/main/i18n/locales'), { recursive: true })
  run('pnpm', ['exec', 'vite', 'build', '--outDir', path.join(root, 'build/renderer')])
  run(require('electron'), [path.join(__dirname, 'bootstrap.cjs'), 'seed', root], { NODE_ENV: 'production' })
  console.log(`Prepared: ${root}\nStart: pnpm bench:start --output '${root}'`)
}
else if (command === 'start') {
  if (!values.output)
    throw new Error('--output is required')
  const { root } = validateRoot(values.output)
  if (!fs.existsSync(path.join(root, 'seed.json')))
    throw new Error('Seed did not complete')
  let executable = require('electron')
  if (process.platform === 'darwin') {
    const bundle = path.join(root, 'runtime/massCode Benchmark.app')
    const ready = path.join(root, 'runtime/ready.json')
    if (!fs.existsSync(ready)) {
      if (fs.existsSync(bundle))
        throw new Error('Incomplete benchmark runtime; use a new output directory')
      fs.cpSync(path.resolve(executable, '../../..'), bundle, { recursive: true, verbatimSymlinks: true })
      const plist = path.join(bundle, 'Contents/Info.plist')
      const identifier = `io.masscode.benchmark.${crypto.createHash('sha256').update(root).digest('hex').slice(0, 12)}`
      for (const [key, value] of Object.entries({ CFBundleIdentifier: identifier, CFBundleName: 'massCode Benchmark', CFBundleDisplayName: 'massCode Benchmark' }))
        run('/usr/bin/plutil', ['-replace', key, '-string', value, plist])
      run('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', bundle])
      fs.writeFileSync(ready, JSON.stringify({ identifier }))
    }
    executable = path.join(bundle, 'Contents/MacOS/Electron')
  }
  run(executable, [path.join(__dirname, 'bootstrap.cjs'), 'start', root], { NODE_ENV: 'production' })
}
else if (command === 'report') {
  if (!values.output)
    throw new Error('--output is required')
  const { root } = validateRoot(values.output)
  const rows = fs.readFileSync(path.join(root, 'events.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
  const groups = new Map()
  for (const row of rows) {
    if (!Number.isFinite(row.durationMs) || row.durationMs < 0 || row.durationMs > 3600000 || typeof row.name !== 'string' || !/^[a-z0-9.-]+$/i.test(row.name) || !['ok', 'error', 'superseded'].includes(row.status))
      throw new Error('Invalid event')
    const key = `${row.name} (${row.status})`
    if (!groups.has(key))
      groups.set(key, [])
    groups.get(key).push(row.durationMs)
  }
  const table = [...groups].map(([name, durations]) => {
    durations.sort((a, b) => a - b)
    const percentile = p => durations[Math.max(0, Math.ceil(durations.length * p) - 1)].toFixed(2)
    return `| ${name} | ${durations.length} | ${percentile(0.5)} | ${durations.length >= 20 ? percentile(0.95) : '—'} | ${percentile(1)} |`
  })
  const report = ['# Пилотный benchmark massCode', '', 'Исходные условия: manifest.json; набор данных: seed.json; события: events.jsonl.', '', '| Метрика | n | p50, мс | p95, мс | max, мс |', '| --- | ---: | ---: | ---: | ---: |', ...table, '', 'Статус ok означает завершение операции без исключения, а не проверку полноты данных в интерфейсе: результат нужно сверять с ручным протоколом. Это измеренные операции данного запуска, а не предел вместимости. p95 при малом n неустойчив. state-presented заканчивается после nextTick + requestAnimationFrame и не гарантирует завершения paint. API измеряется отдельно. Перезапуск процесса не очищает файловый кэш ОС. Save durability и CPU profile этим отчётом не измеряются.', ''].join('\n')
  fs.writeFileSync(path.join(root, 'report.md'), report)
  console.log(report)
}
else {
  throw new Error('Usage: cli.cjs prepare|start|report [--output NEW_DIRECTORY] [--count 1000] [--space mixed|all|code|notes|http] [--seed TEXT] [--port 54321]')
}
