const child_process = require('node:child_process')
const { styleText } = require('node:util')
const Store = require('electron-store')

const store = new Store({ name: 'preferences', cwd: 'v2' })
const apiPort = store.get('apiPort', 4321)
const url = `http://localhost:${apiPort}/swagger/json`

async function generateApi() {
  try {
    console.log(styleText('blue', 'Generating API...'))
    child_process.execSync(
      `npx swagger-typescript-api@13.0.23 -p ${url} -o ./src/renderer/services/api/generated -n index.ts`,
    )
    console.log(styleText('green', 'API is successfully generated'))
  }
  catch (err) {
    console.log(styleText('red', 'Error generating API'))
    console.log(err)
  }
}

generateApi()
