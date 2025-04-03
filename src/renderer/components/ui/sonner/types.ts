export interface Props {
  message: string
  type?: 'default' | 'success' | 'error'
  action?: {
    label: string
    onClick: () => void
  }
  duration?: number
}
