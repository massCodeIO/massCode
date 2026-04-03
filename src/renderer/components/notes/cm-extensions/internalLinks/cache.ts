import type { InternalLinkType } from './parser'

export interface CachedEntityData {
  id: number
  name: string
  type: InternalLinkType
  folder: { id: number, name: string } | null
  isDeleted: number
  firstContent?: { language: string, value: string | null } | null
  contentExcerpt?: string
}

export type CachedEntity =
  | { exists: true, data: CachedEntityData }
  | { exists: false }

interface CacheEntry {
  entity: CachedEntity
  expiresAt: number
}

export class EntityCache {
  private readonly entries = new Map<string, CacheEntry>()
  private readonly pending = new Set<string>()

  constructor(private readonly ttlMs = 30_000) {}

  get(key: string): CachedEntity | undefined {
    const entry = this.entries.get(key)
    if (!entry) {
      return undefined
    }

    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key)
      this.pending.delete(key)
      return undefined
    }

    return entry.entity
  }

  set(key: string, entity: CachedEntity): void {
    this.entries.set(key, {
      entity,
      expiresAt: Date.now() + this.ttlMs,
    })
    this.pending.delete(key)
  }

  markPending(key: string): void {
    this.pending.add(key)
  }

  isPending(key: string): boolean {
    return this.pending.has(key)
  }

  clear(): void {
    this.entries.clear()
    this.pending.clear()
  }
}

export const entityCache = new EntityCache()
