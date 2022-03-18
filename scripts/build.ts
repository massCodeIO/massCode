import buildVue from './build-vue'
import buildElectron from './build-electron'
import chalk from 'chalk'

process.env.NODE_ENV = 'production'

async function build () {
  console.log()
  console.log(`${chalk.blueBright('Build started...')}`)
  console.log()

  await buildVue()
  await buildElectron()

  console.log()
  console.log(`${chalk.greenBright('Build success!')}`)
  console.log()
}

build()
