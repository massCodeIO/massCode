import { z } from 'zod'

export const terminalIdSchema = z.object({ id: z.string().uuid() }).strict()
export const terminalCreateSchema = z
  .object({
    cols: z.number().int().min(2).max(500).default(80),
    rows: z.number().int().min(1).max(300).default(24),
  })
  .strict()
export const terminalInputSchema = terminalIdSchema.extend({
  data: z.string().max(65536),
})
export const terminalAckSchema = terminalIdSchema.extend({
  sequence: z.number().int().nonnegative(),
})
export const terminalResizeSchema = terminalIdSchema.extend({
  cols: z.number().int().min(2).max(500),
  rows: z.number().int().min(1).max(300),
})
export interface TerminalSession {
  id: string
  title: string
  cwd: string
  cols: number
  rows: number
  sequence: number
  output: string
  truncated: boolean
  exitCode?: number
}
export type TerminalEvent =
  | { type: 'data', id: string, data: string, sequence: number }
  | { type: 'exit', id: string, exitCode: number }
  | { type: 'removed', id: string }
  | { type: 'clear', id: string, sequence: number }

export const consoleLevels = ['log', 'info', 'warn', 'error'] as const
export type ConsoleLevel = (typeof consoleLevels)[number]
export interface HttpConsoleEntry {
  id: string
  timestamp: number
  level: ConsoleLevel
  kind: 'network' | 'script'
  message: string
  executionId: string
  details?: Record<string, unknown>
  status?: number
  durationMs?: number
  pending?: boolean
  truncated?: boolean
}
export interface HttpConsoleSnapshot {
  revision: number
  entries: HttpConsoleEntry[]
}
export type HttpConsoleEvent =
  | { type: 'upsert', revision: number, entry: HttpConsoleEntry }
  | { type: 'clear', revision: number }
export const CONSOLE_MAX_ENTRIES = 5000
export const CONSOLE_MAX_AGE = 24 * 60 * 60 * 1000

export const scriptConsoleSchema = z
  .object({
    level: z.enum(['log', 'info', 'warn', 'error', 'clear']),
    args: z.array(z.unknown()).max(50),
  })
  .strict()
export type ScriptConsoleMessage = z.infer<typeof scriptConsoleSchema>
