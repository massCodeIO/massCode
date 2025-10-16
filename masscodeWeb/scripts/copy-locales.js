const fs = require('node:fs')
const path = require('node:path')
const { styleText } = require('node:util')

const sourceDir = path.join(__dirname, '../src/main/i18n/locales')
const targetDir = path.join(__dirname, '../build/main/i18n/locales')

function copyDirRecursive(sourceDir, targetDir) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }

  const files = fs.readdirSync(sourceDir)

  for (const file of files) {
    const sourcePath = path.join(sourceDir, file)
    const targetPath = path.join(targetDir, file)

    const stat = fs.statSync(sourcePath)

    if (stat.isDirectory()) {
      copyDirRecursive(sourcePath, targetPath)
    }
    else {
      fs.copyFileSync(sourcePath, targetPath)
    }
  }
}

console.log(styleText('blue', 'Localization files copying...'))
copyDirRecursive(sourceDir, targetDir)
console.log(styleText('green', 'Localization files copying completed'))
