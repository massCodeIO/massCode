export interface EditableColumn<Row> {
  key: string
  label: string
  width?: string
  editable?: boolean | ((row: Row) => boolean)
  value?: (row: Row) => string
  placeholder?: string
  type?: 'text' | 'password'
  wrap?: boolean
}
export type CellCommit<Row> = (
  row: Row,
  column: EditableColumn<Row>,
  value: string,
) => Promise<boolean | void> | boolean | void
