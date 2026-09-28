import type {
  HttpConsoleEntry,
  HttpConsoleEvent,
} from '../../../shared/httpDevtools'
import { randomUUID } from 'node:crypto'
import {
  CONSOLE_MAX_AGE,
  CONSOLE_MAX_ENTRIES,
} from '../../../shared/httpDevtools'

const MAX_TEXT = 128 * 1024
const MAX_BYTES = 32 * 1024 * 1024
export class HttpConsoleJournal {
  private aiContent = new Map<
    string,
    {
      content: Pick<HttpConsoleEntry, 'message' | 'details'>
      vaultPath?: string
    }
  >()

  private entries = new Map<string, HttpConsoleEntry>()
  private sizes = new Map<string, number>()
  private bytes = 0
  private revision = 0
  private listeners = new Set<(event: HttpConsoleEvent) => void>()
  subscribe(listener: (event: HttpConsoleEvent) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(event: HttpConsoleEvent) {
    this.listeners.forEach((listener) => {
      try {
        listener(event)
      }
      catch {
        /* Diagnostics must never interrupt a request. */
      }
    })
  }

  private prune(now = Date.now()) {
    for (const [id, entry] of this.entries) {
      if (
        entry.timestamp >= now - CONSOLE_MAX_AGE
        && this.entries.size <= CONSOLE_MAX_ENTRIES
        && this.bytes <= MAX_BYTES
      ) {
        break
      }
      this.bytes -= this.sizes.get(id) ?? 0
      this.sizes.delete(id)
      this.entries.delete(id)
      this.aiContent.delete(id)
    }
  }

  get(id: string) {
    return this.entries.get(id)
  }

  read() {
    this.prune()
    return { revision: this.revision, entries: [...this.entries.values()] }
  }

  readForAi(vaultPath?: string) {
    const snapshot = this.read()
    return {
      ...snapshot,
      entries: snapshot.entries
        .filter((entry) => {
          const safe = this.aiContent.get(entry.id)
          return !safe?.vaultPath || safe.vaultPath === vaultPath
        })
        .map(({ message: _message, details: _details, ...entry }) => ({
          ...entry,
          ...(this.aiContent.get(entry.id)?.content ?? {
            message: '[CONTENT_UNAVAILABLE_FOR_AI]',
          }),
        })),
    }
  }

  publishAiContent(
    id: string,
    identity: { executionId: string, vaultPath: string },
    content: Pick<HttpConsoleEntry, 'message' | 'details'>,
  ) {
    if (this.entries.get(id)?.executionId === identity.executionId) {
      this.aiContent.set(id, {
        content: structuredClone(content),
        vaultPath: identity.vaultPath,
      })
    }
  }

  clear() {
    this.entries.clear()
    this.aiContent.clear()
    this.sizes.clear()
    this.bytes = 0
    this.emit({ type: 'clear', revision: ++this.revision })
  }

  append(
    entry: Omit<HttpConsoleEntry, 'id' | 'timestamp'> &
      Partial<Pick<HttpConsoleEntry, 'id' | 'timestamp'>>,
    aiContent?: Pick<HttpConsoleEntry, 'message' | 'details'>,
  ) {
    const id = entry.id ?? randomUUID()
    if (aiContent)
      this.aiContent.set(id, { content: structuredClone(aiContent) })
    return this.upsert({
      ...entry,
      id,
      timestamp: entry.timestamp ?? Date.now(),
    })
  }

  update(id: string, patch: Partial<HttpConsoleEntry>) {
    this.aiContent.delete(id)
    const existing = this.entries.get(id)
    // Clear must not resurrect requests that were already visible.
    if (existing)
      this.upsert({ ...existing, ...patch, id })
  }

  private upsert(entry: HttpConsoleEntry) {
    let truncated = entry.truncated ?? false
    let remaining = MAX_TEXT
    const cap = (value: unknown, depth = 0): unknown => {
      if (remaining <= 0 || depth > 8) {
        truncated = true
        return '[…]'
      }
      if (typeof value === 'string') {
        const size = Math.min(value.length, remaining)
        remaining -= size
        if (size < value.length) {
          truncated = true
          return `${value.slice(0, size)}…`
        }
        return value
      }
      if (Array.isArray(value))
        return value.slice(0, 1000).map(item => cap(item, depth + 1))
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value)
            .slice(0, 1000)
            .map(([key, item]) => [key, cap(item, depth + 1)]),
        )
      }
      return value
    }
    const bounded: HttpConsoleEntry = {
      ...entry,
      message: cap(entry.message) as string,
      details: entry.details
        ? (cap(entry.details) as Record<string, unknown>)
        : undefined,
    }
    bounded.truncated = truncated
    const size = JSON.stringify(bounded).length * 2
    this.bytes += size - (this.sizes.get(entry.id) ?? 0)
    this.sizes.set(entry.id, size)
    this.entries.set(entry.id, bounded)
    this.prune()
    this.emit({ type: 'upsert', revision: ++this.revision, entry: bounded })
    return bounded.id
  }
}
export const httpConsole = new HttpConsoleJournal()
