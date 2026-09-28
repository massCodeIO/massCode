<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { CircleAlert, LoaderCircle } from 'lucide-vue-next'

// Блокирующий оверлей поверх редактора: показывается, пока содержимое
// записи недоступно (докачка из облака, загрузка полной записи). Родитель
// должен иметь position: relative.
interface Props {
  actionLabel?: string
  error?: boolean
  label?: string
  silent?: boolean
}

defineProps<Props>()

defineEmits<{
  retry: []
}>()
</script>

<template>
  <div
    class="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3"
    :class="silent ? 'bg-transparent' : 'bg-background/70 backdrop-blur-[1px]'"
  >
    <CircleAlert
      v-if="error && !silent"
      class="text-destructive h-5 w-5"
    />
    <LoaderCircle
      v-else-if="!silent"
      class="text-muted-foreground h-5 w-5 animate-spin"
    />
    <UiText
      v-if="label && !silent"
      as="p"
      variant="sm"
      muted
    >
      {{ label }}
    </UiText>
    <Button
      v-if="error && actionLabel && !silent"
      size="sm"
      variant="outline"
      @click="$emit('retry')"
    >
      {{ actionLabel }}
    </Button>
  </div>
</template>
