<script setup lang="ts">
import { CircleAlert, CircleCheck, CircleMinus } from 'lucide-vue-next'

const props = defineProps<{ state: string }>()
const appearance = computed(() => {
  if (props.state === 'failed' || props.state === 'error')
    return { icon: CircleAlert, class: 'text-destructive' }
  if (props.state === 'done' || props.state === 'applied')
    return { icon: CircleCheck, class: 'text-success' }
  if (props.state === 'cancelled' || props.state === 'rejected')
    return { icon: CircleMinus, class: 'text-muted-foreground' }
  return { icon: undefined, class: 'text-muted-foreground' }
})
</script>

<template>
  <UiText
    as="span"
    variant="caption"
    class="inline-flex items-start gap-1.5"
    :class="appearance.class"
    role="status"
  >
    <component
      :is="appearance.icon"
      v-if="appearance.icon"
      class="size-3 shrink-0"
      aria-hidden="true"
    />
    <span class="min-w-0"><slot /></span>
  </UiText>
</template>
