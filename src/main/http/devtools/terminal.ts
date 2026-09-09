import type { IPty } from '@lydell/node-pty'
import type {
  TerminalEvent,
  TerminalSession,
} from '../../../shared/httpDevtools'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { basename } from 'node:path'
import process from 'node:process'

const lazyRequire = createRequire(__filename)
const OUTPUT_LIMIT = 1024 * 1024
const SESSION_LIMIT = 12
const PAUSE_AT = 256 * 1024
const RESUME_AT = 64 * 1024
interface Session extends TerminalSession {
  process: IPty
  outstanding: Map<number, number>
  outstandingSize: number
  paused: boolean
}

export class HttpTerminalManager {
  private sessions = new Map<string, Session>()
  constructor(private emit: (event: TerminalEvent) => void) {}

  create(cols: number, rows: number): TerminalSession {
    if (this.sessions.size >= SESSION_LIMIT)
      throw new Error('TERMINAL_SESSION_LIMIT')
    // Lazy load: a missing native binary must not prevent massCode startup.
    const pty = lazyRequire(
      '@lydell/node-pty',
    ) as typeof import('@lydell/node-pty')
    const shell
      = process.platform === 'win32'
        ? process.env.PWSH || 'powershell.exe'
        : process.env.SHELL || '/bin/bash'
    const cwd = homedir()
    const child = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: process.env,
    })
    const session: Session = {
      id: randomUUID(),
      title: basename(shell),
      cwd,
      cols,
      rows,
      sequence: 0,
      output: '',
      truncated: false,
      process: child,
      outstanding: new Map(),
      outstandingSize: 0,
      paused: false,
    }
    this.sessions.set(session.id, session)
    child.onData((data) => {
      if (!this.sessions.has(session.id))
        return
      session.output += data
      if (session.output.length > OUTPUT_LIMIT) {
        session.output = session.output.slice(-OUTPUT_LIMIT)
        session.truncated = true
      }
      const sequence = ++session.sequence
      session.outstanding.set(sequence, data.length)
      session.outstandingSize += data.length
      if (!session.paused && session.outstandingSize >= PAUSE_AT) {
        child.pause()
        session.paused = true
      }
      this.emit({
        type: 'data',
        id: session.id,
        data,
        sequence,
      })
    })
    child.onExit(({ exitCode }) => {
      if (!this.sessions.has(session.id))
        return
      session.exitCode = exitCode
      this.emit({ type: 'exit', id: session.id, exitCode })
    })
    return this.snapshot(session)
  }

  private get(id: string) {
    const session = this.sessions.get(id)
    if (!session)
      throw new Error('TERMINAL_SESSION_NOT_FOUND')
    return session
  }

  private snapshot({
    process: _process,
    outstanding: _outstanding,
    outstandingSize: _outstandingSize,
    paused: _paused,
    ...session
  }: Session): TerminalSession {
    return session
  }

  list() {
    return [...this.sessions.values()].map(session => this.snapshot(session))
  }

  input(id: string, data: string) {
    const session = this.get(id)
    if (session.exitCode !== undefined)
      throw new Error('TERMINAL_SESSION_EXITED')
    session.process.write(data)
  }

  acknowledge(id: string, sequence: number) {
    // ACK is cumulative and sent only after xterm has parsed the output.
    const session = this.sessions.get(id)
    if (!session || sequence > session.sequence)
      return
    for (const [pending, size] of session.outstanding) {
      if (pending > sequence)
        break
      session.outstandingSize -= size
      session.outstanding.delete(pending)
    }
    if (session.paused && session.outstandingSize <= RESUME_AT) {
      session.paused = false
      if (session.exitCode === undefined)
        session.process.resume()
    }
  }

  resize(id: string, cols: number, rows: number) {
    const session = this.get(id)
    if (session.exitCode === undefined)
      session.process.resize(cols, rows)
    session.cols = cols
    session.rows = rows
  }

  clear(id: string) {
    const session = this.get(id)
    session.output = ''
    session.truncated = false
    this.emit({ type: 'clear', id, sequence: ++session.sequence })
  }

  kill(id: string) {
    const session = this.get(id)
    this.sessions.delete(id)
    try {
      if (session.exitCode === undefined)
        session.process.kill()
    }
    finally {
      this.emit({ type: 'removed', id })
    }
  }

  dispose() {
    for (const id of this.sessions.keys()) {
      try {
        this.kill(id)
      }
      catch {
        /* Continue terminating the remaining sessions. */
      }
    }
  }
}
