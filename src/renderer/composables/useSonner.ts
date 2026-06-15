import type { Props } from '@/components/ui/sonner/types'
import Sonner from '@/components/ui/sonner/Sonner.vue'
import { toast } from 'vue-sonner'

export function useSonner() {
  const sonner = (config: Props) => {
    return toast.custom(markRaw(Sonner), {
      id: config.id,
      componentProps: config,
      duration: config.action ? Infinity : config.duration || 5000,
      onDismiss: config.onClose,
    })
  }

  const dismiss = (id?: string | number) => {
    toast.dismiss(id)
  }

  return {
    sonner,
    dismiss,
  }
}
