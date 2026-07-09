<script setup lang="ts">
import { LoaderCircle } from 'lucide-vue-next'

// Блокирующий оверлей поверх редактора: показывается, пока содержимое
// записи недоступно (докачка из облака, загрузка полной записи). Родитель
// должен иметь position: relative.
interface Props {
  label?: string
}

defineProps<Props>()
</script>

<template>
  <div
    class="bg-background/70 absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 backdrop-blur-[1px]"
  >
    <LoaderCircle class="text-muted-foreground h-5 w-5 animate-spin" />
    <UiText
      v-if="label"
      as="p"
      variant="sm"
      muted
    >
      {{ label }}
    </UiText>
  </div>
</template>
