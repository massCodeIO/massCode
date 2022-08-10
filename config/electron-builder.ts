/* eslint-disable no-template-curly-in-string */
import type { Configuration } from 'electron-builder'
import path from 'path'

const isSponsored = process.env.VITE_SPONSORED === 'true'

const artifactName = isSponsored
  ? '${productName}-${version}-${arch}-sponsored.${ext}'
  : undefined

export default {
  appId: 'io.masscode.app',
  artifactName,
  productName: 'massCode',
  directories: {
    output: path.resolve(__dirname, '../../dist')
  },
  afterSign: 'build/scripts/notarize.js',
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
    icon: 'config/icons/icon.icns',
    category: 'public.app-category.productivity',
    hardenedRuntime: true,
    entitlements: 'build/entitlements.mac.inherit.plist'
  },
  win: {
    target: 'nsis',
    icon: 'config/icons/icon.ico'
  },
  linux: {
    target: ['snap'],
    icon: 'config/icons'
  },
  extraMetadata: {
    main: 'src/main/index.js'
  },
  files: [
    '!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}',
    '!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}',
    '!**/node_modules/*.d.ts',
    '!**/node_modules/.bin',
    '!config',
    '!README.md',
    '!scripts',
    '!dist',
    '!src',
    '!build',
    '!hero.png',
    '!commitlint.config.js',
    '!tsconfig.electron.json',
    '!tsconfig.json',
    {
      from: 'build/renderer',
      to: 'renderer',
      filter: ['**/*']
    },
    {
      from: 'build/src',
      to: 'src',
      filter: ['**/*']
    }
  ]
} as Configuration
