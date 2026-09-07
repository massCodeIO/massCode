<script setup lang="ts">
import { Button } from '@/components/ui/shadcn/button'
import { ChevronRight } from 'lucide-vue-next'

interface Props {
  collapsible?: boolean
  open?: boolean
  title: string
}

defineProps<Props>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
</script>

<template>
  <div class="flex h-9 items-center justify-between py-1 pl-1 select-none">
    <Button
      v-if="collapsible"
      variant="ghost"
      size="sm"
      class="min-w-0 justify-start gap-1 px-0"
      :aria-expanded="open"
      @click="emit('update:open', !open)"
    >
      <ChevronRight
        class="size-3 shrink-0"
        :class="{ 'rotate-90': open }"
      />
      <UiText
        variant="caption"
        weight="bold"
        uppercase
      >
        {{ title }}
      </UiText>
    </Button>
    <UiText
      v-else
      as="div"
      variant="caption"
      weight="bold"
      uppercase
    >
      {{ title }}
    </UiText>
    <slot name="action" />
  </div>
</template>
