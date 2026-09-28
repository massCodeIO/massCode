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
  <div
    class="flex h-9 items-center justify-between select-none"
    :class="{ 'py-1 pl-1': !collapsible }"
  >
    <Button
      v-if="collapsible"
      variant="ghost"
      size="sm"
      class="h-full min-w-0 flex-1 justify-start gap-1 rounded-none pr-0 pl-1 hover:bg-transparent hover:text-inherit dark:hover:bg-transparent"
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
