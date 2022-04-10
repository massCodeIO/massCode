import { spawn } from 'child_process'
import type { ChildProcess } from 'child_process'
import path from 'path'
import chalk from 'chalk'
import chokidar from 'chokidar'
import { createServer } from 'vite'
import viteConfig from '../config/vite'

process.env.NODE_ENV = 'development'

let electronProcess: ChildProcess | null
let rendererPort: number | undefined = 0

async function startRenderer () {
  const server = await createServer({
    ...viteConfig,
    mode: 'development'
  })

  return await server.listen()
}

function startElectron () {
  if (electronProcess) return

  electronProcess = spawn('electron', ['.', (rendererPort || 0).toString()], {
    shell: true
  })

  electronProcess?.stdout?.on('data', data => {
    console.log(chalk.blueBright('[Electron] ') + chalk.white(data.toString()))
  })

  electronProcess?.stderr?.on('data', data => {
    console.log(chalk.redBright('[Electron] ') + chalk.white(data.toString()))
  })

  electronProcess?.on('error', error => {
    console.log(chalk.redBright('[Electron] ', error))
  })
}

function restartElectron () {
  if (electronProcess) {
    electronProcess.kill()
    electronProcess = null
  }

  startElectron()
}

async function start () {
  console.log()
  console.log(`${chalk.blueBright('Starting Electron + Vite Dev Server...')}`)
  console.log()

  const devServer = await startRenderer()
  rendererPort = devServer.config.server.port

  startElectron()

  chokidar
    .watch(path.resolve(__dirname, '../src/main'), {
      ignored: ['renderer']
    })
    .on('change', () => {
      restartElectron()
    })
}

start()
