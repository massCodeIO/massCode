import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { defaultPorts, startServers } from './server.mjs'

export async function runCli(args = process.argv.slice(2)) {
  try {
    const ports = {}
    const flags = Object.fromEntries(Object.keys(defaultPorts).map(name => [`--${name === 'crossOrigin' ? 'cross-origin' : name}-port`, name]))
    if (args.includes('--help')) {
      console.log(`Usage: pnpm http:server [--] [options]\n${Object.entries(flags).map(([flag, name]) => `  ${flag} <0..65535> (default ${defaultPorts[name]})`).join('\n')}\n  --help\nPort 0 selects a free port. Ctrl+C stops all listeners.`)
      return
    }
    for (let index = 0; index < args.length; index++) {
      if (args[index] === '--')
        continue
      const name = flags[args[index]]
      const value = args[++index]
      if (!name || !/^\d+$/.test(value ?? '') || Number(value) > 65535)
        throw new Error('Unknown option or invalid port; use --help')
      ports[name] = Number(value)
    }
    const running = await startServers(ports)
    const stop = async () => {
      await running.close()
      process.removeListener('SIGINT', stop)
      process.removeListener('SIGTERM', stop)
    }
    process.on('SIGINT', stop)
    process.on('SIGTERM', stop)
    console.log(JSON.stringify({ event: 'ready', addresses: running.addresses }))
  }
  catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await runCli()
