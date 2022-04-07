import type { Tag } from '@shared/types/main/db'

export interface State {
  tags: Tag[]
  selectedId?: string
}
