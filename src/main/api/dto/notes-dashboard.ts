import Elysia, { t } from 'elysia'

const notesDashboardResponse = t.Object({
  stats: t.Object({
    notesCount: t.Number(),
    wordsCount: t.Number(),
    foldersCount: t.Number(),
    tagsCount: t.Number(),
  }),
  activity: t.Object({
    days: t.Record(t.String(), t.Number()),
    notesUpdatedToday: t.Number(),
    notesUpdatedLast7Days: t.Number(),
  }),
  recent: t.Array(
    t.Object({
      id: t.Number(),
      name: t.String(),
      folder: t.Nullable(
        t.Object({
          id: t.Number(),
          name: t.String(),
        }),
      ),
      updatedAt: t.Number(),
    }),
  ),
  topLinked: t.Array(
    t.Object({
      id: t.Number(),
      name: t.String(),
      incomingLinksCount: t.Number(),
    }),
  ),
  graphPreview: t.Object({
    nodes: t.Array(
      t.Object({
        id: t.Number(),
        name: t.String(),
        folderId: t.Nullable(t.Number()),
        incomingLinksCount: t.Number(),
      }),
    ),
    edges: t.Array(
      t.Object({
        source: t.Number(),
        target: t.Number(),
      }),
    ),
  }),
})

const notesGraphResponse = t.Object({
  nodes: t.Array(
    t.Object({
      id: t.Number(),
      name: t.String(),
      folderId: t.Nullable(t.Number()),
      tagIds: t.Array(t.Number()),
      incomingLinksCount: t.Number(),
    }),
  ),
  edges: t.Array(
    t.Object({
      source: t.Number(),
      target: t.Number(),
    }),
  ),
})

export const notesDashboardDTO = new Elysia().model({
  notesDashboardResponse,
  notesGraphResponse,
})

export type NotesDashboardResponse = typeof notesDashboardResponse.static
export type NotesGraphResponse = typeof notesGraphResponse.static
