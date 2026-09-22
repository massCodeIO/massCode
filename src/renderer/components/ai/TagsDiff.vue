<script setup lang="ts">
import { Badge } from '@/components/ui/shadcn/badge'
import { i18n } from '@/electron'

const props = defineProps<{ before: string[], after: string[] }>()
const columns = computed(() => [
  {
    label: i18n.t('ai.workspace.before'),
    tags: props.before,
    other: new Set(props.after),
    removed: true,
  },
  {
    label: i18n.t('ai.workspace.after'),
    tags: props.after,
    other: new Set(props.before),
    removed: false,
  },
])
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-2">
    <div
      v-for="column in columns"
      :key="column.label"
      class="space-y-2 rounded-md border p-3"
    >
      <UiText
        variant="caption"
        muted
      >
        {{ column.label }}
      </UiText>
      <div class="flex flex-wrap gap-1.5">
        <Badge
          v-for="(tag, index) in column.tags"
          :key="index"
          variant="outline"
          :aria-label="
            column.other.has(tag)
              ? tag
              : i18n.t(
                column.removed ? 'ai.diff.removedTag' : 'ai.diff.addedTag',
                { tag },
              )
          "
          class="max-w-full break-all whitespace-normal"
          :class="
            !column.other.has(tag)
              ? column.removed
                ? 'bg-diff-removed-bg'
                : 'bg-diff-added-bg'
              : 'bg-muted text-muted-foreground'
          "
        >
          <span
            v-if="!column.other.has(tag)"
            aria-hidden="true"
          >{{
            column.removed ? "−" : "+"
          }}</span>
          <span
            :class="{
              'line-through': column.removed && !column.other.has(tag),
            }"
          >{{ tag }}</span>
        </Badge>
        <UiText
          v-if="!column.tags.length"
          variant="caption"
          muted
        >
          {{ i18n.t("ai.diff.noTags") }}
        </UiText>
      </div>
    </div>
  </div>
</template>
