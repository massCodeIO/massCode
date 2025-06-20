import type { Props } from '@/components/ui/sonner/types'
import Sonner from '@/components/ui/sonner/Sonner.vue'
import { toast } from 'vue-sonner'

export function useSonner() {
  const sonner = (config: Props) => {
    toast.custom(markRaw(Sonner), {
      componentProps: config,
      duration: config.action ? Infinity : config.duration || 5000,
      onDismiss: config.onClose,
    })
  }

  return {
    sonner,
  }
}
