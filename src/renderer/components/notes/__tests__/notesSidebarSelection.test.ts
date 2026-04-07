import { describe, expect, it, vi } from 'vitest'
import { getVisibleSelectedFolderIds } from '../notesSidebarSelection'

vi.mock('@/router', () => ({
  RouterName: {
    notesSpace: 'notes-space',
    notesDashboard: 'notes-space/dashboard',
    notesGraph: 'notes-space/graph',
  },
}))

describe('notesSidebarSelection', () => {
  it('returns selected folders only in the notes workspace route', () => {
    expect(getVisibleSelectedFolderIds('notes-space', [3, 7])).toEqual([3, 7])
    expect(
      getVisibleSelectedFolderIds('notes-space/dashboard', [3, 7]),
    ).toEqual([])
    expect(getVisibleSelectedFolderIds('notes-space/graph', [3, 7])).toEqual(
      [],
    )
  })
})
