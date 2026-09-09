import type { TerminalEvent, TerminalSession } from '~/shared/httpDevtools'
import { i18n, ipc } from '@/electron'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'

const sessions = ref<TerminalSession[]>([])
const activeId = ref('')
const error = ref('')
const loading = ref(false)
const instances = new Map<
  string,
  { terminal: Terminal, fit: FitAddon, sequence: number }
>()
let initialized = false
let initializing: Promise<void> | undefined
const queued: TerminalEvent[] = []
const removed = new Set<string>()
let collecting = false

function reportError(cause: unknown) {
  error.value = `${i18n.t('spaces.http.devtools.terminalError')} ${String(cause)}`
}
async function invoke(
  action: 'input' | 'resize' | 'clear' | 'kill' | 'ack',
  payload: unknown,
) {
  try {
    await ipc.invoke(`spaces:http:terminal:${action}`, payload)
  }
  catch (cause) {
    reportError(cause)
  }
}
function remove(id: string) {
  removed.add(id)
  instances.get(id)?.terminal.dispose()
  instances.delete(id)
  sessions.value = sessions.value.filter(session => session.id !== id)
  if (activeId.value === id)
    activeId.value = sessions.value[0]?.id ?? ''
}
function receive(event: TerminalEvent) {
  if (removed.has(event.id))
    return
  if (event.type === 'removed') {
    remove(event.id)
    return
  }
  if (collecting) {
    if (queued.length < 10000)
      queued.push(event)
    return
  }
  const instance = instances.get(event.id)
  if (!instance) {
    if (queued.length < 10000)
      queued.push(event)
    return
  }
  if (event.type === 'exit') {
    const session = sessions.value.find(session => session.id === event.id)
    if (session)
      session.exitCode = event.exitCode
    instance.terminal.writeln(
      `\r\n${i18n.t('spaces.http.devtools.exited', { code: event.exitCode })}`,
    )
    return
  }
  if (event.sequence <= instance.sequence)
    return
  instance.sequence = event.sequence
  if (event.type === 'clear') {
    instance.terminal.write('', () => instance.terminal.clear())
  }
  else {
    instance.terminal.write(event.data, () => {
      void invoke('ack', { id: event.id, sequence: event.sequence })
    })
  }
}
function install(session: TerminalSession) {
  if (instances.has(session.id))
    return
  const terminal = new Terminal({
    cols: session.cols,
    rows: session.rows,
    cursorBlink: true,
    fontSize: 12,
    fontFamily: 'Menlo, Monaco, Consolas, monospace',
    scrollback: 5000,
    screenReaderMode: true,
  })
  const fit = new FitAddon()
  terminal.loadAddon(fit)
  instances.set(session.id, { terminal, fit, sequence: session.sequence })
  sessions.value.push(session)
  terminal.onData((data) => {
    // Bound each IPC payload; preserve byte ordering for pasted input.
    for (let offset = 0; offset < data.length; offset += 65536) {
      void invoke('input', {
        id: session.id,
        data: data.slice(offset, offset + 65536),
      })
    }
  })
  terminal.onResize(({ cols, rows }) => {
    void invoke('resize', {
      id: session.id,
      cols: Math.min(cols, 500),
      rows: Math.min(rows, 300),
    })
  })
  terminal.onTitleChange((title) => {
    const current = sessions.value.find(item => item.id === session.id)
    if (current)
      current.title = title.slice(0, 200) || session.title
  })
  if (session.truncated)
    terminal.writeln(i18n.t('spaces.http.devtools.replayTruncated'))
  terminal.write(session.output, () => {
    void invoke('ack', { id: session.id, sequence: session.sequence })
  })
  if (session.exitCode !== undefined) {
    terminal.writeln(
      `\r\n${i18n.t('spaces.http.devtools.exited', { code: session.exitCode })}`,
    )
  }
  const pending = queued.splice(0)
  pending.forEach(receive)
}
async function init() {
  if (initialized)
    return
  if (initializing)
    return initializing
  loading.value = true
  initializing = (async () => {
    ipc.removeListeners('spaces:http:terminal:event')
    ipc.on('spaces:http:terminal:event', (_event, payload: TerminalEvent) =>
      receive(payload))
    collecting = true
    try {
      const existing = (await ipc.invoke(
        'spaces:http:terminal:list',
        undefined,
      )) as TerminalSession[]
      collecting = false
      existing.forEach(install)
      activeId.value ||= sessions.value[0]?.id ?? ''
      initialized = true
    }
    catch (cause) {
      reportError(cause)
    }
    finally {
      collecting = false
      loading.value = false
      initializing = undefined
    }
  })()
  return initializing
}
async function create() {
  await init()
  if (!initialized)
    return
  error.value = ''
  loading.value = true
  try {
    const session = (await ipc.invoke('spaces:http:terminal:create', {
      cols: 80,
      rows: 24,
    })) as TerminalSession
    install(session)
    activeId.value = session.id
  }
  catch (cause) {
    reportError(cause)
  }
  finally {
    loading.value = false
  }
}
function mount(host: HTMLElement) {
  const instance = instances.get(activeId.value)
  if (!instance)
    return
  const { terminal, fit } = instance
  const style = getComputedStyle(host)
  terminal.options.theme = {
    background: style.backgroundColor,
    foreground: style.color,
    cursor: style.color,
  }
  host.replaceChildren()
  if (terminal.element)
    host.appendChild(terminal.element)
  else terminal.open(host)
  if (host.clientWidth && host.clientHeight)
    fit.fit()
  terminal.focus()
}
function resize() {
  const instance = instances.get(activeId.value)
  const host = instance?.terminal.element?.parentElement
  if (host?.clientWidth && host.clientHeight)
    instance?.fit.fit()
}
export function useHttpTerminal() {
  return {
    sessions,
    activeId,
    error,
    loading,
    init,
    create,
    mount,
    resize,
    clear: () => invoke('clear', { id: activeId.value }),
    close: (id: string) => invoke('kill', { id }),
  }
}
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    ipc.removeListeners('spaces:http:terminal:event')
    instances.forEach(instance => instance.terminal.dispose())
    instances.clear()
  })
}
