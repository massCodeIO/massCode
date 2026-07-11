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

  it('mints a stable id for unavailable metadata and converges to the real one', () => {
    // Первый запуск после обновления со старого state (15f86fd): ни
    // state.folders, ни folderIdByPath ещё нет, а .meta.yaml недокачан.
    // Id чеканится (блокировать всё пространство до докачки нельзя), но
    // фиксируется в folderIdByPath и не растёт между перезапусками.
    const state = createState()
    syncFoldersStateFromDisk(
      state,
      [diskFolder('Go', { unavailable: true })],
      ({ base }) => base,
    )
    expect(state.folders[0].id).toBe(7)
    expect(state.folderIdByPath).toEqual({ Go: 7 })

    // Второй холодный старт (folders снова пусты, meta всё ещё недокачана):
    // id стабилен, счётчик не растёт.
    const secondStart = createState({
      counters: { folderId: state.counters.folderId },
      folderIdByPath: { ...state.folderIdByPath },
    })
    syncFoldersStateFromDisk(
      secondStart,
      [diskFolder('Go', { unavailable: true })],
      ({ base }) => base,
    )
    expect(secondStart.folders[0].id).toBe(7)
    expect(secondStart.counters.folderId).toBe(7)

    // Meta докачалась: её id побеждает, и всё сходится к настоящему.
    syncFoldersStateFromDisk(
      secondStart,
      [diskFolder('Go', { id: 6 })],
      ({ base }) => base,
    )
    expect(secondStart.folders[0].id).toBe(6)
    expect(secondStart.folderIdByPath).toEqual({ Go: 6 })
  })

  it('never mints an id that collides with metadata ids on disk', () => {
    // Счётчик устройства отстаёт от метаданных, пришедших по синку
    // (counter = 5, а на диске папка с id 6): чеканка для placeholder-папки
    // не должна выдать занятый id — две папки с одним id смешали бы записи,
    // а удаление одной унесло бы файлы обеих.
    const state = createState({ counters: { folderId: 5 } })

    syncFoldersStateFromDisk(
      state,
      [
        // Папка с недокачанной метой обрабатывается ПЕРВОЙ (id чеканится),
        // папка с meta id 6 — после: оба направления коллизии закрыты.
        diskFolder('Pending', { unavailable: true }),
        diskFolder('Synced', { id: 6 }),
      ],
      ({ base }) => base,
    )

    const ids = state.folders.map(folder => folder.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(state.folders.find(f => f.name === 'Synced')?.id).toBe(6)
    expect(state.folders.find(f => f.name === 'Pending')?.id).toBe(7)
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
