import { describe, expect, it } from 'vitest'
import { countDockBadge, getLocalDateOnly, isValidDateOnly } from '../counts'

const emptyInput = { notes: [], snippets: [] }

describe('dock badge counts', () => {
  it('counts only active Code Inbox snippets', () => {
    expect(
      countDockBadge(
        'codeInbox',
        {
          notes: [],
          snippets: [
            { folderId: null, isDeleted: 0 },
            { folderId: 1, isDeleted: 0 },
            { folderId: null, isDeleted: 1 },
          ],
        },
        '2026-07-12',
      ),
    ).toBe(1)
  })

  it('counts all active Notes Inbox notes including tasks', () => {
    expect(
      countDockBadge(
        'notesInbox',
        {
          notes: [
            { folderId: null, isDeleted: 0, properties: {} },
            {
              folderId: null,
              isDeleted: 0,
              properties: { type: 'task' },
            },
            { folderId: 1, isDeleted: 0, properties: {} },
            { folderId: null, isDeleted: 1, properties: {} },
          ],
          snippets: [],
        },
        '2026-07-12',
      ),
    ).toBe(2)
  })

  it('counts incomplete overdue and today tasks', () => {
    expect(
      countDockBadge(
        'tasksDue',
        {
          notes: [
            {
              folderId: null,
              isDeleted: 0,
              properties: { type: 'task', status: 'todo', due: '2026-07-11' },
            },
            {
              folderId: 1,
              isDeleted: 0,
              properties: {
                type: 'task',
                status: 'inProgress',
                due: '2026-07-12',
              },
            },
            {
              folderId: 1,
              isDeleted: 0,
              properties: {
                type: 'task',
                status: 'blocked',
                due: '2026-07-12',
              },
            },
            {
              folderId: 1,
              isDeleted: 0,
              properties: { type: 'task', due: '2026-07-12' },
            },
            {
              folderId: 1,
              isDeleted: 0,
              properties: {
                type: 'task',
                status: 'unknown',
                due: '2026-07-12',
              },
            },
          ],
          snippets: [],
        },
        '2026-07-12',
      ),
    ).toBe(5)
  })

  it('excludes completed, future, undated, invalid, deleted and normal notes', () => {
    expect(
      countDockBadge(
        'tasksDue',
        {
          notes: [
            {
              folderId: null,
              isDeleted: 0,
              properties: { type: 'task', status: 'done', due: '2026-07-12' },
            },
            {
              folderId: null,
              isDeleted: 0,
              properties: { type: 'task', due: '2026-07-13' },
            },
            { folderId: null, isDeleted: 0, properties: { type: 'task' } },
            {
              folderId: null,
              isDeleted: 0,
              properties: { type: 'task', due: '2026-02-30' },
            },
            {
              folderId: null,
              isDeleted: 1,
              properties: { type: 'task', due: '2026-07-12' },
            },
            {
              folderId: null,
              isDeleted: 0,
              properties: { type: 'note', due: '2026-07-12' },
            },
          ],
          snippets: [],
        },
        '2026-07-12',
      ),
    ).toBe(0)
  })

  it('returns zero for none', () => {
    expect(countDockBadge('none', emptyInput, '2026-07-12')).toBe(0)
  })
})

describe('date-only helpers', () => {
  it('accepts only strict real calendar dates', () => {
    expect(isValidDateOnly('2024-02-29')).toBe(true)
    expect(isValidDateOnly('2026-02-29')).toBe(false)
    expect(isValidDateOnly('2026-2-03')).toBe(false)
    expect(isValidDateOnly('2026-02-03T00:00:00Z')).toBe(false)
  })

  it('formats a date using local calendar fields', () => {
    expect(getLocalDateOnly(new Date(2026, 6, 12, 23, 59))).toBe('2026-07-12')
  })
})
