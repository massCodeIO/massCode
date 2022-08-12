import buildVue from './build-vue'
import buildElectron from './build-electron'
import chalk from 'chalk'

const isTestBuild = process.env.TEST_BUILD === 'true'

process.env.NODE_ENV = 'production'

const buildType = isTestBuild ? 'Test' : 'Production'

async function build () {
  console.log()
  console.log(`${chalk.blueBright(`${buildType} build started...`)}`)
  console.log()

  await buildVue()
  await buildElectron()

  console.log()
  console.log(`${chalk.greenBright(`${buildType} build success!`)}`)
  console.log()
}

build()
