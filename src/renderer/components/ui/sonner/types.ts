export interface Props {
  message?: string
  component?: Component
  type?: 'default' | 'success' | 'error'
  closeButton?: boolean
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
  onClose?: () => void
}
