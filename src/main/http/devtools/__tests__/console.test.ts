import { describe, expect, it } from 'vitest'
import {
  CONSOLE_MAX_AGE,
  CONSOLE_MAX_ENTRIES,
} from '../../../../shared/httpDevtools'
import { HttpConsoleJournal } from '../console'

const entry = {
  kind: 'script' as const,
  level: 'log' as const,
  executionId: 'test',
  message: 'message',
}
describe('hTTP console journal', () => {
  it('retains only the latest 5000 messages and 24 hours', () => {
    const journal = new HttpConsoleJournal()
    journal.append({ ...entry, timestamp: Date.now() - CONSOLE_MAX_AGE - 1 })
    expect(journal.read().entries).toHaveLength(0)
    for (let index = 0; index <= CONSOLE_MAX_ENTRIES; index++)
      journal.append({ ...entry, message: String(index) })
    const entries = journal.read().entries
    expect(entries).toHaveLength(CONSOLE_MAX_ENTRIES)
    expect(entries[0].message).toBe('1')
  })
  it('caps detail payload without corrupting identifiers or status', () => {
    const journal = new HttpConsoleJournal()
    const id = journal.append({
      ...entry,
      details: { responseBody: 'x'.repeat(200000) },
      status: 200,
    })
    const saved = journal.read().entries[0]
    expect(saved.id).toBe(id)
    expect(saved.truncated).toBe(true)
    expect(saved.status).toBe(200)
    expect(JSON.stringify(saved).length).toBeLessThan(132000)
  })
  it('clear is shared and late completion cannot resurrect a request', () => {
    const journal = new HttpConsoleJournal()
    const events: string[] = []
    const unsubscribe = journal.subscribe(event => events.push(event.type))
    const id = journal.append(entry)
    journal.clear()
    journal.update(id, { status: 200 })
    expect(journal.read().entries).toEqual([])
    expect(events).toEqual(['upsert', 'clear'])
    unsubscribe()
    journal.append(entry)
    expect(events).toHaveLength(2)
  })
})
