<script setup lang="ts">
import type { CommandPaletteResult } from '@/composables/useCommandPalette'
import { Badge } from '@/components/ui/shadcn/badge'
import { splitExcerpt } from '@/composables/command-palette/paletteSearch'
import { i18n } from '@/electron'

interface Props {
  result: CommandPaletteResult
  active?: boolean
  // Одна строка без подзаголовка и фрагмента.
  compact?: boolean
  muted?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  activate: [result: CommandPaletteResult]
  select: [result: CommandPaletteResult]
}>()

const match = computed(() =>
  props.result.type === 'snippet'
  || props.result.type === 'note'
  || props.result.type === 'http-request'
    ? props.result
    : undefined,
)

const reasonLabel = computed(() =>
  match.value?.reason
    ? i18n.t(`commandPalette.match.${match.value.reason}`)
    : '',
)

const excerptSegments = computed(() => {
  const excerpt = match.value?.excerpt
  return excerpt ? splitExcerpt(excerpt.text, excerpt.ranges) : []
})
</script>

<template>
  <button
    type="button"
    role="option"
    :aria-selected="active"
    :data-command-palette-active="active ? 'true' : undefined"
    class="[&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
    :class="[
      compact ? 'min-h-8' : 'min-h-11',
      active ? 'bg-accent text-accent-foreground' : '',
    ]"
    @click="emit('select', result)"
    @pointermove="emit('activate', result)"
  >
    <component
      :is="result.icon"
      class="mt-[2px] h-4 w-4"
    />
    <div class="min-w-0 flex-1">
      <div class="flex min-w-0 items-center gap-2">
        <UiText
          as="div"
          variant="sm"
          weight="medium"
          :muted="muted && !active"
          class="min-w-0 flex-1 truncate"
        >
          {{ result.title }}
        </UiText>
        <Badge
          v-if="reasonLabel"
          variant="outline"
          class="text-muted-foreground font-normal"
        >
          {{ reasonLabel }}
        </Badge>
      </div>
      <UiText
        v-if="result.subtitle && !compact"
        as="div"
        variant="caption"
        class="text-muted-foreground truncate"
      >
        {{ result.subtitle }}
      </UiText>
      <UiText
        v-if="excerptSegments.length && !compact"
        as="div"
        variant="caption"
        class="text-muted-foreground truncate"
      >
        <!-- v-text, а не интерполяция: форматирование шаблона добавило бы пробелы между сегментами -->
        <span
          v-for="(segment, index) in excerptSegments"
          :key="index"
          :class="segment.match ? 'text-foreground font-medium' : undefined"
          v-text="segment.text"
        />
      </UiText>
    </div>
  </button>
</template>
