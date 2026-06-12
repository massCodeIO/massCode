import { app, dialog, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { repository, version } from '../../../package.json'
import i18n from '../i18n'
import { send } from '../ipc'
import { store } from '../store'
import { log } from '../utils'

const INTERVAL = 1000 * 60 * 60 * 3 // 3 часа
const currentMajorVersion = Number.parseInt(version.split('.')[0], 10)

function getMajorVersion(rawVersion: string) {
  return Number.parseInt(rawVersion.replace(/^v/, '').split('.')[0], 10)
}

// Уведомление без установки: для выключенного автообновления и нового мажора,
// который требует осознанного перехода (миграция vault).
function notifyAboutUpdate(latestVersion: string) {
  const lastNotifiedVersion = store.app.get(
    'notifications.lastNotifiedUpdateVersion',
  )

  if (lastNotifiedVersion === latestVersion) {
    return
  }

  send('system:update-available')
  store.app.set('notifications.lastNotifiedUpdateVersion', latestVersion)
}

async function runUpdateCheck() {
  try {
    await autoUpdater.checkForUpdates()
  }
  catch (error) {
    log('Error checking for updates', error)
  }
}

export function installDownloadedUpdate() {
  autoUpdater.quitAndInstall()
}

// Ручная проверка из меню. Скачивание при необходимости запустит глобальный
// обработчик 'update-available', здесь только диалоги.
export async function checkForUpdatesFromMenu() {
  function showNoUpdatesDialog() {
    dialog.showMessageBoxSync({
      message: i18n.t('messages:update.noAvailable'),
    })
  }

  if (!app.isPackaged) {
    showNoUpdatesDialog()
    return
  }

  try {
    const result = await autoUpdater.checkForUpdates()

    if (!result?.isUpdateAvailable) {
      showNoUpdatesDialog()
      return
    }

    const latestVersion = result.updateInfo.version
    const isAutoUpdateEnabled = store.preferences.get('updates.autoUpdate')
    const isSameMajor = getMajorVersion(latestVersion) === currentMajorVersion

    if (isAutoUpdateEnabled && isSameMajor) {
      dialog.showMessageBoxSync({
        message: i18n.t('messages:update.downloading', {
          version: latestVersion,
        }),
      })
      return
    }

    const buttonId = dialog.showMessageBoxSync({
      message: i18n.t('messages:update.available', {
        newVersion: latestVersion,
        oldVersion: version,
      }),
      buttons: [i18n.t('button.update.0'), i18n.t('button.update.1')],
      defaultId: 0,
      cancelId: 1,
    })

    if (buttonId === 0) {
      void shell.openExternal(`${repository}/releases`)
    }
  }
  catch (error) {
    log('Error checking for updates', error)
    showNoUpdatesDialog()
  }
}

export function checkForUpdates() {
  if (!app.isPackaged) {
    return
  }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null

  autoUpdater.on('update-available', (info) => {
    const isAutoUpdateEnabled = store.preferences.get('updates.autoUpdate')
    const isSameMajor = getMajorVersion(info.version) === currentMajorVersion

    if (!isAutoUpdateEnabled || !isSameMajor) {
      notifyAboutUpdate(info.version)
      return
    }

    autoUpdater.downloadUpdate().catch((error) => {
      log('Error downloading update', error)
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    send('system:update-downloaded', { version: info.version })
  })

  autoUpdater.on('error', (error) => {
    log('Auto-update error', error)
  })

  void runUpdateCheck()

  setInterval(() => {
    void runUpdateCheck()
  }, INTERVAL)
}
