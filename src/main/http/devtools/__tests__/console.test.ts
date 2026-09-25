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

it('uses explicitly safe AI content and never falls back to raw diagnostics', () => {
  const journal = new HttpConsoleJournal()
  journal.append({
    executionId: '1',
    kind: 'script',
    level: 'log',
    message: 'ordinary-secret',
  })
  journal.append(
    { executionId: '2', kind: 'script', level: 'log', message: 'other-secret' },
    { message: '[REDACTED]' },
  )
  expect(JSON.stringify(journal.read())).toContain('ordinary-secret')
  expect(JSON.stringify(journal.readForAi())).not.toContain('ordinary-secret')
  expect(JSON.stringify(journal.readForAi())).not.toContain('other-secret')
  expect(JSON.stringify(journal.readForAi())).toContain(
    'CONTENT_UNAVAILABLE_FOR_AI',
  )
})

it('publishes safe network content only for its existing execution and vault', () => {
  const journal = new HttpConsoleJournal()
  const id = journal.append({ ...entry, kind: 'network' })
  const safe = { message: 'safe capture', details: { requestId: 1 } }
  journal.publishAiContent(
    id,
    { executionId: 'other', vaultPath: '/vault' },
    safe,
  )
  expect(journal.readForAi('/vault').entries[0].message).toBe(
    '[CONTENT_UNAVAILABLE_FOR_AI]',
  )
  journal.publishAiContent(
    id,
    { executionId: 'test', vaultPath: '/vault' },
    safe,
  )
  expect(journal.readForAi('/vault').entries[0].message).toBe('safe capture')
  expect(journal.readForAi('/other-vault').entries).toEqual([])
  journal.clear()
  journal.publishAiContent(
    id,
    { executionId: 'test', vaultPath: '/vault' },
    safe,
  )
  expect(journal.readForAi('/vault').entries).toEqual([])
  const pruned = journal.append({
    ...entry,
    timestamp: Date.now() - CONSOLE_MAX_AGE - 1,
  })
  journal.publishAiContent(
    pruned,
    { executionId: 'test', vaultPath: '/vault' },
    safe,
  )
  expect(journal.readForAi('/vault').entries).toEqual([])
})
