import 'dotenv/config'
import { notarize } from 'electron-notarize'
import type { AfterPackContext } from 'electron-builder'

const notarizing = async (context: AfterPackContext) => {
  const { electronPlatformName, appOutDir } = context

  if (electronPlatformName !== 'darwin') {
    return
  }

  const appName = context.packager.appInfo.productFilename

  return await notarize({
    appBundleId: 'io.masscode.app',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID!,
    appleIdPassword: process.env.APPLE_ID_PASSWORD!
  })
}

export default notarizing
