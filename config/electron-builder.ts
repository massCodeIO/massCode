import type { Configuration } from 'electron-builder'
import path from 'path'

export default {
  appId: 'io.masscode.app',
  productName: 'massCode',
  directories: {
    output: path.resolve(__dirname, '../../dist')
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    shortcutName: 'massCode'
  },
  mac: {
    target: [
      { target: 'dmg', arch: 'arm64' },
      { target: 'dmg', arch: 'x64' }
    ],
    icon: 'config/icons/icon.icns'
  },
  win: {
    target: 'nsis',
    icon: 'config/icons/icon.ico'
  },
  linux: {
    target: ['snap'],
    icon: 'config/icons'
  },
  files: [
    '!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}',
    '!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}',
    '!**/node_modules/*.d.ts',
    '!**/node_modules/.bin',
    '!config',
    '!README.md',
    '!scripts',
    '!config',
    '!dist',
    '!src',
    '!build',
    'build/src/main/**/*',
    'build/src/renderer/**/*',
    {
      from: 'build/renderer',
      to: 'renderer',
      filter: ['**/*']
    }
  ]
} as Configuration
