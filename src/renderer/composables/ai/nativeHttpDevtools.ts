import type { AiNativeAction } from '~/shared/aiNativeActions'
import type { TerminalSession } from '~/shared/httpDevtools'
import { useHttpUi } from '@/composables/spaces/http/useHttpUi'
import { ipc } from '@/electron'
import { runNativeBridge } from './nativeBridges'

export async function executeHttpDevtools(
  action: Extract<AiNativeAction, { action: 'httpDevtools' }>,
  current: () => boolean,
) {
  if (!current())
    return { status: 'stale' as const }
  const ui = useHttpUi()
  const terminal = action.command.startsWith('terminal')
  if (
    !terminal
    || action.command === 'terminalOpen'
    || action.command === 'terminalCreate'
  ) {
    ui.dockTab.value = terminal ? 'terminal' : 'console'
    ui.dockOpen.value = true
    await nextTick()
  }
  if (!current())
    return { status: 'stale' as const }
  if (!terminal)
    return runNativeBridge(action, current)
  const { useHttpTerminal } = await import(
    '@/composables/spaces/http/devtools/useHttpTerminal'
  )
  const control = useHttpTerminal()
  const ok
    = action.command === 'terminalList'
      || (await control.control(
        action.command as
        | 'terminalOpen'
        | 'terminalCreate'
        | 'terminalClear'
        | 'terminalClose',
        action.sessionId,
        current,
      ))
  const sessions = (await ipc.invoke(
    'spaces:http:terminal:list',
    undefined,
  )) as TerminalSession[]
  return {
    status: !current()
      ? ('stale' as const)
      : ok
        ? ('done' as const)
        : ('unavailable' as const),
    panel: 'terminal',
    terminals: sessions.map(({ id, title, exitCode }) => ({
      id,
      title,
      exitCode,
      active: id === control.activeId.value,
    })),
  }
}
