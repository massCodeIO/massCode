import { store } from '@/electron'

export type ContentSortField = 'createdAt' | 'updatedAt' | 'name'
export type ContentSortOrder = 'ASC' | 'DESC'
export type SortableContentSpaceId =
  | 'code'
  | 'notes'
  | 'http'
  | 'math'
  | 'drawings'

export interface ContentSortState {
  sort: ContentSortField
  order: ContentSortOrder
}

const DEFAULT_CONTENT_SORT: ContentSortState = {
  sort: 'createdAt',
  order: 'DESC',
}

const sortableSpaceIds: SortableContentSpaceId[] = [
  'code',
  'notes',
  'http',
  'math',
  'drawings',
]

export function isContentSortField(value: unknown): value is ContentSortField {
  return value === 'createdAt' || value === 'updatedAt' || value === 'name'
}

export function isContentSortOrder(value: unknown): value is ContentSortOrder {
  return value === 'ASC' || value === 'DESC'
}

function normalizeContentSort(value: unknown): ContentSortState {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_CONTENT_SORT }
  }

  const record = value as Partial<ContentSortState>

  return {
    sort: isContentSortField(record.sort)
      ? record.sort
      : DEFAULT_CONTENT_SORT.sort,
    order: isContentSortOrder(record.order)
      ? record.order
      : DEFAULT_CONTENT_SORT.order,
  }
}

const contentSortState = reactive<
  Record<SortableContentSpaceId, ContentSortState>
>({
  code: normalizeContentSort(store.app.get('code.contentSort')),
  notes: normalizeContentSort(store.app.get('notes.contentSort')),
  http: normalizeContentSort(store.app.get('http.contentSort')),
  math: normalizeContentSort(store.app.get('math.contentSort')),
  drawings: normalizeContentSort(store.app.get('drawings.contentSort')),
})

for (const spaceId of sortableSpaceIds) {
  watch(
    () => contentSortState[spaceId],
    value => store.app.set(`${spaceId}.contentSort`, { ...value }),
    { deep: true },
  )
}

export function isSortableContentSpaceId(
  value: unknown,
): value is SortableContentSpaceId {
  return sortableSpaceIds.includes(value as SortableContentSpaceId)
}

export function useContentSort() {
  function getContentSortQuery(spaceId: SortableContentSpaceId) {
    return { ...contentSortState[spaceId] }
  }

  function setContentSortField(
    spaceId: SortableContentSpaceId,
    sort: ContentSortField,
  ) {
    contentSortState[spaceId].sort = sort
  }

  function setContentSortOrder(
    spaceId: SortableContentSpaceId,
    order: ContentSortOrder,
  ) {
    contentSortState[spaceId].order = order
  }

  return {
    contentSortState,
    getContentSortQuery,
    setContentSortField,
    setContentSortOrder,
  }
}
