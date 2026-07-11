import type { FolderSyncState, SyncFolderBase } from '../folderSync'
import type { FolderDiskEntry, FolderMetadataSyncSource } from '../folderTypes'
import { describe, expect, it } from 'vitest'
import { syncFoldersStateFromDisk } from '../folderSync'

function createState(
  overrides?: Partial<FolderSyncState<SyncFolderBase>>,
): FolderSyncState<SyncFolderBase> {
  return {
    counters: { folderId: 6 },
    folderUi: {},
    folders: [],
    ...overrides,
  }
}

function diskFolder(
  folderPath: string,
  metadata: FolderMetadataSyncSource = {},
): FolderDiskEntry<FolderMetadataSyncSource> {
  return { metadata, path: folderPath }
}

describe('syncFoldersStateFromDisk', () => {
  it('keeps folder id from persisted folderIdByPath when metadata is unavailable', () => {
    // Холодный старт: state.folders пуст (не персистятся), .meta.yaml
    // недокачан из облака — metadata пустые. Без fallback'а папке чеканился
    // бы новый id (6 → 7), и все записи со старым folderId «пропадали».
    const state = createState({ folderIdByPath: { Go: 6 } })

    syncFoldersStateFromDisk(state, [diskFolder('Go')], ({ base }) => base)

    expect(state.folders).toHaveLength(1)
    expect(state.folders[0].id).toBe(6)
    expect(state.counters.folderId).toBe(6)
  })

  it('prefers metadata id over the persisted path fallback', () => {
    const state = createState({ folderIdByPath: { Go: 6 } })

    syncFoldersStateFromDisk(
      state,
      [diskFolder('Go', { id: 3 })],
      ({ base }) => base,
    )

    expect(state.folders[0].id).toBe(3)
  })

  it('refuses to mint a new id when metadata is unavailable and no fallback exists', () => {
    // Первый запуск после обновления со старого state (15f86fd): ни
    // state.folders, ни folderIdByPath ещё нет, а .meta.yaml недокачан.
    // Чеканка нового id (6 → 7) осиротила бы записи со старым folderId —
    // сверка обязана прерваться cloud-ошибкой и повториться после докачки.
    const state = createState()

    expect(() =>
      syncFoldersStateFromDisk(
        state,
        [diskFolder('Go', { unavailable: true })],
        ({ base }) => base,
      ),
    ).toThrow(/CLOUD_FILE_NOT_DOWNLOADED/)
    expect(state.counters.folderId).toBe(6)

    // Отсутствующий .meta.yaml (файла реально нет) — легитимно новая папка:
    // id чеканится как раньше.
    const freshState = createState()
    syncFoldersStateFromDisk(
      freshState,
      [diskFolder('New')],
      ({ base }) => base,
    )
    expect(freshState.folders[0].id).toBe(7)
  })

  it('keeps the known id even when metadata is unavailable', () => {
    const state = createState({ folderIdByPath: { Go: 6 } })

    syncFoldersStateFromDisk(
      state,
      [diskFolder('Go', { unavailable: true })],
      ({ base }) => base,
    )

    expect(state.folders[0].id).toBe(6)
  })

  it('refreshes folderIdByPath after sync for the next cold start', () => {
    const state = createState()

    syncFoldersStateFromDisk(
      state,
      [diskFolder('Go', { id: 2 }), diskFolder('Go/Nested', { id: 5 })],
      ({ base }) => base,
    )

    expect(state.folderIdByPath).toEqual({ 'Go': 2, 'Go/Nested': 5 })
  })
})
