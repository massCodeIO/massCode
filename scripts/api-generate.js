const child_process = require('node:child_process')
const { styleText } = require('node:util')

const url = `http://localhost:4321/swagger/json`

async function generateApi() {
  try {
    console.log(styleText('blue', 'Generating API...'))
    child_process.execSync(
      `npx swagger-typescript-api -p ${url} -o ./src/renderer/services/api/generated -n index.ts`,
    )
    console.log(styleText('green', 'API is successfully generated'))
  }
  catch (err) {
    console.log(styleText('red', 'Error generating API'))
    console.log(err)
  }
}

generateApi()
