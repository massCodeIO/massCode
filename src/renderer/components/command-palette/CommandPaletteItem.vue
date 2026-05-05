<script setup lang="ts">
import type { CommandPaletteResult } from '@/composables/useCommandPalette'

interface Props {
  result: CommandPaletteResult
  active?: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  activate: [result: CommandPaletteResult]
  select: [result: CommandPaletteResult]
}>()
</script>

<template>
  <button
    type="button"
    role="option"
    :aria-selected="active"
    :data-command-palette-active="active ? 'true' : undefined"
    class="[&_svg:not([class*='text-'])]:text-muted-foreground relative flex min-h-11 w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
    :class="active ? 'bg-accent text-accent-foreground' : ''"
    @click="emit('select', result)"
    @pointerenter="emit('activate', result)"
  >
    <component
      :is="result.icon"
      class="h-4 w-4"
    />
    <div class="min-w-0 flex-1">
      <UiText
        as="div"
        variant="sm"
        weight="medium"
        class="truncate"
      >
        {{ result.title }}
      </UiText>
      <UiText
        as="div"
        variant="caption"
        class="text-muted-foreground truncate"
      >
        {{ result.subtitle }}
      </UiText>
    </div>
  </button>
</template>
