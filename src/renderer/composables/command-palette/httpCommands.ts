import type { CommandPaletteCommand } from '../useCommandPalette'
import { i18n } from '@/electron'
import { router, RouterName } from '@/router'
import { getActiveSpaceId } from '@/spaceDefinitions'
import {
  Cookie,
  Folder,
  Globe,
  Layers,
  Play,
  Plug,
  Send,
  Settings,
  Terminal,
  TextSearch,
  Upload,
} from 'lucide-vue-next'
import { httpRuntimeNavigation } from '../spaces/http/runtimeNavigation'
import { useHttpApp } from '../spaces/http/useHttpApp'
import { useHttpFolders } from '../spaces/http/useHttpFolders'
import { useHttpRequests } from '../spaces/http/useHttpRequests'
import { useHttpRunner } from '../spaces/http/useHttpRunner'
import { useHttpSearch } from '../spaces/http/useHttpSearch'
import { useHttpUi } from '../spaces/http/useHttpUi'
import { LibraryFilter } from '../types'
import { useHttpImportDialog } from '../useHttpImportDialog'

function currentFolderId() {
  if (getActiveSpaceId() !== 'http')
    return undefined
  const { httpState } = useHttpApp()
  const { currentRequest } = useHttpRequests()
  if (
    (httpState.activePanel ?? 'request') === 'request'
    && currentRequest.value
    && currentRequest.value.id === httpState.requestId
  ) {
    return currentRequest.value.folderId ?? undefined
  }
  return httpState.folderId
}

export async function createHttpRequestFromPalette(payload?: {
  name?: string
  url?: string
  protocol?: 'websocket'
}) {
  const parent = currentFolderId()
  if (!(await httpRuntimeNavigation.confirmLeave()))
    return
  await router.push({ name: RouterName.httpSpace })
  if (router.currentRoute.value.name !== RouterName.httpSpace)
    return
  useHttpSearch().clearSearch(false)
  const { httpState } = useHttpApp()
  httpState.folderId = parent ?? undefined
  httpState.libraryFilter = parent == null ? LibraryFilter.Inbox : undefined
  await useHttpRequests().createHttpRequestAndSelect({
    folderId: parent ?? null,
    ...payload,
  })
}

async function createFolder(nested: boolean) {
  const parent = nested ? currentFolderId() : undefined
  if (nested && parent == null)
    return
  if (!(await httpRuntimeNavigation.confirmLeave()))
    return
  await router.push({ name: RouterName.httpSpace })
  if (router.currentRoute.value.name !== RouterName.httpSpace)
    return
  useHttpSearch().clearSearch(false)
  await useHttpFolders().createHttpFolderAndSelect(parent ?? undefined)
}

async function openUi(
  target: 'console' | 'terminal' | 'cookies' | 'environments',
) {
  await router.push({ name: RouterName.httpSpace })
  if (router.currentRoute.value.name !== RouterName.httpSpace)
    return
  const ui = useHttpUi()
  if (target === 'cookies') {
    ui.cookiesOpen.value = true
  }
  else if (target === 'environments') {
    ui.environmentsOpen.value = true
  }
  else {
    ui.dockTab.value = target
    ui.dockOpen.value = true
  }
}

export function getHttpCommands(): CommandPaletteCommand[] {
  const active = getActiveSpaceId() === 'http'
  const { httpState } = useHttpApp()
  const data = useHttpRequests()
  const runner = useHttpRunner()
  const parent = currentFolderId()
  const current
    = active
      && (httpState.activePanel ?? 'request') === 'request'
      && data.currentRequest.value?.id === httpState.requestId
      && !!data.currentDraft.value
      && !data.isCurrentRequestLoading.value
  const command = (
    id: string,
    key: string,
    icon: CommandPaletteCommand['icon'],
    keywords: string[],
    run: CommandPaletteCommand['run'],
  ): CommandPaletteCommand => ({
    id,
    title: i18n.t(`commandPalette.actions.${key}`),
    subtitle: i18n.t(`commandPalette.actions.${key}Subtitle`),
    icon,
    keywords: ['http', ...keywords],
    spaceId: 'http',
    run,
  })
  const commands = [
    command(
      'new-http-request',
      'newHttpRequest',
      Send,
      ['create', 'request'],
      createHttpRequestFromPalette,
    ),
    command(
      'new-http-collection',
      'newHttpCollection',
      Layers,
      ['create', 'collection'],
      () => createFolder(false),
    ),
    command(
      'new-http-websocket',
      'newHttpWebSocket',
      Plug,
      ['create', 'websocket', 'ws', 'wss'],
      () => createHttpRequestFromPalette({ protocol: 'websocket' }),
    ),
    command(
      'import-http-collection',
      'importHttpCollection',
      Upload,
      ['import', 'postman', 'bruno', 'openapi', 'collection', 'environment'],
      async () => {
        await router.push({ name: RouterName.httpSpace })
        if (router.currentRoute.value.name === RouterName.httpSpace)
          useHttpImportDialog().openHttpImportDialog()
      },
    ),
    command(
      'open-http-settings',
      'openHttpSettings',
      Settings,
      ['settings', 'preferences', 'transport', 'timeout', 'redirect', 'http2'],
      async () => {
        await router.push({ name: RouterName.preferencesHttp })
      },
    ),
    command(
      'open-http-environments',
      'openHttpEnvironments',
      Globe,
      ['environment', 'variables'],
      () => openUi('environments'),
    ),
    command(
      'open-http-console',
      'openHttpConsole',
      TextSearch,
      ['console', 'network', 'logs'],
      () => openUi('console'),
    ),
    command(
      'open-http-terminal',
      'openHttpTerminal',
      Terminal,
      ['terminal', 'shell'],
      () => openUi('terminal'),
    ),
    command(
      'open-http-cookies',
      'openHttpCookies',
      Cookie,
      ['cookies', 'jar'],
      () => openUi('cookies'),
    ),
  ]
  if (active && parent != null) {
    commands.push(
      command(
        'new-http-folder',
        'newHttpFolder',
        Folder,
        ['create', 'folder'],
        () => createFolder(true),
      ),
    )
    if (!runner.running.value && !runner.preparing.value) {
      commands.push(
        command(
          'open-http-runner',
          'openHttpRunner',
          Play,
          ['runner', 'collection', 'run'],
          async () => {
            await runner.openRunner(parent)
          },
        ),
      )
    }
  }
  if (current && data.currentDraft.value?.protocol !== 'websocket') {
    commands.push(
      command(
        'open-http-request-settings',
        'openHttpRequestSettings',
        Settings,
        ['request', 'settings', 'transport'],
        async () => {
          useHttpUi().requestSettingsVersion.value++
        },
      ),
    )
  }
  return commands
}
